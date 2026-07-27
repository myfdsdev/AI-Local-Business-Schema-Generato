import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { authHeader, registerUser, seedPlans } from '../helpers/factories.js';
import { clearDatabase, getApp, startTestServer, stopTestServer } from '../helpers/testServer.js';

async function verifiedUser(overrides = {}) {
  const { response } = await registerUser(overrides);
  return { token: response.body.data.accessToken, user: response.body.data.user };
}

const PROJECT = {
  projectName: 'Bella Vista',
  websiteUrl: 'https://bella-vista.example',
  businessName: 'Bella Vista Trattoria',
  businessType: 'Restaurant',
  country: 'US',
};

const LOCATION = {
  name: 'Downtown branch',
  pageUrl: 'https://bella-vista.example/locations/downtown',
  telephone: '+1 512 555 0100',
  address: { streetAddress: '12 High St', addressLocality: 'Austin', addressRegion: 'TX' },
};

/** Creates a project for `token` and returns its id. */
async function makeProject(token, overrides = {}) {
  const res = await request(getApp())
    .post('/api/v1/projects')
    .set(authHeader(token))
    .send({ ...PROJECT, ...overrides });
  return res.body.data.project.id ?? res.body.data.project._id;
}

describe('Locations API', () => {
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

  it('creates a location under the caller’s project', async () => {
    const alice = await verifiedUser();
    const projectId = await makeProject(alice.token);

    const res = await request(getApp())
      .post('/api/v1/locations')
      .set(authHeader(alice.token))
      .send({ ...LOCATION, projectId });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.location.name, 'Downtown branch');
    assert.equal(res.body.data.location.slug, 'downtown-branch');
  });

  it('rejects a duplicate location name within the same project', async () => {
    const alice = await verifiedUser();
    const projectId = await makeProject(alice.token);
    const app = getApp();

    await request(app).post('/api/v1/locations').set(authHeader(alice.token)).send({ ...LOCATION, projectId });
    const dup = await request(app)
      .post('/api/v1/locations')
      .set(authHeader(alice.token))
      .send({ ...LOCATION, projectId, pageUrl: 'https://bella-vista.example/locations/downtown-2' });

    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, 'DUPLICATE_LOCATION');
  });

  it('lists only the caller’s own workspace locations', async () => {
    const alice = await verifiedUser();
    const bob = await verifiedUser();
    const app = getApp();

    const projectId = await makeProject(alice.token);
    await request(app).post('/api/v1/locations').set(authHeader(alice.token)).send({ ...LOCATION, projectId });

    const bobList = await request(app).get('/api/v1/locations').set(authHeader(bob.token));
    assert.equal(bobList.status, 200);
    assert.equal(bobList.body.data.locations.length, 0);

    const aliceList = await request(app).get('/api/v1/locations').set(authHeader(alice.token));
    assert.equal(aliceList.body.data.locations.length, 1);
  });

  it('will not attach a location to a project in another workspace (404)', async () => {
    const alice = await verifiedUser();
    const bob = await verifiedUser();
    const app = getApp();

    // Bob owns a project; Alice must not be able to hang a location off it.
    const bobProject = await makeProject(bob.token);

    const res = await request(app)
      .post('/api/v1/locations')
      .set(authHeader(alice.token))
      .send({ ...LOCATION, projectId: bobProject });

    assert.equal(res.status, 404);
  });

  it('returns 404 (not 403) when another workspace edits or deletes a location', async () => {
    const alice = await verifiedUser();
    const intruder = await verifiedUser();
    const app = getApp();

    const projectId = await makeProject(alice.token);
    const created = await request(app)
      .post('/api/v1/locations')
      .set(authHeader(alice.token))
      .send({ ...LOCATION, projectId });
    const locationId = created.body.data.location._id;

    const patch = await request(app)
      .patch(`/api/v1/locations/${locationId}`)
      .set(authHeader(intruder.token))
      .send({ name: 'Hijacked' });
    assert.equal(patch.status, 404);

    const del = await request(app)
      .delete(`/api/v1/locations/${locationId}`)
      .set(authHeader(intruder.token));
    assert.equal(del.status, 404);

    // Untouched for its real owner.
    const stillThere = await request(app).get('/api/v1/locations').set(authHeader(alice.token));
    assert.equal(stillThere.body.data.locations.length, 1);
    assert.equal(stillThere.body.data.locations[0].name, 'Downtown branch');
  });

  it('updates and deletes a location for its owner', async () => {
    const alice = await verifiedUser();
    const app = getApp();

    const projectId = await makeProject(alice.token);
    const created = await request(app)
      .post('/api/v1/locations')
      .set(authHeader(alice.token))
      .send({ ...LOCATION, projectId });
    const locationId = created.body.data.location._id;

    const patch = await request(app)
      .patch(`/api/v1/locations/${locationId}`)
      .set(authHeader(alice.token))
      .send({ name: 'Uptown branch', active: false });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.data.location.name, 'Uptown branch');
    assert.equal(patch.body.data.location.slug, 'uptown-branch');
    assert.equal(patch.body.data.location.active, false);

    const del = await request(app)
      .delete(`/api/v1/locations/${locationId}`)
      .set(authHeader(alice.token));
    assert.equal(del.status, 200);

    const list = await request(app).get('/api/v1/locations').set(authHeader(alice.token));
    assert.equal(list.body.data.locations.length, 0);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(getApp()).get('/api/v1/locations');
    assert.equal(res.status, 401);
  });
});
