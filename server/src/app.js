import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env, isProduction } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { sanitizeRequest } from './middleware/sanitize.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind a proxy (Render, Fly, nginx), req.ip must come from X-Forwarded-For
  // or every client looks like the proxy and rate limiting collapses to one
  // shared bucket. `1` trusts exactly one hop rather than anything upstream.
  if (isProduction) app.set('trust proxy', 1);

  app.disable('x-powered-by');

  app.use(requestId);

  app.use(
    helmet({
      // This process serves JSON only; the client is a separate origin.
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // Allowlist, not a wildcard: credentials:true and `origin: *` are mutually
  // exclusive, and the refresh cookie depends on credentialed requests.
  const allowedOrigins = new Set([env.CLIENT_URL]);
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: same-origin, curl, or a server-side call.
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86_400,
    }),
  );

  // Body size caps (spec section 23).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  app.use(sanitizeRequest);
  app.use('/api', generalLimiter);

  app.get('/health', (_req, res) => {
    res.json({ success: true, message: 'OK', data: { status: 'ok', uptime: process.uptime() } });
  });

  app.use('/api/v1', routes);

  // Must stay last: notFound turns unmatched routes into an ApiError, and
  // errorHandler is what renders every error as the standard envelope.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
