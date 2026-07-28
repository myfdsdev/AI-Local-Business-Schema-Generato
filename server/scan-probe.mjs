// TEMPORARY diagnostic — boots the real app against an in-memory Mongo, then
// drives a real scan end-to-end and reports exactly where it stops.
process.env.NODE_ENV = 'test';
process.env.ALLOW_PUBLIC_SIGNUP = 'true';

import request from 'supertest';

import { startTestServer, getApp, stopSharedServer } from './tests/helpers/testServer.js';
import { seedPlans } from './tests/helpers/factories.js';

const TARGET = process.argv[2] || 'https://example.com';

const log = (...a) => console.log(...a);

try {
  await startTestServer();
  await seedPlans();
  const app = getApp();

  log('1. registering user...');
  const reg = await request(app).post('/api/v1/auth/register').send({
    name: 'Probe',
    email: `probe+${Date.now()}@example.com`,
    password: 'Sup3rSecret!',
    accountType: 'local_business',
  });
  log('   ->', reg.status, reg.status === 201 ? 'ok' : JSON.stringify(reg.body));
  const token = reg.body?.data?.accessToken;
  if (!token) throw new Error('no access token');

  log('2. creating project for', TARGET);
  const proj = await request(app)
    .post('/api/v1/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({
      projectName: 'Probe',
      websiteUrl: TARGET,
      businessName: 'Probe Business',
      businessType: 'LocalBusiness',
      country: 'US',
    });
  log('   ->', proj.status, proj.status === 201 ? 'ok' : JSON.stringify(proj.body));
  const projectId = proj.body?.data?.project?.id ?? proj.body?.data?.project?._id;
  if (!projectId) throw new Error('no project id');

  log('3. starting scan...');
  const start = await request(app)
    .post(`/api/v1/projects/${projectId}/scan`)
    .set('Authorization', `Bearer ${token}`);
  log('   ->', start.status, JSON.stringify(start.body).slice(0, 300));
  const scanId = start.body?.data?.scan?.id ?? start.body?.data?.scan?._id;
  if (!scanId) throw new Error('no scan id — scan never started');

  log('4. polling scan', scanId);
  let last = null;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await request(app)
      .get(`/api/v1/scans/${scanId}`)
      .set('Authorization', `Bearer ${token}`);
    const s = res.body?.data?.scan;
    if (!s) { log('   poll failed:', res.status, JSON.stringify(res.body).slice(0, 200)); break; }
    if (s.status !== last) { log(`   [${i * 2}s] status=${s.status} pages=${s.pagesScanned ?? 0}`); last = s.status; }
    if (s.status === 'completed' || s.status === 'failed') {
      log('');
      log('FINAL STATUS  :', s.status);
      log('robotsTxt     :', s.robotsTxtStatus);
      log('scannedPages  :', (s.scannedPages ?? []).length, '->',
        JSON.stringify((s.scannedPages ?? []).map((p) => p.url ?? p)).slice(0, 300));
      log('failedPages   :', JSON.stringify(s.failedPages ?? []).slice(0, 300));
      log('detectedSchema:', JSON.stringify(s.detectedSchemas ?? []).slice(0, 300));
      log('extractedData :', JSON.stringify(s.extractedBusinessData ?? null).slice(0, 400));
      log('error         :', s.error ?? s.errorMessage ?? '(none)');
      log('warnings      :', JSON.stringify(s.warnings ?? []).slice(0, 300));
      break;
    }
    if (i === 59) log('   TIMED OUT still', s.status);
  }
} catch (error) {
  log('PROBE ERROR:', error.message);
  log(error.stack?.split('\n').slice(0, 5).join('\n'));
} finally {
  await stopSharedServer();
  process.exit(0);
}
