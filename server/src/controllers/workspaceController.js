import { env } from '../config/env.js';
import * as membership from '../services/workspace/membershipService.js';
import { signAccessToken, signRefreshToken, setRefreshCookie } from '../services/auth/tokenService.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const clientUrl = () => env.CLIENT_URL?.replace(/\/$/, '') ?? '';

/** Team list — owner/admin only (enforced by the route). */
export const members = asyncHandler(async (req, res) => {
  const list = await membership.listMembers(req.workspaceId);
  return sendSuccess(res, {
    message: 'OK',
    data: {
      members: list.map((m) => ({
        id: m._id,
        userId: m.userId?._id ?? m.userId,
        name: m.userId?.name ?? '',
        email: m.userId?.email ?? '',
        role: m.role,
        status: m.status,
      })),
    },
  });
});

/** Create an invite link for the caller's workspace. */
export const invite = asyncHandler(async (req, res) => {
  const { token, role } = await membership.createInvite({
    workspaceId: req.workspaceId,
    email: req.body.email,
    role: req.body.role,
    invitedBy: req.user._id,
  });

  return sendCreated(res, {
    message: 'Invitation created.',
    data: { joinUrl: `${clientUrl()}/join/${token}`, role },
  });
});

export const removeMember = asyncHandler(async (req, res) => {
  await membership.removeMember({ workspaceId: req.workspaceId, memberUserId: req.params.userId });
  return sendSuccess(res, { message: 'Member removed.', data: {} });
});

/** Public: what a join token points at (name a password field, show the role). */
export const joinInfo = asyncHandler(async (req, res) => {
  const invite = await membership.getUsableInvite(req.params.token);
  if (!invite) {
    return sendSuccess(res, { message: 'OK', data: { valid: false } });
  }
  return sendSuccess(res, {
    message: 'OK',
    data: { valid: true, role: invite.role, email: invite.email },
  });
});

/** Public: accept the invite, create/attach the user, and log them straight in. */
export const acceptJoin = asyncHandler(async (req, res) => {
  const { user } = await membership.acceptInvite({
    rawToken: req.params.token,
    name: req.body.name,
    password: req.body.password,
  });

  // Bound to their workspace and signed in — no picker, routed automatically.
  setRefreshCookie(res, signRefreshToken(user));
  return sendSuccess(res, {
    message: 'Welcome to the workspace.',
    data: {
      accessToken: signAccessToken(user),
      user: { id: user._id, name: user.name, email: user.email },
    },
  });
});

export default { members, invite, removeMember, joinInfo, acceptJoin };
