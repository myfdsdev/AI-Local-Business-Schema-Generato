import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { User } from '../../src/models/index.js';
import {
  VALID_PASSWORD,
  authHeader,
  extractRefreshCookie,
  registerUser,
  seedPlans,
  uniqueEmail,
} from '../helpers/factories.js';
import { clearDatabase, getApp, startTestServer, stopTestServer } from '../helpers/testServer.js';

describe('Authentication API', () => {
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

  describe('POST /auth/register', () => {
    it('creates an account, issues an access token and sets a refresh cookie', async () => {
      const { response, payload } = await registerUser();

      assert.equal(response.status, 201);
      assert.equal(response.body.success, true);
      assert.ok(response.body.data.accessToken, 'expected an access token');
      assert.equal(response.body.data.user.email, payload.email);
      assert.equal(response.body.data.user.emailVerified, false);
      // Refresh token must live in an HTTP-only cookie, never in the body.
      assert.ok(extractRefreshCookie(response), 'expected a refresh cookie');
      assert.equal(response.body.data.refreshToken, undefined);
    });

    it('never persists the plaintext password', async () => {
      const { payload } = await registerUser();
      const user = await User.findOne({ email: payload.email }).select('+passwordHash');

      assert.ok(user.passwordHash);
      assert.notEqual(user.passwordHash, VALID_PASSWORD);
      assert.match(user.passwordHash, /^\$2[aby]\$/); // bcrypt signature
    });

    it('grants initial scan credits and a free subscription', async () => {
      const { response } = await registerUser();
      assert.ok(response.body.data.user.scanCredits > 0);
    });

    it('rejects a duplicate email with 409', async () => {
      const email = uniqueEmail();
      await registerUser({ email });
      const { response } = await registerUser({ email });

      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'EMAIL_ALREADY_REGISTERED');
    });

    it('rejects a weak password with a validation error', async () => {
      const response = await request(getApp())
        .post('/api/v1/auth/register')
        .send({ name: 'Weak', email: uniqueEmail(), password: 'short' });

      assert.equal(response.status, 400);
      assert.equal(response.body.code, 'VALIDATION_ERROR');
      assert.ok(response.body.errors.some((error) => error.field === 'password'));
    });

    it('assigns the agency role for an SEO agency account type', async () => {
      const { response } = await registerUser({ accountType: 'seo_agency' });
      assert.equal(response.body.data.user.role, 'agency');
    });

    it('ignores an attempt to self-assign the admin role', async () => {
      const response = await request(getApp())
        .post('/api/v1/auth/register')
        .send({ name: 'Sneaky', email: uniqueEmail(), password: VALID_PASSWORD, role: 'admin' });

      assert.equal(response.status, 201);
      assert.equal(response.body.data.user.role, 'user');
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with correct credentials', async () => {
      const { payload } = await registerUser();
      const response = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: payload.email, password: payload.password });

      assert.equal(response.status, 200);
      assert.ok(response.body.data.accessToken);
      assert.ok(extractRefreshCookie(response));
    });

    it('rejects a wrong password with 401 and a generic message', async () => {
      const { payload } = await registerUser();
      const response = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: payload.email, password: 'WrongPassword9' });

      assert.equal(response.status, 401);
      assert.equal(response.body.code, 'INVALID_CREDENTIALS');
    });

    it('gives the same response for an unknown email (no user enumeration)', async () => {
      const response = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail(), password: VALID_PASSWORD });

      assert.equal(response.status, 401);
      assert.equal(response.body.code, 'INVALID_CREDENTIALS');
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user with a valid token', async () => {
      const { response: reg, payload } = await registerUser();
      const response = await request(getApp())
        .get('/api/v1/auth/me')
        .set(authHeader(reg.body.data.accessToken));

      assert.equal(response.status, 200);
      assert.equal(response.body.data.user.email, payload.email);
    });

    it('rejects a missing token with 401', async () => {
      const response = await request(getApp()).get('/api/v1/auth/me');
      assert.equal(response.status, 401);
      assert.equal(response.body.code, 'UNAUTHORIZED');
    });

    it('rejects a garbage token with 401', async () => {
      const response = await request(getApp())
        .get('/api/v1/auth/me')
        .set(authHeader('not-a-real-token'));
      assert.equal(response.status, 401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('exchanges a refresh cookie for a new access token', async () => {
      const { response: reg } = await registerUser();
      const cookie = extractRefreshCookie(reg);

      const response = await request(getApp()).post('/api/v1/auth/refresh').set('Cookie', cookie);

      assert.equal(response.status, 200);
      assert.ok(response.body.data.accessToken);
    });

    it('rejects a refresh with no cookie', async () => {
      const response = await request(getApp()).post('/api/v1/auth/refresh');
      assert.equal(response.status, 401);
      assert.equal(response.body.code, 'SESSION_EXPIRED');
    });
  });

  describe('Email verification', () => {
    it('verifies with a valid token and rejects an invalid one', async () => {
      const { payload } = await registerUser();

      const user = await User.findOne({ email: payload.email }).select('+verificationToken');
      assert.ok(user.verificationToken, 'a verification token digest should be stored');

      const bad = await request(getApp())
        .post('/api/v1/auth/verify-email')
        .send({ token: 'invalid-token-value' });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.code, 'INVALID_TOKEN');
    });
  });

  describe('Password change invalidates other sessions', () => {
    it('bumps tokenVersion so old refresh tokens stop working', async () => {
      const { response: reg, payload } = await registerUser();
      const oldCookie = extractRefreshCookie(reg);

      const changed = await request(getApp())
        .put('/api/v1/auth/change-password')
        .set(authHeader(reg.body.data.accessToken))
        .send({ currentPassword: payload.password, newPassword: 'Br4ndNewPass!' });
      assert.equal(changed.status, 200);

      // The pre-change refresh cookie must no longer be accepted.
      const refreshOld = await request(getApp())
        .post('/api/v1/auth/refresh')
        .set('Cookie', oldCookie);
      assert.equal(refreshOld.status, 401);
    });
  });

  describe('DELETE /auth/account', () => {
    it('requires the correct password and then blocks sign-in', async () => {
      const { response: reg, payload } = await registerUser();

      const wrong = await request(getApp())
        .delete('/api/v1/auth/account')
        .set(authHeader(reg.body.data.accessToken))
        .send({ password: 'WrongPassword9' });
      assert.equal(wrong.status, 400);

      const deleted = await request(getApp())
        .delete('/api/v1/auth/account')
        .set(authHeader(reg.body.data.accessToken))
        .send({ password: payload.password });
      assert.equal(deleted.status, 200);

      const login = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: payload.email, password: payload.password });
      assert.equal(login.status, 401);
    });
  });
});
