import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });

const bool = (defaultValue) =>
  z
    .enum(['true', 'false'])
    .default(String(defaultValue))
    .transform((value) => value === 'true');

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  EMAIL_ENABLED: bool(false),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('LocalSchema AI <no-reply@localschema.ai>'),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  DEMO_USER_EMAIL: z.string().email().optional(),
  DEMO_USER_PASSWORD: z.string().optional(),
  DEMO_AGENCY_EMAIL: z.string().email().optional(),
  DEMO_AGENCY_PASSWORD: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

/**
 * Feature-gated requirements: a variable is only mandatory once the feature that
 * consumes it is switched on. Keeps local setup to the "Required" block alone.
 */
const schema = baseSchema.superRefine((value, ctx) => {
  if (value.EMAIL_ENABLED) {
    for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']) {
      if (!value[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when EMAIL_ENABLED=true`,
        });
      }
    }
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(
    `\nInvalid server environment. Copy server/.env.example to server/.env and fix:\n${details}\n`,
  );
  process.exit(1);
}

export const env = Object.freeze(parsed.data);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';

export default env;
