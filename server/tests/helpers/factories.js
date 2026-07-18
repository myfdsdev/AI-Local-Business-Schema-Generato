import request from 'supertest';

import { Plan } from '../../src/models/index.js';
import { plans } from '../../src/seed/data/plans.js';
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

/** Pulls the signed refresh cookie out of a Set-Cookie header for reuse. */
export function extractRefreshCookie(response) {
  const cookies = response.headers['set-cookie'] ?? [];
  const cookie = cookies.find((entry) => entry.startsWith('ls_refresh='));
  return cookie ? cookie.split(';')[0] : null;
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
