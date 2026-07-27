import { env } from '../../config/env.js';

/**
 * Recognises which AI provider a pasted key belongs to from its shape, so the
 * user only ever has to paste the key — never pick a provider from a dropdown
 * and get it wrong.
 *
 * Patterns are deliberately loose on length (providers lengthen keys over time)
 * and strict on the prefix, which is the part they keep stable.
 */
const SIGNATURES = [
  {
    provider: 'gemini',
    label: 'Google Gemini',
    // Google API keys: "AIza" + 35 URL-safe chars.
    test: (key) => /^AIza[\w-]{30,}$/.test(key),
    defaultModel: () => env.GEMINI_MODEL,
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    // Classic "sk-…", project keys "sk-proj-…", service accounts "sk-svcacct-…".
    test: (key) => /^sk-[A-Za-z0-9_-]{20,}$/.test(key),
    defaultModel: () => env.OPENAI_MODEL,
  },
];

/**
 * Returns { provider, label, defaultModel } or null when nothing matches.
 * A null result is a user-facing "we don't recognise this key" — not a crash.
 */
export function detectProvider(rawKey) {
  const key = String(rawKey ?? '').trim();
  const match = SIGNATURES.find((signature) => signature.test(key));
  if (!match) return null;
  return { provider: match.provider, label: match.label, defaultModel: match.defaultModel() };
}

/** Human label for a stored provider slug. */
export function providerLabel(provider) {
  return SIGNATURES.find((signature) => signature.provider === provider)?.label ?? provider;
}

/**
 * Last 4 characters, for showing "which key is this" without revealing it.
 * Never store or return more than this.
 */
export function last4(rawKey) {
  const key = String(rawKey ?? '').trim();
  return key.slice(-4);
}

export default { detectProvider, providerLabel, last4 };
