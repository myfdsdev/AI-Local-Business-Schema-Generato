import crypto from 'node:crypto';

import { APP_ID, WORKSPACE_ROLES, WORKSPACE_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';
import { Workspace } from '../models/index.js';
import { createInvite, createOwnerActivation } from '../services/workspace/membershipService.js';
import {
  createOwnerWithPassword,
  generateWorkspaceId,
} from '../services/workspace/workspaceService.js';
import ApiError from '../utils/ApiError.js';
import { safeEqual } from '../utils/tokens.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const clientUrl = () => env.CLIENT_URL?.replace(/\/$/, '') ?? '';

/**
 * Generates a login password on the app's behalf, for stores that cannot make
 * one themselves. Returned to the hub EXACTLY ONCE in the provision response
 * and never recoverable afterwards — only a bcrypt hash is stored.
 *
 * Ambiguous characters (0/O, 1/l/I) are excluded because a human will read this
 * out of an email and retype it. Always satisfies passwordSchema: 10+ chars with
 * at least one letter and one number.
 */
function generatePassword() {
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const DIGITS = '23456789';
  const SYMBOLS = '!@#$%*?';
  const pool = LETTERS + DIGITS + SYMBOLS;

  const pick = (set) => set[crypto.randomInt(0, set.length)];
  // Seed one of each required class, then fill to length.
  const chars = [pick(LETTERS), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < 16) chars.push(pick(pool));

  // Fisher-Yates so the seeded characters aren't always in the first positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

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
 * Discovery document. PUBLIC on purpose: the hub is given only a base URL, and
 * fetches this to learn who the app is and which endpoints to call — so nobody
 * has to type a path by hand, and a wrong URL is caught immediately.
 *
 * Contains no secrets and grants nothing: every endpoint it advertises is still
 * gated by the shared secret. Keep this shape identical in every app so one
 * hub-side reader works for all of them.
 */
export const manifest = asyncHandler(async (_req, res) =>
  sendSuccess(res, {
    message: 'OK',
    data: {
      appId: APP_ID,
      name: 'LocalSchema AI',
      description: 'AI-powered Schema.org JSON-LD generator for local businesses.',
      apiVersion: 'v1',
      // Version of the shared workspace contract, NOT of this app. Bump only if
      // the provision request/response shape changes.
      workspaceSystem: '1.0',
      auth: { type: 'shared-secret', header: 'x-platform-secret' },
      endpoints: {
        provision: '/api/v1/platform/provision',
        suspend: '/api/v1/platform/suspend',
        reactivate: '/api/v1/platform/reactivate',
      },
      // Which onboarding styles this app accepts, best first. `generatePassword`
      // is for stores that cannot produce a password themselves — the app makes
      // one and returns it once for the store to relay.
      provisionMethods: ['password', 'generatePassword', 'activationCode', 'link'],
      // Where a provisioned buyer signs in. Lets the hub verify CLIENT_URL is
      // configured before a real customer receives a broken link.
      loginUrl: `${clientUrl()}/login`,
      // False when PLATFORM_SECRET is unset — the bridge is disabled and every
      // call would 401. Surfaces the most common setup mistake up front.
      ready: Boolean(env.PLATFORM_SECRET || process.env.PLATFORM_SECRET),
    },
  }),
);

/**
 * The hub creates a buyer here. We generate the owner's workspace + a one-time
 * join link, and return the link so the hub can send it to the buyer. The owner
 * user is created when they accept (they choose their own password then).
 */
export const provision = asyncHandler(async (req, res) => {
  const { ownerName, ownerEmail, activationCode, password } = req.body;
  const workspaceId = req.body.workspaceId || generateWorkspaceId();

  if (!ownerEmail) {
    throw ApiError.badRequest('ownerEmail is required.', { code: 'VALIDATION_ERROR' });
  }

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
      ownerEmail: ownerEmail.toLowerCase().trim(),
      status: WORKSPACE_STATUS.ACTIVE,
    });
  }

  // Preferred path: the hub generated the password, so the owner account is
  // created here and ready. The hub emails the buyer their email + password and
  // they sign in on the normal login page — no activation step.
  if (password) {
    await createOwnerWithPassword({ workspaceId, ownerEmail, ownerName, password });
    return sendCreated(res, {
      message: 'Workspace provisioned.',
      data: { workspaceId, method: 'password', loginUrl: `${clientUrl()}/login` },
    });
  }

  // Same outcome, for stores that cannot generate a password themselves: WE
  // generate it and return it once. The hub only has to relay it to the buyer.
  // `temporaryPassword` is in the response body and nowhere else — it is never
  // logged and cannot be read back, since only the bcrypt hash is stored.
  if (req.body.generatePassword) {
    const generated = generatePassword();
    await createOwnerWithPassword({ workspaceId, ownerEmail, ownerName, password: generated });
    return sendCreated(res, {
      message: 'Workspace provisioned.',
      data: {
        workspaceId,
        method: 'password',
        loginUrl: `${clientUrl()}/login`,
        temporaryPassword: generated,
      },
    });
  }

  // If the hub sent a 6–7 digit activation code, the owner redeems it with
  // their email at /activate. Otherwise fall back to a one-time join link.
  if (activationCode) {
    await createOwnerActivation({ workspaceId, ownerEmail, code: String(activationCode) });
    return sendCreated(res, {
      message: 'Workspace provisioned.',
      data: { workspaceId, method: 'code', activateUrl: `${clientUrl()}/activate` },
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
    data: { workspaceId, method: 'link', joinUrl: `${clientUrl()}/join/${token}` },
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

export default { requireHubSecret, manifest, provision, suspend, reactivate };
