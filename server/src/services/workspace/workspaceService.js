import crypto from 'node:crypto';

import {
  APP_ID,
  MEMBER_STATUS,
  WORKSPACE_ROLES,
  WORKSPACE_STATUS,
} from '../../config/constants.js';
import { User, Workspace, WorkspaceMember } from '../../models/index.js';

/** Random, unguessable workspace id — never sequential. */
export function generateWorkspaceId() {
  return `ws_${crypto.randomBytes(18).toString('base64url')}`;
}

/** The caller's active membership, or null. A user is in one workspace here. */
export function findActiveMembership(userId) {
  return WorkspaceMember.findOne({
    appId: APP_ID,
    userId,
    status: MEMBER_STATUS.ACTIVE,
  }).lean();
}

/**
 * Guarantees the user has a workspace. On self-registration this creates their
 * personal workspace with them as owner; it also self-heals any pre-existing
 * user who has no membership yet (e.g. accounts created before multi-tenancy),
 * so no separate backfill migration is needed.
 */
export async function ensurePersonalWorkspace({ userId, name = '' }) {
  const existing = await findActiveMembership(userId);
  if (existing) return existing;

  const workspaceId = generateWorkspaceId();
  await Workspace.create({
    appId: APP_ID,
    workspaceId,
    name,
    ownerUserId: userId,
    status: WORKSPACE_STATUS.ACTIVE,
  });
  const member = await WorkspaceMember.create({
    appId: APP_ID,
    workspaceId,
    userId,
    role: WORKSPACE_ROLES.OWNER,
    status: MEMBER_STATUS.ACTIVE,
  });

  return member.toObject();
}

/**
 * Creates a buyer's owner account outright, with the password the hub
 * generated. The buyer can then sign in normally — no activation step. The hub
 * is the authority on the buyer's credentials, so a re-provision resets the
 * password (which is what "resend my login" means on the hub side).
 */
export async function createOwnerWithPassword({ workspaceId, ownerEmail, ownerName, password }) {
  const email = ownerEmail.toLowerCase().trim();

  let user = await User.findOne({ email });
  if (user) {
    user.password = password;
    await user.save();
  } else {
    user = new User({ name: ownerName?.trim() || email, email, password });
    await user.save();
  }

  await Workspace.updateOne(
    { workspaceId },
    { $set: { ownerUserId: user._id, ownerEmail: email } },
  );

  const existing = await WorkspaceMember.findOne({ workspaceId, userId: user._id });
  if (!existing) {
    await WorkspaceMember.create({
      appId: APP_ID,
      workspaceId,
      userId: user._id,
      role: WORKSPACE_ROLES.OWNER,
      status: MEMBER_STATUS.ACTIVE,
    });
  }

  return user;
}

export default {
  generateWorkspaceId,
  findActiveMembership,
  ensurePersonalWorkspace,
  createOwnerWithPassword,
};
