/**
 * Runs the real server against a throwaway in-memory MongoDB, seeded with plans
 * and schema types. Lets the full stack be exercised end-to-end without a
 * MongoDB install. NOT for production — data is discarded on exit.
 *
 *   node scripts/dev-memory.mjs
 */

// Env must be set before any module that reads it is imported, so the rest of
// the app is pulled in via dynamic import() below.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '5000';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-'.padEnd(48, 'x');
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-'.padEnd(48, 'y');
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-cookie-secret-'.padEnd(24, 'z');
process.env.EMAIL_ENABLED = 'false';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localschema.test';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin!Passw0rd';
process.env.DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'owner@localschema.test';
process.env.DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Owner!Passw0rd';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongo = await MongoMemoryServer.create({
  binary: { version: process.env.MONGOMS_VERSION || '7.0.24' },
  instance: { dbName: 'localschema' },
});
process.env.MONGODB_URI = mongo.getUri('localschema');

const { connectDatabase } = await import('../src/config/database.js');
const { createApp } = await import('../src/app.js');
const logger = (await import('../src/config/logger.js')).default;
const { Plan, SchemaType } = await import('../src/models/index.js');
const { plans } = await import('../src/seed/data/plans.js');
const { schemaTypes } = await import('../src/seed/data/schemaTypes.js');

await connectDatabase();

// Minimal seed so the pricing page and business-type picker have real data.
for (const plan of plans) await Plan.updateOne({ slug: plan.slug }, { $set: plan }, { upsert: true });
for (const type of schemaTypes) await SchemaType.updateOne({ name: type.name }, { $set: type }, { upsert: true });
logger.info(`Seeded ${plans.length} plans and ${schemaTypes.length} schema types (in-memory)`);

const app = createApp();
const server = app.listen(process.env.PORT, () => {
  logger.info(`[dev-memory] API + in-memory MongoDB ready on http://localhost:${process.env.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await mongo.stop();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
