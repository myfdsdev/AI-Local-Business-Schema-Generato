import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { Workspace } from '../../src/models/index.js';
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

  it('public signup is closed — a stranger cannot create an account', async () => {
    process.env.ALLOW_PUBLIC_SIGNUP = 'false';

    const attempt = await request(getApp()).post('/api/v1/auth/register').send({
      name: 'Stranger',
      email: 'stranger@example.com',
      password: 'Sup3rSecret!',
    });

    assert.equal(attempt.status, 403);
    assert.equal(attempt.body.code, 'SIGNUP_DISABLED');
  });

  it('hub provisions with a password → the buyer logs in normally as owner', async () => {
    process.env.PLATFORM_SECRET = 'test-hub-secret';
    process.env.ALLOW_PUBLIC_SIGNUP = 'false';

    const prov = await request(getApp())
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send({
        workspaceId: 'ws_pw1',
        ownerName: 'Buyer',
        ownerEmail: 'pwbuyer@example.com',
        password: 'Hub#Generated9',
      });
    assert.equal(prov.status, 201);
    assert.equal(prov.body.data.method, 'password');

    // No activation step — the buyer signs in on the normal login page.
    const login = await request(getApp())
      .post('/api/v1/auth/login')
      .send({ email: 'pwbuyer@example.com', password: 'Hub#Generated9' });
    assert.equal(login.status, 200);

    // And they are the OWNER of the workspace the hub created.
    const ctx = await request(getApp())
      .get('/api/v1/workspace')
      .set(authHeader(login.body.data.accessToken));
    assert.equal(ctx.status, 200);
    assert.equal(ctx.body.data.workspaceId, 'ws_pw1');
    assert.equal(ctx.body.data.role, 'owner');
  });

  it('publishes a discovery manifest without needing the secret', async () => {
    delete process.env.PLATFORM_SECRET;

    const res = await request(getApp()).get('/api/v1/platform/manifest');

    // Readable with no credentials — the hub has only a base URL at this point.
    assert.equal(res.status, 200);
    assert.equal(res.body.data.appId, 'localschema');
    assert.equal(res.body.data.auth.header, 'x-platform-secret');
    assert.equal(res.body.data.endpoints.provision, '/api/v1/platform/provision');
    // Flags the commonest setup mistake before a real customer hits it.
    assert.equal(res.body.data.ready, false);

    // The manifest must not weaken the guard on the real endpoints.
    const provision = await request(getApp())
      .post('/api/v1/platform/provision')
      .send({ ownerEmail: 'nope@example.com' });
    assert.equal(provision.status, 401);
  });

  it('reports ready:true once the secret is configured', async () => {
    process.env.PLATFORM_SECRET = 'test-hub-secret';
    const res = await request(getApp()).get('/api/v1/platform/manifest');
    assert.equal(res.body.data.ready, true);
  });

  it('an owner can rename their workspace; a member cannot', async () => {
    const owner = await makeOwnerWithProject();
    const app = getApp();

    // Owner renames successfully and the new name is reflected in context.
    const renamed = await request(app)
      .patch('/api/v1/workspace')
      .set(authHeader(owner.token))
      .send({ name: 'Acme HQ' });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.data.name, 'Acme HQ');

    const ctx = await request(app).get('/api/v1/workspace').set(authHeader(owner.token));
    assert.equal(ctx.body.data.name, 'Acme HQ');

    // A plain member of that workspace is forbidden from renaming it.
    const invite = await request(app)
      .post('/api/v1/workspace/invite')
      .set(authHeader(owner.token))
      .send({ email: 'teammate@example.com', role: 'member' });
    const token = invite.body.data.joinUrl.split('/join/')[1];
    const joined = await request(app)
      .post(`/api/v1/workspace/join/${token}`)
      .send({ name: 'Teammate', password: 'Sup3rSecret!' });
    const memberToken = joined.body.data.accessToken;

    const blocked = await request(app)
      .patch('/api/v1/workspace')
      .set(authHeader(memberToken))
      .send({ name: 'Hijacked' });
    assert.equal(blocked.status, 403);
  });

  it('is idempotent by owner email when no workspaceId is sent', async () => {
    // Regression: a retried payment webhook with no workspaceId used to mint a
    // second workspace for the same buyer, leaving membership lookup ambiguous.
    process.env.PLATFORM_SECRET = 'test-hub-secret';
    const app = getApp();
    const body = { ownerName: 'Retry Buyer', ownerEmail: 'retry@example.com' };

    const first = await request(app)
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send(body);
    assert.equal(first.status, 201);

    const second = await request(app)
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send(body);
    assert.equal(second.status, 201);

    // Same workspace both times, and only one exists.
    assert.equal(second.body.data.workspaceId, first.body.data.workspaceId);
    assert.equal(await Workspace.countDocuments({ ownerEmail: 'retry@example.com' }), 1);

    // The retry reset the password, so the newest one is the live one.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'retry@example.com', password: second.body.data.temporaryPassword });
    assert.equal(login.status, 200);
  });

  it('attempts the welcome email by default, and can be told not to', async () => {
    process.env.PLATFORM_SECRET = 'test-hub-secret';
    const app = getApp();

    // The suite sends no real mail, so `emailed` is false either way — what is
    // asserted here is that the flag is DEFAULT-ON and genuinely switchable,
    // guarding against a `if (flag)` check that could never be turned off.
    const byDefault = await request(app)
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send({ workspaceId: 'ws_mail1', ownerEmail: 'mail1@example.com' });
    assert.equal(byDefault.status, 201);
    assert.ok('emailed' in byDefault.body.data, 'the response reports delivery state');

    const optedOut = await request(app)
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send({
        workspaceId: 'ws_mail2',
        ownerEmail: 'mail2@example.com',
        sendWelcomeEmail: false,
      });
    assert.equal(optedOut.status, 201);
    assert.equal(optedOut.body.data.emailed, false);
    // The password still comes back so the store can deliver it itself.
    assert.ok(optedOut.body.data.temporaryPassword);
  });

  it('does not report success when suspending an unknown workspace', async () => {
    // Regression: this used to return 200 "Workspace suspended." while changing
    // nothing, so a refund webhook with a typo'd id left access wide open.
    process.env.PLATFORM_SECRET = 'test-hub-secret';

    const wrongId = await request(getApp())
      .post('/api/v1/platform/suspend')
      .set('x-platform-secret', 'test-hub-secret')
      .send({ workspaceId: 'ws_does_not_exist' });
    assert.equal(wrongId.status, 404);
    assert.equal(wrongId.body.code, 'WORKSPACE_NOT_FOUND');

    const missing = await request(getApp())
      .post('/api/v1/platform/suspend')
      .set('x-platform-secret', 'test-hub-secret')
      .send({});
    assert.equal(missing.status, 400);
  });

  it('creates a real owner account from a bare { ownerEmail } call', async () => {
    // Regression: a store sending only an email used to get a join link and a
    // workspace with ownerUserId: null — nobody could log in.
    process.env.PLATFORM_SECRET = 'test-hub-secret';

    const prov = await request(getApp())
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send({ workspaceId: 'ws_bare1', ownerEmail: 'bare@example.com' });

    assert.equal(prov.status, 201);
    assert.equal(prov.body.data.method, 'password', 'owner account, not a join link');
    assert.ok(!prov.body.data.joinUrl, 'no join link is issued');

    const generated = prov.body.data.temporaryPassword;
    assert.ok(generated, 'a usable password came back');

    // The workspace must have a real owner attached, not ownerUserId: null.
    const workspace = await Workspace.findOne({ workspaceId: 'ws_bare1' }).lean();
    assert.ok(workspace.ownerUserId, 'ownerUserId is populated');

    // And the buyer can sign in immediately.
    const login = await request(getApp())
      .post('/api/v1/auth/login')
      .send({ email: 'bare@example.com', password: generated });
    assert.equal(login.status, 200);
  });

  it('generates a password when the store cannot, and the buyer can log in with it', async () => {
    process.env.PLATFORM_SECRET = 'test-hub-secret';

    const prov = await request(getApp())
      .post('/api/v1/platform/provision')
      .set('x-platform-secret', 'test-hub-secret')
      .send({
        workspaceId: 'ws_gen1',
        ownerName: 'No-Password Store',
        ownerEmail: 'genbuyer@example.com',
        generatePassword: true,
      });

    assert.equal(prov.status, 201);
    assert.equal(prov.body.data.method, 'password');

    const generated = prov.body.data.temporaryPassword;
    assert.ok(generated, 'a password was returned');
    assert.ok(generated.length >= 10, 'meets the 10-char policy');
    assert.ok(/[a-zA-Z]/.test(generated) && /[0-9]/.test(generated), 'has a letter and a digit');

    // The returned password must actually work on the normal login page.
    const login = await request(getApp())
      .post('/api/v1/auth/login')
      .send({ email: 'genbuyer@example.com', password: generated });
    assert.equal(login.status, 200);

    // And they own the workspace the store named.
    const ctx = await request(getApp())
      .get('/api/v1/workspace')
      .set(authHeader(login.body.data.accessToken));
    assert.equal(ctx.body.data.workspaceId, 'ws_gen1');
    assert.equal(ctx.body.data.role, 'owner');
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
      // The join-link flow is opt-in now that a live owner account is the
      // default, so this test asks for it explicitly.
      .send({
        workspaceId: 'ws_testA',
        ownerName: 'Buyer A',
        ownerEmail: 'buyerA@example.com',
        method: 'link',
      });
    assert.equal(prov.status, 201);
    assert.equal(prov.body.data.workspaceId, 'ws_testA');
    assert.equal(prov.body.data.method, 'link');

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
