import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { BusinessProject, User, WebsiteScan } from '../../src/models/index.js';
import { recoverOrphanedScans } from '../../src/services/scan/crawlService.js';
import { authHeader, registerUser, seedPlans } from '../helpers/factories.js';
import { clearDatabase, getApp, startTestServer, stopTestServer } from '../helpers/testServer.js';

const VALID_PROJECT = {
  projectName: 'Bella Vista',
  websiteUrl: 'https://bella-vista.example',
  businessName: 'Bella Vista Trattoria',
  businessType: 'Restaurant',
  country: 'US',
};

/** Reproduces what a crashed/restarted process leaves behind mid-scan. */
async function makeStuckScan() {
  const { response } = await registerUser();
  const token = response.body.data.accessToken;
  const userId = response.body.data.user.id;

  const created = await request(getApp())
    .post('/api/v1/projects')
    .set(authHeader(token))
    .send(VALID_PROJECT);
  assert.equal(created.status, 201, 'project should be created');
  const projectId = created.body.data.project.id ?? created.body.data.project._id;

  const creditsBefore = (await User.findById(userId)).scanCredits;

  // A running scan holding a reserved credit, with the project left "scanning".
  const scan = await WebsiteScan.create({
    projectId,
    userId,
    status: 'running',
    creditsReserved: 1,
    startedAt: new Date(Date.now() - 26 * 60 * 1000),
  });
  await BusinessProject.updateOne({ _id: projectId }, { status: 'scanning' });

  return { token, userId, projectId, scanId: scan._id, creditsBefore };
}

describe('Scan recovery', () => {
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

  it('clears an orphaned scan on startup, refunds the credit, resets the project', async () => {
    const { userId, projectId, scanId, creditsBefore } = await makeStuckScan();

    const recovered = await recoverOrphanedScans();
    assert.equal(recovered, 1);

    const scan = await WebsiteScan.findById(scanId);
    const project = await BusinessProject.findById(projectId);
    const creditsAfter = (await User.findById(userId)).scanCredits;

    assert.equal(scan.status, 'failed', 'orphan is failed, not left running');
    assert.equal(project.status, 'draft', 'project no longer stuck on "scanning"');
    assert.equal(creditsAfter, creditsBefore + 1, 'reserved credit is refunded');
  });

  it('a stale scan does not block starting a new one', async () => {
    const { token, projectId } = await makeStuckScan();

    // Without stale handling this would 409 SCAN_ALREADY_RUNNING forever.
    const started = await request(getApp())
      .post(`/api/v1/projects/${projectId}/scan`)
      .set(authHeader(token));

    assert.equal(started.status, 202, 'a fresh scan is accepted');
  });
});
