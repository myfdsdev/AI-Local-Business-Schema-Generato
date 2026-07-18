import { MongoMemoryServer } from 'mongodb-memory-server';

import { connectDatabase, disconnectDatabase, mongoose } from '../../src/config/database.js';

/**
 * Boots a real in-memory mongod and the real Express app, so tests exercise the
 * genuine stack — Mongoose models, middleware, error handling — against actual
 * MongoDB, not stubs. This is the same code path that runs against Atlas in
 * production; only the connection string differs.
 */
let mongoServer = null;
let app = null;

export async function startTestServer() {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri());

  // Imported after the DB connects so model index builds have a live connection.
  const { createApp } = await import('../../src/app.js');
  app = createApp();
  return app;
}

export function getApp() {
  if (!app) throw new Error('Call startTestServer() first.');
  return app;
}

export async function stopTestServer() {
  await disconnectDatabase();
  if (mongoServer) await mongoServer.stop();
  mongoServer = null;
  app = null;
}

/** Wipes every collection between tests so cases stay independent. */
export async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export { mongoose };
