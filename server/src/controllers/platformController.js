import { APP_ID, WORKSPACE_ROLES, WORKSPACE_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';
import { Workspace } from '../models/index.js';
import { createInvite } from '../services/workspace/membershipService.js';
import { generateWorkspaceId } from '../services/workspace/workspaceService.js';
import ApiError from '../utils/ApiError.js';
import { safeEqual } from '../utils/tokens.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const clientUrl = () => env.CLIENT_URL?.replace(/\/$/, '') ?? '';

/**
 * Guards the /platform/* endpoints: only the AppsFields hub, which holds the
 * shared secret, may call them. Length-safe comparison. Disabled entirely when
 * no secret is configured (this app then runs standalone).
 */
export function requireHubSecret(req, _res, next) {
  // Read at request time (falling back to the parsed env) so the secret can be
  // rotated or set in tests without a restart.
  const configured = env.PLATFORM_SECRET || process.env.PLATFORM_SECRET;
  const provided = req.get('x-platform-secret') ?? '';
  if (!configured || !safeEqual(provided, configured)) {
    return next(ApiError.unauthorized('Not authorized.', { code: 'PLATFORM_UNAUTHORIZED' }));
  }
  return next();
}

/**
 * The hub creates a buyer here. We generate the owner's workspace + a one-time
 * join link, and return the link so the hub can send it to the buyer. The owner
 * user is created when they accept (they choose their own password then).
 */
export const provision = asyncHandler(async (req, res) => {
  const { ownerName, ownerEmail } = req.body;
  const workspaceId = req.body.workspaceId || generateWorkspaceId();

  const existing = await Workspace.findOne({ workspaceId });
  if (existing) {
    // Idempotent: reactivate rather than error if the hub retries.
    existing.status = WORKSPACE_STATUS.ACTIVE;
    await existing.save();
  } else {
    await Workspace.create({
      appId: APP_ID,
      workspaceId,
      name: ownerName ?? '',
      ownerEmail: ownerEmail?.toLowerCase().trim() ?? '',
      status: WORKSPACE_STATUS.ACTIVE,
    });
  }

  const { token } = await createInvite({
    workspaceId,
    email: ownerEmail,
    role: WORKSPACE_ROLES.OWNER,
    invitedBy: null,
  });

  return sendCreated(res, {
    message: 'Workspace provisioned.',
    data: { workspaceId, joinUrl: `${clientUrl()}/join/${token}` },
  });
});

export const suspend = asyncHandler(async (req, res) => {
  await Workspace.updateOne(
    { workspaceId: req.body.workspaceId },
    { status: WORKSPACE_STATUS.SUSPENDED },
  );
  return sendSuccess(res, { message: 'Workspace suspended.', data: {} });
});

export const reactivate = asyncHandler(async (req, res) => {
  await Workspace.updateOne(
    { workspaceId: req.body.workspaceId },
    { status: WORKSPACE_STATUS.ACTIVE },
  );
  return sendSuccess(res, { message: 'Workspace reactivated.', data: {} });
});

export default { requireHubSecret, provision, suspend, reactivate };
