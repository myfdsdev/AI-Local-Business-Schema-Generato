import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { authHeader, registerUser, seedPlans } from '../helpers/factories.js';
import { clearDatabase, getApp, startTestServer, stopTestServer } from '../helpers/testServer.js';

const PROJECT = {
  projectName: 'Bella Vista',
  websiteUrl: 'https://bella-vista.example',
  businessName: 'Bella Vista Trattoria',
  businessType: 'Restaurant',
  country: 'US',
};

async function makeOwnerWithProject(overrides = {}) {
  const { response } = await registerUser(overrides);
  const token = response.body.data.accessToken;
  const created = await request(getApp())
    .post('/api/v1/projects')
    .set(authHeader(token))
    .send(PROJECT);
  return { token, projectId: created.body.data.project?.id ?? created.body.data.project?._id };
}

describe('Workspace isolation', () => {
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

  it('gives each new user their own workspace and a project inside it', async () => {
    const { token, projectId } = await makeOwnerWithProject();
    assert.ok(projectId, 'project created');

    const list = await request(getApp()).get('/api/v1/projects').set(authHeader(token));
    assert.equal(list.status, 200);
    assert.equal(list.body.data.projects.length, 1);
  });

  it('Buyer B cannot see or open Buyer A’s project', async () => {
    const a = await makeOwnerWithProject();
    const b = await registerUser(); // separate workspace, no projects
    const bToken = b.response.body.data.accessToken;

    // B's list is empty — A's project is not visible.
    const bList = await request(getApp()).get('/api/v1/projects').set(authHeader(bToken));
    assert.equal(bList.body.data.projects.length, 0);

    // B opening A's project id → 404 (not 403), so ids can't be probed.
    const bOpen = await request(getApp())
      .get(`/api/v1/projects/${a.projectId}`)
      .set(authHeader(bToken));
    assert.equal(bOpen.status, 404);
  });

  it('an invited member joins the owner’s workspace and sees its projects', async () => {
    const owner = await makeOwnerWithProject();

    // Owner creates an invite link.
    const invite = await request(getApp())
      .post('/api/v1/workspace/invite')
      .set(authHeader(owner.token))
      .send({ email: 'teammate@example.com', role: 'member' });
    assert.equal(invite.status, 201);
    const token = invite.body.data.joinUrl.split('/join/')[1];
    assert.ok(token, 'join token present');

    // Teammate accepts → gets a session bound to the owner's workspace.
    const joined = await request(getApp())
      .post(`/api/v1/workspace/join/${token}`)
      .send({ name: 'Teammate', password: 'Sup3rSecret!' });
    assert.equal(joined.status, 200);
    const memberToken = joined.body.data.accessToken;

    // A member sees the workspace's projects but only their own; the owner's
    // project was created by the owner, so a plain member should NOT see it.
    const memberList = await request(getApp()).get('/api/v1/projects').set(authHeader(memberToken));
    assert.equal(memberList.status, 200);
    assert.equal(memberList.body.data.projects.length, 0, 'member sees only their own, none yet');

    // Owner still sees the workspace has one member added.
    const members = await request(getApp())
      .get('/api/v1/workspace/members')
      .set(authHeader(owner.token));
    assert.equal(members.status, 200);
    assert.equal(members.body.data.members.length, 2, 'owner + teammate');
  });

  it('workspace stats return totals and an 8-week series (owner only)', async () => {
    const owner = await makeOwnerWithProject();

    const stats = await request(getApp())
      .get('/api/v1/workspace/stats')
      .set(authHeader(owner.token));
    assert.equal(stats.status, 200);
    assert.equal(stats.body.data.totals.members, 1);
    assert.equal(stats.body.data.totals.projects, 1);
    assert.equal(stats.body.data.series.length, 8);
    // The current week bucket reflects the project just created.
    assert.equal(stats.body.data.series.at(-1).projects, 1);

    // A member cannot read workspace stats.
    const invite = await request(getApp())
      .post('/api/v1/workspace/invite')
      .set(authHeader(owner.token))
      .send({ role: 'member' });
    const token = invite.body.data.joinUrl.split('/join/')[1];
    const joined = await request(getApp())
      .post(`/api/v1/workspace/join/${token}`)
      .send({ name: 'M', password: 'Sup3rSecret!' });
    const denied = await request(getApp())
      .get('/api/v1/workspace/stats')
      .set(authHeader(joined.body.data.accessToken));
    assert.equal(denied.status, 403);
  });

  it('owner can change a member’s role (member → admin)', async () => {
    const owner = await makeOwnerWithProject();
    const invite = await request(getApp())
      .post('/api/v1/workspace/invite')
      .set(authHeader(owner.token))
      .send({ role: 'member' });
    const token = invite.body.data.joinUrl.split('/join/')[1];
    const joined = await request(getApp())
      .post(`/api/v1/workspace/join/${token}`)
      .send({ name: 'M', password: 'Sup3rSecret!' });
    const memberUserId = joined.body.data.user.id;

    const changed = await request(getApp())
      .patch(`/api/v1/workspace/members/${memberUserId}`)
      .set(authHeader(owner.token))
      .send({ role: 'admin' });
    assert.equal(changed.status, 200);

    // The member is now an admin — the roster reflects it.
    const list = await request(getApp())
      .get('/api/v1/workspace/members')
      .set(authHeader(owner.token));
    const row = list.body.data.members.find((m) => String(m.userId) === String(memberUserId));
    assert.equal(row.role, 'admin');

    // The owner's own role can't be changed this way.
    const ownerRow = list.body.data.members.find((m) => m.role === 'owner');
    const denied = await request(getApp())
      .patch(`/api/v1/workspace/members/${ownerRow.userId}`)
      .set(authHeader(owner.token))
      .send({ role: 'member' });
    assert.equal(denied.status, 403);
  });

  it('a member cannot access team management', async () => {
    const owner = await makeOwnerWithProject();
    const invite = await request(getApp())
      .post('/api/v1/workspace/invite')
      .set(authHeader(owner.token))
      .send({ role: 'member' });
    const token = invite.body.data.joinUrl.split('/join/')[1];
    const joined = await request(getApp())
      .post(`/api/v1/workspace/join/${token}`)
      .send({ name: 'M', password: 'Sup3rSecret!' });

    const denied = await request(getApp())
      .get('/api/v1/workspace/members')
      .set(authHeader(joined.body.data.accessToken));
    assert.equal(denied.status, 403);
  });

  it('rejects an invalid join token', async () => {
    const joined = await request(getApp())
      .post('/api/v1/workspace/join/not-a-real-token')
      .send({ name: 'X', password: 'Sup3rSecret!' });
    assert.equal(joined.status, 400);
  });

  it('rejects a /platform call without the hub secret', async () => {
    const res = await request(getApp())
      .post('/api/v1/platform/provision')
      .send({ ownerEmail: 'buyer@example.com', ownerName: 'Buyer' });
    assert.equal(res.status, 401);
  });

  it('hub provisions with a code → owner activates with email + code', async () => {
    process.env.PLATFORM_SECRET = 'test-hub-secret';

    const prov = await request(getApp())
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send({ workspaceId: 'ws_code1', ownerName: 'Coded', ownerEmail: 'coded@example.com', activationCode: '1234567' });
    assert.equal(prov.status, 201);
    assert.equal(prov.body.data.method, 'code');

    // Wrong code with the right email is rejected.
    const bad = await request(getApp())
      .post('/api/v1/workspace/activate')
      .send({ email: 'coded@example.com', code: '0000000', name: 'Coded', password: 'Sup3rSecret!' });
    assert.equal(bad.status, 400);

    // Correct email + code activates and logs the owner in.
    const ok = await request(getApp())
      .post('/api/v1/workspace/activate')
      .send({ email: 'coded@example.com', code: '1234567', name: 'Coded', password: 'Sup3rSecret!' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.accessToken);

    // They land as owner of their workspace.
    const list = await request(getApp())
      .get('/api/v1/projects')
      .set(authHeader(ok.body.data.accessToken));
    assert.equal(list.status, 200);
  });

  it('hub provisions a buyer → owner joins → suspend blocks access', async () => {
    process.env.PLATFORM_SECRET = 'test-hub-secret';

    const prov = await request(getApp())
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send({ workspaceId: 'ws_testA', ownerName: 'Buyer A', ownerEmail: 'buyerA@example.com' });
    assert.equal(prov.status, 201);
    assert.equal(prov.body.data.workspaceId, 'ws_testA');

    const token = prov.body.data.joinUrl.split('/join/')[1];
    const join = await request(getApp())
      .post(`/api/v1/workspace/join/${token}`)
      .send({ name: 'Buyer A', password: 'Sup3rSecret!' });
    assert.equal(join.status, 200);
    const ownerToken = join.body.data.accessToken;

    // Owner can use the app.
    const before = await request(getApp()).get('/api/v1/projects').set(authHeader(ownerToken));
    assert.equal(before.status, 200);

    // Hub suspends → the same owner is now blocked.
    await request(getApp())
      .post('/api/v1/platform/suspend')
      .set('x-platform-secret', 'test-hub-secret')
      .send({ workspaceId: 'ws_testA' });
    const after = await request(getApp()).get('/api/v1/projects').set(authHeader(ownerToken));
    assert.equal(after.status, 403);
  });
});
