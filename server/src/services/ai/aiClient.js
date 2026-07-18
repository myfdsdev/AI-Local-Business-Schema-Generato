import { env } from '../../config/env.js';
import { isGeminiConfigured, geminiChatJson } from './geminiClient.js';
import { isOpenaiConfigured, openaiChatJson } from './openaiClient.js';

/**
 * Provider-agnostic entry point for AI generation. The active provider is
 * chosen by AI_PROVIDER; every caller (the schema generation service) goes
 * through here rather than a specific provider, so adding a provider is a local
 * change.
 *
 * Each provider client takes the same { system, user } input and returns the
 * same { content, model } output.
 */
const PROVIDERS = {
  openai: { chatJson: openaiChatJson, isConfigured: isOpenaiConfigured, keyVar: 'OPENAI_API_KEY' },
  gemini: { chatJson: geminiChatJson, isConfigured: isGeminiConfigured, keyVar: 'GEMINI_API_KEY' },
};

export function activeProvider() {
  return env.AI_PROVIDER;
}

function provider() {
  return PROVIDERS[env.AI_PROVIDER] ?? PROVIDERS.openai;
}

export function isAiConfigured() {
  return provider().isConfigured();
}

/** Name of the env var that holds the active provider's key (for messages). */
export function activeKeyVar() {
  return provider().keyVar;
}

export function chatJson(args) {
  return provider().chatJson(args);
}

export default { chatJson, isAiConfigured, activeProvider, activeKeyVar };
