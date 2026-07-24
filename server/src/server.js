import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import logger from './config/logger.js';
import { recoverOrphanedScans } from './services/scan/crawlService.js';

async function start() {
  await connectDatabase();

  // Reconcile scans left mid-flight by a previous process before serving; a
  // failure here must not stop the server from starting.
  try {
    await recoverOrphanedScans();
  } catch (error) {
    logger.error('Could not recover orphaned scans', { message: error.message });
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`LocalSchema AI API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  /**
   * Stop accepting connections, let in-flight requests finish, then close the
   * database. The timer is a backstop for a request that never completes.
   */
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);

    const forceExit = setTimeout(() => {
      logger.error('Shutdown timed out; forcing exit');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async () => {
      await disconnectDatabase();
      clearTimeout(forceExit);
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // A rejection that reaches here means a bug escaped an error boundary. The
  // process is left in an unknown state, so log loudly and let the supervisor
  // restart it rather than continuing to serve traffic.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { message: error.message, stack: error.stack });
    process.exit(1);
  });
}

start().catch((error) => {
  logger.error('Failed to start server', { message: error.message, stack: error.stack });
  process.exit(1);
});
