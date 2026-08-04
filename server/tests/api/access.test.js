import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { Invitation, User, Workspace, WorkspaceMember } from '../../src/models/index.js';
import { hashToken } from '../../src/utils/tokens.js';
import { VALID_PASSWORD, authHeader, registerUser, seedPlans } from '../helpers/factories.js';
import { clearDatabase, getApp, startTestServer, stopTestServer } from '../helpers/testServer.js';

const CODE = 'test-admin-access-code';

/** Requests access through the real endpoint. */
function requestAccess(body) {
  return request(getApp()).post('/api/v1/access/request').send({ code: CODE, ...body });
}

/**
 * The suite sends no mail, so the emailed token can't be read from an inbox.
 * Substituting a known token against the stored digest also proves the token is
 * stored hashed rather than in plaintext.
 */
async function plantToken(raw) {
  await Invitation.updateOne({}, { $set: { tokenHash: hashToken(raw) } });
  return raw;
}

describe('Admin access', () => {
  before(async () => {
    await startTestServer();
  });
  after(async () => {
    await stopTestServer();
  });
  beforeEach(async () => {
    await clearDatabase();
    await seedPlans();
    process.env.ADMIN_ACCESS_CODE = CODE;
  });

  it('signing up creates NO workspace and blocks the app', async () => {
    const { response } = await registerUser();
    const token = response.body.data.accessToken;

    assert.equal(await Workspace.countDocuments({}), 0, 'no workspace was created');

    // Every workspace-scoped route must refuse, not silently create one.
    const projects = await request(getApp()).get('/api/v1/projects').set(authHeader(token));
    assert.equal(projects.status, 403);
    assert.equal(projects.body.code, 'WORKSPACE_REQUIRED');

    const context = await request(getApp()).get('/api/v1/workspace').set(authHeader(token));
    assert.equal(context.status, 403);

    // Still no workspace after those calls — the old code created one lazily.
    assert.equal(await Workspace.countDocuments({}), 0);
  });

  it('rejects a wrong code WHEN a code is configured', async () => {
    const res = await request(getApp())
      .post('/api/v1/access/request')
      .send({ name: 'Nope', email: 'nope@example.com', code: 'wrong-code' });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ACCESS_CODE_INVALID');
    assert.equal(await Workspace.countDocuments({}), 0);
  });

  it('rejects a missing code WHEN a code is configured', async () => {
    const res = await request(getApp())
      .post('/api/v1/access/request')
      .send({ name: 'Nope', email: 'nope@example.com' });

    assert.equal(res.status, 403);
    assert.equal(await Workspace.countDocuments({}), 0);
  });

  it('is open to anyone when ADMIN_ACCESS_CODE is unset', async () => {
    // Deliberate: the page works with no code out of the box, and setting the
    // env var locks it later without a code change.
    delete process.env.ADMIN_ACCESS_CODE;

    const res = await request(getApp())
      .post('/api/v1/access/request')
      .send({ name: 'Open', email: 'open@example.com' });

    assert.equal(res.status, 200);
    assert.equal(await Workspace.countDocuments({}), 1);
  });

  it('creates a workspace shell and a hashed claim token', async () => {
    const res = await requestAccess({ name: 'Gourav', email: 'new@example.com' });
    assert.equal(res.status, 200);

    const workspace = await Workspace.findOne({}).lean();
    assert.ok(workspace, 'workspace created');
    assert.equal(workspace.ownerEmail, 'new@example.com');
    assert.equal(workspace.ownerUserId, null, 'unclaimed until the link is clicked');

    const invite = await Invitation.findOne({}).lean();
    assert.equal(invite.role, 'owner');
    assert.match(invite.tokenHash, /^[a-f0-9]{64}$/, 'token stored as a SHA-256 digest');

    // No user exists yet — clicking the link is what creates the account.
    assert.equal(await User.countDocuments({}), 0);
  });

  it('claiming the link creates the account, workspace owner, and a working password', async () => {
    await requestAccess({ name: 'Gourav', email: 'claim@example.com' });
    const raw = await plantToken('known-claim-token-for-testing-only');

    const claim = await request(getApp()).post('/api/v1/access/claim').send({ token: raw });
    assert.equal(claim.status, 200);
    assert.ok(claim.body.data.accessToken, 'signed in immediately');
    assert.equal(claim.body.data.user.email, 'claim@example.com');

    // Owner membership exists and the workspace is claimed.
    const workspace = await Workspace.findOne({}).lean();
    assert.ok(workspace.ownerUserId, 'ownerUserId populated');
    const membership = await WorkspaceMember.findOne({}).lean();
    assert.equal(membership.role, 'owner');
    assert.equal(membership.status, 'active');

    // And the new session can actually reach a workspace-scoped route.
    const projects = await request(getApp())
      .get('/api/v1/projects')
      .set(authHeader(claim.body.data.accessToken));
    assert.equal(projects.status, 200);
  });

  it('grants a workspace to someone who already has an account, without changing their password', async () => {
    const { payload } = await registerUser();

    await requestAccess({ name: payload.name, email: payload.email });
    const raw = await plantToken('existing-user-claim-token-testing');

    const claim = await request(getApp()).post('/api/v1/access/claim').send({ token: raw });
    assert.equal(claim.status, 200);

    // Their ORIGINAL password still works — we must not silently reset it.
    const login = await request(getApp())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: VALID_PASSWORD });
    assert.equal(login.status, 200);

    // And they now own a workspace.
    const membership = await WorkspaceMember.findOne({}).lean();
    assert.equal(membership.role, 'owner');
  });

  it('never creates a second workspace for the same email', async () => {
    await requestAccess({ name: 'Gourav', email: 'once@example.com' });
    await requestAccess({ name: 'Gourav', email: 'once@example.com' });
    await requestAccess({ name: 'Gourav Again', email: 'ONCE@example.com' }); // case-insensitive

    assert.equal(await Workspace.countDocuments({}), 1, 'exactly one workspace');
  });

  it('refuses a second workspace once the user already owns one', async () => {
    await requestAccess({ name: 'Gourav', email: 'owner@example.com' });
    const raw = await plantToken('first-claim-token-for-testing-ok');
    await request(getApp()).post('/api/v1/access/claim').send({ token: raw });

    assert.equal(await Workspace.countDocuments({}), 1);

    // Asking again must not mint a second workspace for an existing owner.
    const again = await requestAccess({ name: 'Gourav', email: 'owner@example.com' });
    assert.equal(again.status, 200, 'same response — cannot be used to probe');
    assert.equal(await Workspace.countDocuments({}), 1, 'still exactly one');
  });

  it('refuses a claim token that has already been used', async () => {
    await requestAccess({ name: 'Gourav', email: 'reuse@example.com' });
    const raw = await plantToken('single-use-claim-token-for-tests');

    const first = await request(getApp()).post('/api/v1/access/claim').send({ token: raw });
    assert.equal(first.status, 200);

    const second = await request(getApp()).post('/api/v1/access/claim').send({ token: raw });
    assert.equal(second.status, 400);
    assert.equal(second.body.code, 'INVALID_TOKEN');
  });

  it('creates a workspace owner directly from the form, with no email step', async () => {
    const res = await request(getApp()).post('/api/v1/access/register').send({
      code: CODE,
      name: 'Gourav Suman',
      email: 'direct@example.com',
      password: 'Str0ngPassword!',
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.accessToken, 'signed in immediately');

    // Workspace, user and owner membership all exist.
    const workspace = await Workspace.findOne({}).lean();
    assert.ok(workspace.ownerUserId, 'ownerUserId populated');
    const membership = await WorkspaceMember.findOne({}).lean();
    assert.equal(membership.role, 'owner');

    // The chosen password works, and the session reaches a scoped route.
    const login = await request(getApp())
      .post('/api/v1/auth/login')
      .send({ email: 'direct@example.com', password: 'Str0ngPassword!' });
    assert.equal(login.status, 200);

    const projects = await request(getApp())
      .get('/api/v1/projects')
      .set(authHeader(res.body.data.accessToken));
    assert.equal(projects.status, 200);
  });

  it('refuses direct signup for an email that already has an account', async () => {
    // Otherwise anyone could take over an existing account by typing its email
    // here with a password of their choosing.
    const { payload } = await registerUser();

    const res = await request(getApp()).post('/api/v1/access/register').send({
      code: CODE,
      name: 'Impostor',
      email: payload.email,
      password: 'Att4ckerPassword!',
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'EMAIL_IN_USE');

    // The real owner's password is untouched.
    const login = await request(getApp())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: VALID_PASSWORD });
    assert.equal(login.status, 200);
  });

  it('enforces the password policy on direct signup', async () => {
    const res = await request(getApp())
      .post('/api/v1/access/register')
      .send({ code: CODE, name: 'Weak', email: 'weak@example.com', password: 'short' });

    assert.equal(res.status, 400);
    assert.equal(await Workspace.countDocuments({}), 0);
  });

  it('refuses a fabricated claim token', async () => {
    const res = await request(getApp())
      .post('/api/v1/access/claim')
      .send({ token: 'completely-made-up-token-value-xx' });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_TOKEN');
  });
});
