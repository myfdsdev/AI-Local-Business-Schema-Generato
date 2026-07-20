import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { authHeader, registerUser, seedPlans } from '../helpers/factories.js';
import { clearDatabase, getApp, startTestServer, stopTestServer } from '../helpers/testServer.js';

/** Registers a user and returns their access token. */
async function verifiedUser(overrides = {}) {
  const { response } = await registerUser(overrides);
  return { token: response.body.data.accessToken, user: response.body.data.user };
}

const VALID_PROJECT = {
  projectName: 'Bella Vista',
  websiteUrl: 'https://bella-vista.example',
  businessName: 'Bella Vista Trattoria',
  businessType: 'Restaurant',
  country: 'US',
};

describe('Projects API', () => {
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

  describe('POST /projects', () => {
    it('creates a project for a verified user', async () => {
      const { token } = await verifiedUser();

      const response = await request(getApp())
        .post('/api/v1/projects')
        .set(authHeader(token))
        .send(VALID_PROJECT);

      assert.equal(response.status, 201);
      assert.equal(response.body.data.project.businessName, 'Bella Vista Trattoria');
      assert.equal(response.body.data.project.normalizedDomain, 'bella-vista.example');
    });

    it('rejects an unsafe (private IP) website URL', async () => {
      const { token } = await verifiedUser();

      const response = await request(getApp())
        .post('/api/v1/projects')
        .set(authHeader(token))
        .send({ ...VALID_PROJECT, websiteUrl: 'http://127.0.0.1/admin' });

      assert.equal(response.status, 400);
      assert.ok(['UNSAFE_WEBSITE_URL', 'INVALID_WEBSITE_URL', 'VALIDATION_ERROR'].includes(response.body.code));
    });

    it('rejects a duplicate project for the same domain', async () => {
      const { token } = await verifiedUser();
      const app = getApp();

      await request(app).post('/api/v1/projects').set(authHeader(token)).send(VALID_PROJECT);
      const dup = await request(app)
        .post('/api/v1/projects')
        .set(authHeader(token))
        .send({ ...VALID_PROJECT, projectName: 'Bella Vista Copy' });

      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_PROJECT');
    });

    it('enforces the free plan project limit', async () => {
      const { token } = await verifiedUser();
      const app = getApp();

      await request(app).post('/api/v1/projects').set(authHeader(token)).send(VALID_PROJECT);
      const second = await request(app)
        .post('/api/v1/projects')
        .set(authHeader(token))
        .send({ ...VALID_PROJECT, websiteUrl: 'https://another.example', projectName: 'Another' });

      assert.equal(second.status, 403);
      assert.equal(second.body.code, 'PROJECT_LIMIT_REACHED');
    });
  });

  describe('GET /projects', () => {
    it('lists only the caller’s own projects', async () => {
      const alice = await verifiedUser();
      const bob = await verifiedUser();
      const app = getApp();

      await request(app).post('/api/v1/projects').set(authHeader(alice.token)).send(VALID_PROJECT);

      const bobList = await request(app).get('/api/v1/projects').set(authHeader(bob.token));
      assert.equal(bobList.status, 200);
      assert.equal(bobList.body.data.projects.length, 0);

      const aliceList = await request(app).get('/api/v1/projects').set(authHeader(alice.token));
      assert.equal(aliceList.body.data.projects.length, 1);
    });
  });

  describe('Project ownership enforcement', () => {
    it('returns 404 (not 403) when another user reads a project they do not own', async () => {
      const owner = await verifiedUser();
      const intruder = await verifiedUser();
      const app = getApp();

      const created = await request(app)
        .post('/api/v1/projects')
        .set(authHeader(owner.token))
        .send(VALID_PROJECT);
      const projectId = created.body.data.project.id ?? created.body.data.project._id;

      const read = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set(authHeader(intruder.token));

      // 404 rather than 403 so IDs cannot be probed for existence.
      assert.equal(read.status, 404);
    });

    it('prevents a non-owner from deleting a project', async () => {
      const owner = await verifiedUser();
      const intruder = await verifiedUser();
      const app = getApp();

      const created = await request(app)
        .post('/api/v1/projects')
        .set(authHeader(owner.token))
        .send(VALID_PROJECT);
      const projectId = created.body.data.project.id ?? created.body.data.project._id;

      const del = await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .set(authHeader(intruder.token));
      assert.equal(del.status, 404);

      // The project must still exist for its owner.
      const stillThere = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set(authHeader(owner.token));
      assert.equal(stillThere.status, 200);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const response = await request(getApp()).get('/api/v1/projects');
      assert.equal(response.status, 401);
    });
  });

  describe('Archive and restore', () => {
    it('archives a project and frees the plan slot', async () => {
      const { token } = await verifiedUser();
      const app = getApp();

      const created = await request(app)
        .post('/api/v1/projects')
        .set(authHeader(token))
        .send(VALID_PROJECT);
      const projectId = created.body.data.project.id ?? created.body.data.project._id;

      const archived = await request(app)
        .post(`/api/v1/projects/${projectId}/archive`)
        .set(authHeader(token));
      assert.equal(archived.status, 200);

      // Archiving frees the free-plan slot, so a new project can be created.
      const another = await request(app)
        .post('/api/v1/projects')
        .set(authHeader(token))
        .send({ ...VALID_PROJECT, websiteUrl: 'https://second.example', projectName: 'Second' });
      assert.equal(another.status, 201);
    });
  });
});
