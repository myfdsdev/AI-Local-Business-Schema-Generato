import crypto from 'node:crypto';

import { APP_ID, WORKSPACE_ROLES, WORKSPACE_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import { Workspace } from '../models/index.js';
import { sendEmail } from '../services/email/emailClient.js';
import { welcomeCredentialsEmail } from '../services/email/templates.js';
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
 * The hub creates a buyer here.
 *
 * DEFAULT: a ready-to-use OWNER ACCOUNT. Workspace, user and owner membership
 * are all created, and the password is generated here if the store didn't send
 * one — so a bare `{ ownerEmail }` call still yields someone who can log in.
 *
 * The join-link flow (workspace now, user later when they click) is the opposite
 * of what a paying customer wants, so it is opt-in only: `method: 'link'`.
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

  // Explicit opt-in only: workspace now, user created when they click the link.
  if (req.body.method === 'link') {
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
  }

  // Owner redeems a short code with their email and picks their own password.
  if (activationCode) {
    await createOwnerActivation({ workspaceId, ownerEmail, code: String(activationCode) });
    return sendCreated(res, {
      message: 'Workspace provisioned.',
      data: { workspaceId, method: 'code', activateUrl: `${clientUrl()}/activate` },
    });
  }

  // DEFAULT — a live owner account. Uses the store's password when supplied,
  // otherwise generates one. `temporaryPassword` is returned only when we made
  // it: if the store chose the password it already knows it, and echoing a
  // caller-supplied secret back serves no purpose.
  {
    const generated = password || generatePassword();
    await createOwnerWithPassword({ workspaceId, ownerEmail, ownerName, password: generated });

    const loginUrl = `${clientUrl()}/login`;

    // Optionally let THIS app deliver the credentials, so the store never has to
    // handle a password at all. Deliberately not fatal: the account already
    // exists, so a mail failure must still return the password for the store to
    // fall back on rather than 500 after taking the customer's money.
    let emailed = false;
    if (req.body.sendWelcomeEmail) {
      try {
        const message = welcomeCredentialsEmail({
          name: ownerName,
          email: ownerEmail,
          password: generated,
          loginUrl,
        });
        const result = await sendEmail({
          to: ownerEmail,
          replyTo: env.EMAIL_REPLY_TO,
          ...message,
        });
        emailed = Boolean(result.sent);
      } catch (error) {
        logger.error('Provisioned account but could not email credentials', {
          workspaceId,
          message: error.message,
        });
      }
    }

    return sendCreated(res, {
      message: 'Workspace provisioned.',
      data: {
        workspaceId,
        method: 'password',
        loginUrl,
        // Only when WE generated it — a store that chose the password already
        // has it, and echoing back a caller-supplied secret serves no purpose.
        ...(password ? {} : { temporaryPassword: generated }),
        // False means the store MUST deliver the password itself.
        emailed,
      },
    });
  }
});

/**
 * Flips a workspace's status.
 *
 * Confirms something was actually matched. Previously a missing or misspelled
 * workspaceId returned 200 "suspended" while changing nothing — so a refund
 * webhook would report success and the customer would keep their access.
 */
async function setStatus(req, status, verb) {
  const { workspaceId } = req.body;

  if (!workspaceId) {
    throw ApiError.badRequest('workspaceId is required.', { code: 'VALIDATION_ERROR' });
  }

  const workspace = await Workspace.findOne({ appId: APP_ID, workspaceId });
  if (!workspace) {
    throw ApiError.notFound(`No workspace with id "${workspaceId}".`, {
      code: 'WORKSPACE_NOT_FOUND',
    });
  }

  workspace.status = status;
  await workspace.save();
  logger.info(`Workspace ${verb}`, { workspaceId });

  return { workspaceId, status };
}

export const suspend = asyncHandler(async (req, res) => {
  const data = await setStatus(req, WORKSPACE_STATUS.SUSPENDED, 'suspended');
  return sendSuccess(res, { message: 'Workspace suspended.', data });
});

export const reactivate = asyncHandler(async (req, res) => {
  const data = await setStatus(req, WORKSPACE_STATUS.ACTIVE, 'reactivated');
  return sendSuccess(res, { message: 'Workspace reactivated.', data });
});

export default { requireHubSecret, manifest, provision, suspend, reactivate };
