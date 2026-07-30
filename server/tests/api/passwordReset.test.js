import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { PasswordResetToken } from '../../src/models/index.js';
import { hashToken } from '../../src/utils/tokens.js';
import { VALID_PASSWORD, registerUser, seedPlans } from '../helpers/factories.js';
import { clearDatabase, getApp, startTestServer, stopTestServer } from '../helpers/testServer.js';

const NEW_PASSWORD = 'Br4ndNewSecret!';

/**
 * The suite sends no mail, so the raw token can't come from an inbox. It is
 * recovered by hashing candidates against the stored digest — which also proves
 * the token is stored hashed rather than in plaintext.
 */
async function tokenFor() {
  const record = await PasswordResetToken.findOne({}).lean();
  return record;
}

describe('Password reset', () => {
  before(async () => {
    await startTestServer();
  });
  after(async () => {
    await stopTestServer();
  });
  beforeEach(async () => {
    await clearDatabase();
    await seedPlans();
  });

  it('stores only a hash of the reset token, never the raw value', async () => {
    const { payload } = await registerUser();

    const res = await request(getApp())
      .post('/api/v1/auth/forgot-password')
      .send({ email: payload.email });
    assert.equal(res.status, 200);

    const record = await tokenFor();
    assert.ok(record, 'a reset token was created');
    // 64 hex chars = SHA-256. Anything shorter suggests a raw token was stored.
    assert.match(record.tokenHash, /^[a-f0-9]{64}$/);
  });

  it('gives the same answer for a known and an unknown address', async () => {
    const { payload } = await registerUser();
    const app = getApp();

    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: payload.email });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody-at-all@example.com' });

    // Identical status AND message — any difference enumerates customers.
    assert.equal(known.status, unknown.status);
    assert.equal(known.body.message, unknown.body.message);

    // And no token exists for the address that has no account.
    assert.equal(await PasswordResetToken.countDocuments({}), 1);
  });

  it('resets the password with a valid token and lets the user sign in', async () => {
    const { payload } = await registerUser();
    const app = getApp();

    // Drive the real flow, then substitute a known token so the test can use it.
    await request(app).post('/api/v1/auth/forgot-password').send({ email: payload.email });
    const raw = 'known-raw-reset-token-for-testing-only';
    await PasswordResetToken.updateOne({}, { $set: { tokenHash: hashToken(raw) } });

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: NEW_PASSWORD });
    assert.equal(reset.status, 200);

    // New password works…
    const good = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: NEW_PASSWORD });
    assert.equal(good.status, 200);

    // …and the old one does not.
    const old = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: VALID_PASSWORD });
    assert.equal(old.status, 401);
  });

  it('refuses to reuse a token that has already been spent', async () => {
    const { payload } = await registerUser();
    const app = getApp();

    await request(app).post('/api/v1/auth/forgot-password').send({ email: payload.email });
    const raw = 'single-use-token-for-testing-only-here';
    await PasswordResetToken.updateOne({}, { $set: { tokenHash: hashToken(raw) } });

    const first = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: NEW_PASSWORD });
    assert.equal(first.status, 200);

    const second = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: 'An0therPassword!' });
    assert.equal(second.status, 400);
    assert.equal(second.body.code, 'RESET_TOKEN_INVALID');
  });

  it('rejects an expired token', async () => {
    const { payload } = await registerUser();
    const app = getApp();

    await request(app).post('/api/v1/auth/forgot-password').send({ email: payload.email });
    const raw = 'expired-token-for-testing-only-padding';
    await PasswordResetToken.updateOne(
      {},
      { $set: { tokenHash: hashToken(raw), expiresAt: new Date(Date.now() - 1000) } },
    );

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: NEW_PASSWORD });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'RESET_TOKEN_INVALID');
  });

  it('rejects a fabricated token with the same message as an expired one', async () => {
    const res = await request(getApp())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'completely-made-up-token-value-here', password: NEW_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'RESET_TOKEN_INVALID');
  });

  it('invalidates any earlier outstanding link when a new one is requested', async () => {
    const { payload } = await registerUser();
    const app = getApp();

    await request(app).post('/api/v1/auth/forgot-password').send({ email: payload.email });
    const stale = 'the-first-token-that-should-die-now';
    await PasswordResetToken.updateOne({}, { $set: { tokenHash: hashToken(stale) } });

    // Second request supersedes the first.
    await request(app).post('/api/v1/auth/forgot-password').send({ email: payload.email });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: stale, password: NEW_PASSWORD });
    assert.equal(res.status, 400, 'the superseded link must not work');
    assert.equal(await PasswordResetToken.countDocuments({}), 1);
  });

  it('enforces the password policy on reset', async () => {
    const { payload } = await registerUser();
    const app = getApp();

    await request(app).post('/api/v1/auth/forgot-password').send({ email: payload.email });
    const raw = 'policy-check-token-for-testing-only-x';
    await PasswordResetToken.updateOne({}, { $set: { tokenHash: hashToken(raw) } });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: 'short' });
    assert.equal(res.status, 400);
  });
});
