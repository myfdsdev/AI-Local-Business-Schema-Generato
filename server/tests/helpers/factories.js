import request from 'supertest';

import { Plan } from '../../src/models/index.js';
import { plans } from '../../src/seed/data/plans.js';
import { ensurePersonalWorkspace } from '../../src/services/workspace/workspaceService.js';
import { User } from '../../src/models/index.js';
import { getApp } from './testServer.js';

export const VALID_PASSWORD = 'Sup3rSecret!';

let userCounter = 0;

export function uniqueEmail(prefix = 'user') {
  userCounter += 1;
  return `${prefix}+${Date.now()}-${userCounter}@example.com`;
}

export async function seedPlans() {
  for (const plan of plans) {
    await Plan.updateOne({ slug: plan.slug }, { $set: plan }, { upsert: true });
  }
}

/**
 * Registers a user through the real endpoint and returns the access token plus
 * the refresh cookie, so tests authenticate exactly as the client does.
 */
export async function registerUser(overrides = {}) {
  // Public signup is closed in production; this fixture opens it so tests can
  // mint users cheaply. The closed-by-default behaviour is asserted separately
  // in auth.test.js.
  process.env.ALLOW_PUBLIC_SIGNUP = 'true';

  const payload = {
    name: 'Test User',
    email: uniqueEmail(),
    password: VALID_PASSWORD,
    accountType: 'local_business',
    ...overrides,
  };

  const response = await request(getApp()).post('/api/v1/auth/register').send(payload);
  return { response, payload };
}

/**
 * Registers a user AND gives them a workspace they own.
 *
 * Signing up no longer grants a workspace, so anything touching a
 * workspace-scoped route needs this instead of registerUser() — otherwise the
 * request is refused with 403 WORKSPACE_REQUIRED. Granted directly through the
 * service rather than the full email round trip, which the suite cannot do.
 */
export async function registerOwner(overrides = {}) {
  const { response, payload } = await registerUser(overrides);
  const user = await User.findOne({ email: payload.email }).select('_id name').lean();

  const membership = await ensurePersonalWorkspace({
    userId: user._id,
    name: payload.name ?? user.name,
  });

  return {
    response,
    payload,
    token: response.body.data.accessToken,
    user: response.body.data.user,
    workspaceId: membership.workspaceId,
  };
}

/** Pulls the signed refresh cookie out of a Set-Cookie header for reuse. */
export function extractRefreshCookie(response) {
  const cookies = response.headers['set-cookie'] ?? [];
  const cookie = cookies.find((entry) => entry.startsWith('ls_refresh='));
  return cookie ? cookie.split(';')[0] : null;
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
