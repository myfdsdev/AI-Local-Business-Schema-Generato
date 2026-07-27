import { env } from '../config/env.js';
import * as apiKeys from '../services/workspace/apiKeyService.js';
import * as membership from '../services/workspace/membershipService.js';
import { activeProvider, isAiConfigured } from '../services/ai/aiClient.js';
import { listProviders } from '../services/ai/providers.js';
import { getWorkspace, renameWorkspace } from '../services/workspace/workspaceService.js';
import { getWorkspaceStats } from '../services/workspace/statsService.js';
import { signAccessToken, signRefreshToken, setRefreshCookie } from '../services/auth/tokenService.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const clientUrl = () => env.CLIENT_URL?.replace(/\/$/, '') ?? '';

/** The caller's own workspace context — used by the UI to show the right nav. */
export const context = asyncHandler(async (req, res) => {
  const workspace = await getWorkspace(req.workspaceId);
  return sendSuccess(res, {
    message: 'OK',
    data: {
      workspaceId: req.workspaceId,
      role: req.wsRole,
      name: workspace?.name ?? '',
      status: workspace?.status ?? 'active',
      ownerEmail: workspace?.ownerEmail ?? '',
    },
  });
});

/** Rename the caller's workspace — owner/admin only (enforced by the route). */
export const update = asyncHandler(async (req, res) => {
  const workspace = await renameWorkspace({ workspaceId: req.workspaceId, name: req.body.name });
  return sendSuccess(res, {
    message: 'Workspace updated.',
    data: { workspaceId: workspace.workspaceId, name: workspace.name, status: workspace.status },
  });
});

// --- Bring-your-own AI key ---------------------------------------------------
// Every handler below scopes to req.workspaceId (from the session), so a caller
// can only ever read or change their OWN workspace's key. The plaintext key is
// never returned — only the last 4 characters.

/** The caller's stored key, masked, plus what they fall back to without one. */
export const getApiKey = asyncHandler(async (req, res) => {
  const key = await apiKeys.getWorkspaceKey(req.workspaceId);
  return sendSuccess(res, {
    message: 'OK',
    data: {
      key,
      // The UI renders the supported list from here rather than hardcoding it,
      // so registering a provider server-side is enough to surface it.
      providers: listProviders(),
      // So the UI can say "you're using the shared platform key" honestly.
      platformFallback: { available: isAiConfigured(), provider: activeProvider() },
    },
  });
});

/** Stores or replaces the key. The provider is detected from the key itself. */
export const putApiKey = asyncHandler(async (req, res) => {
  const key = await apiKeys.saveWorkspaceKey({
    workspaceId: req.workspaceId,
    userId: req.user._id,
    apiKey: req.body.apiKey,
    model: req.body.model,
  });
  return sendSuccess(res, { message: 'API key saved.', data: { key } });
});

export const testApiKey = asyncHandler(async (req, res) => {
  const key = await apiKeys.testWorkspaceKey(req.workspaceId);
  return sendSuccess(res, {
    message: key.status === 'active' ? 'Key verified.' : 'Key stored but could not be verified.',
    data: { key },
  });
});

export const deleteApiKey = asyncHandler(async (req, res) => {
  await apiKeys.deleteWorkspaceKey(req.workspaceId);
  return sendSuccess(res, { message: 'API key removed.', data: {} });
});

/** Workspace dashboard stats — owner/admin only (enforced by the route). */
export const stats = asyncHandler(async (req, res) => {
  const data = await getWorkspaceStats(req.workspaceId);
  return sendSuccess(res, { message: 'OK', data });
});

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

export const updateMember = asyncHandler(async (req, res) => {
  await membership.updateMemberRole({
    workspaceId: req.workspaceId,
    memberUserId: req.params.userId,
    role: req.body.role,
  });
  return sendSuccess(res, { message: 'Role updated.', data: {} });
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

  return issueSessionFor(res, user);
});

/**
 * Public: owner activation with the email + code generated by the hub. Rate
 * limited by the route so the short code can't be brute-forced.
 */
export const activate = asyncHandler(async (req, res) => {
  const { user } = await membership.acceptByCode({
    email: req.body.email,
    code: req.body.code,
    name: req.body.name,
    password: req.body.password,
  });

  return issueSessionFor(res, user);
});

/** Signs the user in (access token + refresh cookie) and returns the session. */
function issueSessionFor(res, user) {
  setRefreshCookie(res, signRefreshToken(user));
  return sendSuccess(res, {
    message: 'Welcome to the workspace.',
    data: {
      accessToken: signAccessToken(user),
      user: { id: user._id, name: user.name, email: user.email },
    },
  });
}

export default {
  context,
  update,
  getApiKey,
  putApiKey,
  testApiKey,
  deleteApiKey,
  stats,
  members,
  invite,
  removeMember,
  updateMember,
  joinInfo,
  acceptJoin,
  activate,
};
