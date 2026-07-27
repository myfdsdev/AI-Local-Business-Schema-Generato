import { env } from '../../config/env.js';
import { anthropicChatJson, anthropicChatText } from './anthropicClient.js';
import { geminiChatJson, geminiChatText } from './geminiClient.js';
import { openaiChatJson, openaiChatText } from './openaiClient.js';

/**
 * The LLM provider registry — the single source of truth for which providers
 * this app supports, how to recognise their keys, and how to call them.
 *
 * Adding a provider is one entry here (plus a client module if it does not
 * speak the OpenAI wire format). Everything else — key detection, encryption,
 * per-workspace isolation, the Settings UI — picks it up automatically.
 *
 * ORDER MATTERS. `detectProvider` returns the first match, so more specific key
 * prefixes must come before broader ones: "sk-ant-" and "sk-or-" are both also
 * matched by OpenAI's "sk-", so they are listed first.
 */
const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    // Claude keys: "sk-ant-api03-…".
    match: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    chatJson: anthropicChatJson,
    chatText: anthropicChatText,
    defaultModel: () => env.ANTHROPIC_MODEL,
    platformKey: () => env.ANTHROPIC_API_KEY,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    // OpenRouter keys: "sk-or-v1-…". OpenAI-compatible wire format.
    match: /^sk-or-[A-Za-z0-9_-]{20,}$/,
    chatJson: openaiChatJson,
    chatText: openaiChatText,
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: () => env.OPENROUTER_MODEL,
    platformKey: () => env.OPENROUTER_API_KEY,
  },
  {
    id: 'groq',
    label: 'Groq',
    // Groq keys: "gsk_…". OpenAI-compatible wire format.
    match: /^gsk_[A-Za-z0-9]{20,}$/,
    chatJson: openaiChatJson,
    chatText: openaiChatText,
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: () => env.GROQ_MODEL,
    platformKey: () => env.GROQ_API_KEY,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    // Google API keys: "AIza" + 35 URL-safe chars.
    match: /^AIza[\w-]{30,}$/,
    chatJson: geminiChatJson,
    chatText: geminiChatText,
    defaultModel: () => env.GEMINI_MODEL,
    platformKey: () => env.GEMINI_API_KEY,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    // Broadest "sk-" pattern — must stay last so the prefixes above win.
    match: /^sk-[A-Za-z0-9_-]{20,}$/,
    chatJson: openaiChatJson,
    chatText: openaiChatText,
    defaultModel: () => env.OPENAI_MODEL,
    platformKey: () => env.OPENAI_API_KEY,
  },
];

/** Every supported provider id — also the model's enum and the UI's list. */
export const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id);

/** Registry entry for an id, or undefined. */
export function getProvider(id) {
  return PROVIDERS.find((provider) => provider.id === id);
}

/** Human label for a stored provider id. */
export function providerLabel(id) {
  return getProvider(id)?.label ?? id;
}

/** What the Settings UI lists as supported, without leaking client internals. */
export function listProviders() {
  return PROVIDERS.map(({ id, label }) => ({ id, label }));
}

/**
 * Recognises which provider a pasted key belongs to from its shape, so the user
 * only ever pastes the key — they never pick a provider and get it wrong.
 * Returns null when nothing matches (a user-facing "unrecognised key", not a
 * crash).
 */
export function detectProvider(rawKey) {
  const key = String(rawKey ?? '').trim();
  const match = PROVIDERS.find((provider) => provider.match.test(key));
  if (!match) return null;
  return { provider: match.id, label: match.label, defaultModel: match.defaultModel() };
}

/**
 * Extra fields the provider's client needs beyond the key and model — today
 * just the base URL for the OpenAI-compatible providers.
 */
export function transportFor(id) {
  const provider = getProvider(id);
  return { baseUrl: provider?.baseUrl, providerLabel: provider?.label };
}

/**
 * Last 4 characters, for showing "which key is this" without revealing it.
 * Never store or return more than this.
 */
export function last4(rawKey) {
  return String(rawKey ?? '').trim().slice(-4);
}

export default { PROVIDER_IDS, getProvider, providerLabel, listProviders, detectProvider, last4 };
