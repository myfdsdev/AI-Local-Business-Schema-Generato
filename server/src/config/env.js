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
  // Extra allowed browser origins beyond CLIENT_URL (comma-separated). Useful
  // when the dev server picks a different port, e.g. 5174/5175.
  CORS_ORIGINS: z.string().optional(),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Encrypts tenant-supplied secrets at rest (their own AI provider keys).
  // Generate with: openssl rand -base64 32
  // When unset it is derived from JWT_REFRESH_SECRET — see utils/secretBox.js.
  ENCRYPTION_KEY: z.string().optional(),

  // Platform-wide fallback AI provider, used by any workspace that has not set
  // its own key in Settings. Each provider has its own key + model; the active
  // one is selected by AI_PROVIDER. Workspaces may use ANY supported provider
  // regardless of this setting — see services/ai/providers.js.
  AI_PROVIDER: z.enum(['openai', 'gemini', 'anthropic', 'groq', 'openrouter']).default('openai'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o-mini'),

  // Product name used in email subjects and templates.
  APP_NAME: z.string().default('LocalSchema AI'),

  // Transactional email. 'none' disables sending: password-reset requests still
  // succeed (so they cannot be used to probe for accounts) but no mail goes out,
  // and in development the link is logged instead.
  EMAIL_PROVIDER: z.enum(['none', 'resend']).default('none'),
  RESEND_API_KEY: z.string().optional(),
  // Must be on a domain verified with the provider, e.g. "Support <hi@yourdomain.com>".
  EMAIL_FROM: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  DEMO_USER_EMAIL: z.string().email().optional(),
  DEMO_USER_PASSWORD: z.string().optional(),
  DEMO_AGENCY_EMAIL: z.string().email().optional(),
  DEMO_AGENCY_PASSWORD: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Shared secret the AppsFields hub sends on /platform/* calls. When unset,
  // those endpoints are disabled (this app runs standalone).
  PLATFORM_SECRET: z.string().optional(),

  // Gate on the self-service admin-access page. The link is the only thing
  // standing between a stranger and workspace ownership, so it is a rotatable
  // secret rather than an obscure URL. When unset the feature is DISABLED —
  // fail closed, like PLATFORM_SECRET.
  ADMIN_ACCESS_CODE: z.string().optional(),

  // Open signup: anyone can register and becomes the owner of their own new
  // workspace. Set to false for the hub-only model (accounts created only by
  // provisioning or team invites).
  ALLOW_PUBLIC_SIGNUP: bool(true),
});

const parsed = baseSchema.safeParse(process.env);

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
