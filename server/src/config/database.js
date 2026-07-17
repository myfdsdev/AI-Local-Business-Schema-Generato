import mongoose from 'mongoose';

import { env, isProduction } from './env.js';
import logger from './logger.js';

mongoose.set('strictQuery', true);

// Surface slow/looping queries in development instead of failing silently.
if (!isProduction) mongoose.set('debug', false);

let connection = null;

export async function connectDatabase(uri = env.MONGODB_URI) {
  if (connection) return connection;

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (error) => logger.error('MongoDB error', { message: error.message }));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  return connection;
}

export async function disconnectDatabase() {
  if (!connection) return;
  await mongoose.disconnect();
  connection = null;
}

export { mongoose };
