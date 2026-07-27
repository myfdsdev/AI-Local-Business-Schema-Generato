import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { WorkspaceApiKey } from '../../src/models/index.js';
import { resolveCredential } from '../../src/services/workspace/apiKeyService.js';
import { authHeader, registerUser, seedPlans } from '../helpers/factories.js';
import { clearDatabase, getApp, startTestServer, stopTestServer } from '../helpers/testServer.js';

// Realistic shapes, not real credentials — these never leave the test process.
const GEMINI_KEY = `AIza${'A1b2C3d4E5f6G7h8'.repeat(2)}xyzw`;
const OPENAI_KEY = `sk-proj-${'T3stK3yMaterial0'.repeat(3)}abcd`;

async function owner() {
  const { response } = await registerUser();
  return { token: response.body.data.accessToken };
}

/** Saves a key for the given token and returns the response. */
function saveKey(token, apiKey) {
  return request(getApp()).put('/api/v1/workspace/api-key').set(authHeader(token)).send({ apiKey });
}

describe('Workspace API keys', () => {
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

  it('detects the provider from the pasted key and never echoes the key back', async () => {
    const alice = await owner();

    const saved = await saveKey(alice.token, GEMINI_KEY);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.key.provider, 'gemini');
    assert.equal(saved.body.data.key.last4, GEMINI_KEY.slice(-4));

    // The full key must appear nowhere in the response body.
    assert.ok(!JSON.stringify(saved.body).includes(GEMINI_KEY), 'raw key leaked in response');

    const read = await request(getApp())
      .get('/api/v1/workspace/api-key')
      .set(authHeader(alice.token));
    assert.equal(read.status, 200);
    assert.equal(read.body.data.key.provider, 'gemini');
    assert.ok(!JSON.stringify(read.body).includes(GEMINI_KEY), 'raw key leaked on read');
  });

  it('recognises an OpenAI key without being told the provider', async () => {
    const alice = await owner();
    const saved = await saveKey(alice.token, OPENAI_KEY);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.key.provider, 'openai');
  });

  it('rejects a key whose format matches no provider', async () => {
    const alice = await owner();
    const saved = await saveKey(alice.token, 'not-a-real-api-key-at-all-here');
    assert.equal(saved.status, 400);
    assert.equal(saved.body.code, 'UNKNOWN_KEY_FORMAT');
  });

  it('stores the key encrypted, not in plaintext', async () => {
    const alice = await owner();
    await saveKey(alice.token, GEMINI_KEY);

    // Read the raw document, explicitly selecting the secret fields.
    const doc = await WorkspaceApiKey.findOne({}).select('+ciphertext +iv +tag').lean();
    assert.ok(doc, 'key document exists');
    assert.ok(!JSON.stringify(doc).includes(GEMINI_KEY), 'key stored in plaintext');
    assert.ok(doc.ciphertext && doc.iv && doc.tag, 'encryption envelope present');
  });

  it('isolates keys per workspace — B cannot see or use A’s key', async () => {
    const alice = await owner();
    const bob = await owner();

    await saveKey(alice.token, GEMINI_KEY);

    // Bob's workspace reports no key of its own.
    const bobRead = await request(getApp())
      .get('/api/v1/workspace/api-key')
      .set(authHeader(bob.token));
    assert.equal(bobRead.status, 200);
    assert.equal(bobRead.body.data.key, null);

    // And resolving a credential for each workspace yields different sources.
    const aliceWs = (await request(getApp()).get('/api/v1/workspace').set(authHeader(alice.token)))
      .body.data.workspaceId;
    const bobWs = (await request(getApp()).get('/api/v1/workspace').set(authHeader(bob.token)))
      .body.data.workspaceId;

    const aliceCred = await resolveCredential(aliceWs);
    const bobCred = await resolveCredential(bobWs);

    assert.equal(aliceCred.source, 'workspace');
    assert.equal(aliceCred.apiKey, GEMINI_KEY, 'A resolves to its own key');
    assert.equal(bobCred.source, 'platform', 'B falls back, never reaches A’s key');
    assert.notEqual(bobCred.apiKey, GEMINI_KEY);
  });

  it('replacing a key does not touch another workspace’s key', async () => {
    const alice = await owner();
    const bob = await owner();

    await saveKey(alice.token, GEMINI_KEY);
    await saveKey(bob.token, OPENAI_KEY);

    const aliceWs = (await request(getApp()).get('/api/v1/workspace').set(authHeader(alice.token)))
      .body.data.workspaceId;
    const bobWs = (await request(getApp()).get('/api/v1/workspace').set(authHeader(bob.token)))
      .body.data.workspaceId;

    assert.equal((await resolveCredential(aliceWs)).apiKey, GEMINI_KEY);
    assert.equal((await resolveCredential(bobWs)).apiKey, OPENAI_KEY);

    // Each workspace has exactly one key — the upsert is scoped, not global.
    assert.equal(await WorkspaceApiKey.countDocuments({}), 2);
  });

  it('deleting a key falls the workspace back to the platform key', async () => {
    const alice = await owner();
    await saveKey(alice.token, GEMINI_KEY);

    const del = await request(getApp())
      .delete('/api/v1/workspace/api-key')
      .set(authHeader(alice.token));
    assert.equal(del.status, 200);

    const workspaceId = (await request(getApp()).get('/api/v1/workspace').set(authHeader(alice.token)))
      .body.data.workspaceId;
    assert.equal((await resolveCredential(workspaceId)).source, 'platform');
  });

  it('a plain member cannot read, replace, or delete the workspace key', async () => {
    const alice = await owner();
    const app = getApp();
    await saveKey(alice.token, GEMINI_KEY);

    // Invite a member into Alice's workspace.
    const invite = await request(app)
      .post('/api/v1/workspace/invite')
      .set(authHeader(alice.token))
      .send({ email: 'teammate@example.com', role: 'member' });
    const joinToken = invite.body.data.joinUrl.split('/join/')[1];
    const joined = await request(app)
      .post(`/api/v1/workspace/join/${joinToken}`)
      .send({ name: 'Teammate', password: 'Sup3rSecret!' });
    const memberToken = joined.body.data.accessToken;

    const read = await request(app).get('/api/v1/workspace/api-key').set(authHeader(memberToken));
    assert.equal(read.status, 403);

    const replace = await saveKey(memberToken, OPENAI_KEY);
    assert.equal(replace.status, 403);

    const del = await request(app)
      .delete('/api/v1/workspace/api-key')
      .set(authHeader(memberToken));
    assert.equal(del.status, 403);

    // Alice's key is untouched.
    const workspaceId = (await request(app).get('/api/v1/workspace').set(authHeader(alice.token)))
      .body.data.workspaceId;
    assert.equal((await resolveCredential(workspaceId)).apiKey, GEMINI_KEY);
  });

  it('requires authentication', async () => {
    const res = await request(getApp()).get('/api/v1/workspace/api-key');
    assert.equal(res.status, 401);
  });
});
