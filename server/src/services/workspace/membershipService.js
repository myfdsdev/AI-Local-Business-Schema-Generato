import {
  APP_ID,
  INVITATION_STATUS,
  MEMBER_STATUS,
  WORKSPACE_ROLES,
} from '../../config/constants.js';
import { Invitation, User, Workspace, WorkspaceMember } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { addDuration, DURATIONS, generateRawToken, hashToken } from '../../utils/tokens.js';
import { findActiveMembership } from './workspaceService.js';

const INVITE_TTL = 7 * DURATIONS.DAY;

/** Lists the members of a workspace (owner/admin view). */
export function listMembers(workspaceId) {
  return WorkspaceMember.find({ appId: APP_ID, workspaceId, status: MEMBER_STATUS.ACTIVE })
    .populate('userId', 'name email')
    .sort({ createdAt: 1 })
    .lean();
}

/**
 * Creates a single-use invitation bound to a workspace + role and returns the
 * raw join token. Only the digest is stored, so a DB leak yields no usable link.
 */
export async function createInvite({ workspaceId, email, role, invitedBy }) {
  const safeRole = role === WORKSPACE_ROLES.ADMIN ? WORKSPACE_ROLES.ADMIN : WORKSPACE_ROLES.MEMBER;
  const rawToken = generateRawToken();

  await Invitation.create({
    appId: APP_ID,
    workspaceId,
    email: email?.toLowerCase().trim() ?? '',
    role: safeRole,
    tokenHash: hashToken(rawToken),
    invitedBy: invitedBy ?? null,
    status: INVITATION_STATUS.PENDING,
    expiresAt: addDuration(new Date(), INVITE_TTL),
  });

  return { token: rawToken, role: safeRole };
}

/** The invitation behind a raw token, if still usable. */
export async function getUsableInvite(rawToken) {
  const invite = await Invitation.findOne({
    tokenHash: hashToken(rawToken),
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  });
  return invite ?? null;
}

/**
 * Owner activation code created by provisioning. The code is short (so the hub
 * can show it to a buyer), so it is stored hashed AND bound to the owner's
 * email — redeeming needs both, which (with rate limiting on the route) makes
 * guessing infeasible.
 */
export async function createOwnerActivation({ workspaceId, ownerEmail, code, ttlDays = 30 }) {
  await Invitation.create({
    appId: APP_ID,
    workspaceId,
    email: ownerEmail.toLowerCase().trim(),
    role: WORKSPACE_ROLES.OWNER,
    tokenHash: hashToken(code),
    status: INVITATION_STATUS.PENDING,
    expiresAt: addDuration(new Date(), ttlDays * DURATIONS.DAY),
  });
}

/**
 * Binds a user to an invite's workspace with its role — the shared core of both
 * link-based joins and code-based owner activation. The workspace always comes
 * from the invite, never from anything the user typed.
 */
async function materializeInvite(invite, { name, password }) {
  // Attach to an existing account (by the invited email) or create a new one.
  let user = invite.email ? await User.findOne({ email: invite.email }) : null;
  if (!user) {
    if (!password || !name) {
      throw ApiError.badRequest('Name and password are required to accept this invitation.');
    }
    user = new User({
      name: name.trim(),
      email: invite.email || `member+${invite._id}@invited.local`,
      password,
      role: 'user',
    });
    await user.save();
  }

  // One membership per user per workspace; re-accepting is idempotent.
  const existing = await WorkspaceMember.findOne({ workspaceId: invite.workspaceId, userId: user._id });
  if (!existing) {
    await WorkspaceMember.create({
      appId: APP_ID,
      workspaceId: invite.workspaceId,
      userId: user._id,
      role: invite.role,
      status: MEMBER_STATUS.ACTIVE,
    });
  }

  // A hub-provisioned owner claims the workspace when they first accept.
  if (invite.role === WORKSPACE_ROLES.OWNER) {
    await Workspace.updateOne(
      { workspaceId: invite.workspaceId, ownerUserId: null },
      { ownerUserId: user._id },
    );
  }

  invite.status = INVITATION_STATUS.ACCEPTED;
  await invite.save();

  return { user, workspaceId: invite.workspaceId, role: invite.role };
}

/** Redeem a link token (team invites). */
export async function acceptInvite({ rawToken, name, password }) {
  const invite = await getUsableInvite(rawToken);
  if (!invite) {
    throw ApiError.badRequest('This invitation link is invalid or has expired.', {
      code: 'INVALID_TOKEN',
    });
  }
  return materializeInvite(invite, { name, password });
}

/** Redeem an email + activation code (owner activation from the hub). */
export async function acceptByCode({ email, code, name, password }) {
  const invite = await Invitation.findOne({
    appId: APP_ID,
    email: email.toLowerCase().trim(),
    tokenHash: hashToken(String(code)),
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  });
  // Deliberately identical error whether the email or the code is wrong, so it
  // can't be used to confirm which emails have codes.
  if (!invite) {
    throw ApiError.badRequest('That email and code do not match an active invitation.', {
      code: 'INVALID_CODE',
    });
  }
  return materializeInvite(invite, { name, password });
}

/** Removes a member from a workspace (owner/admin action). Owner cannot be removed. */
export async function removeMember({ workspaceId, memberUserId }) {
  const membership = await findActiveMembership(memberUserId);
  if (!membership || membership.workspaceId !== workspaceId) {
    throw ApiError.notFound('Member not found in this workspace.');
  }
  if (membership.role === WORKSPACE_ROLES.OWNER) {
    throw ApiError.forbidden('The workspace owner cannot be removed.');
  }
  await WorkspaceMember.updateOne(
    { workspaceId, userId: memberUserId },
    { status: MEMBER_STATUS.REVOKED },
  );
}

export default {
  listMembers,
  createInvite,
  getUsableInvite,
  acceptInvite,
  createOwnerActivation,
  acceptByCode,
  removeMember,
};
