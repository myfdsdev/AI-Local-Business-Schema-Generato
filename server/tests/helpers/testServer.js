import { MongoMemoryServer } from 'mongodb-memory-server';

import { connectDatabase, disconnectDatabase, mongoose } from '../../src/config/database.js';

/**
 * Boots one real in-memory MongoDB and the real Express app, so tests exercise
 * the genuine stack against actual MongoDB, not stubs — the same code path that
 * runs against Atlas in production; only the connection string differs.
 *
 * A single mongod is shared across every test file (kept on globalThis) and
 * stopped once at process exit. Launching a separate mongod per file crashes
 * with an `fassert` on Windows when several start in one run; sharing one avoids
 * that entirely. Test isolation instead comes from clearDatabase() between
 * tests. Run with `--test-isolation=none` so all files share this process.
 */

// Pin the mongod version: without it mongodb-memory-server resolves "latest"
// over the network on first use, which stalls in restricted environments.
const MONGOD_VERSION = process.env.MONGOMS_VERSION || '7.0.24';
const SHARED = Symbol.for('localschema.test.mongo');

let app = null;

async function startMongo(attempt = 1) {
  try {
    return await MongoMemoryServer.create({ binary: { version: MONGOD_VERSION } });
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    return startMongo(attempt + 1);
  }
}

async function getSharedServer() {
  if (globalThis[SHARED]) return globalThis[SHARED];
  const server = await startMongo();
  globalThis[SHARED] = server;
  return server;
}

/**
 * Stops the shared mongod. Called once from a top-level after() in the test
 * entry file (tests/index.test.js) rather than on process 'beforeExit', which
 * can hang an async teardown.
 */
export async function stopSharedServer() {
  const server = globalThis[SHARED];
  if (!server) return;
  try {
    await disconnectDatabase();
    await server.stop();
  } finally {
    globalThis[SHARED] = null;
  }
}

export async function startTestServer() {
  const server = await getSharedServer();
  await connectDatabase(server.getUri('localschema_test'));

  const { createApp } = await import('../../src/app.js');
  app = createApp();
  return app;
}

export function getApp() {
  if (!app) throw new Error('Call startTestServer() first.');
  return app;
}

/**
 * Per-file teardown. The shared mongod is intentionally left running for other
 * files; it is stopped once at process exit. Kept as a no-op so existing
 * after() hooks remain valid.
 */
export async function stopTestServer() {
  // Intentionally does not stop the shared server.
}

/** Wipes every collection between tests so cases stay independent. */
export async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export { mongoose };
