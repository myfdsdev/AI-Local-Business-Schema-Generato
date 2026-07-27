import { env } from '../../config/env.js';
import { resolveCredential } from '../workspace/apiKeyService.js';
import { isGeminiConfigured, geminiChatJson, geminiChatText } from './geminiClient.js';
import { isOpenaiConfigured, openaiChatJson, openaiChatText } from './openaiClient.js';

/**
 * Provider-agnostic entry point for AI generation. Every caller goes through
 * here rather than a specific provider, so adding a provider is a local change.
 *
 * Which provider runs is decided per call by the resolved credential: a
 * workspace that pasted its own OpenAI key uses OpenAI even when the platform
 * default is Gemini. Callers pass `workspaceId`; omitting it uses the platform
 * key (background jobs with no tenant context).
 *
 * Each provider client takes the same { system, user | messages, credential }
 * input and returns the same { content, model } output.
 */
const PROVIDERS = {
  openai: {
    chatJson: openaiChatJson,
    chatText: openaiChatText,
    isConfigured: isOpenaiConfigured,
    keyVar: 'OPENAI_API_KEY',
  },
  gemini: {
    chatJson: geminiChatJson,
    chatText: geminiChatText,
    isConfigured: isGeminiConfigured,
    keyVar: 'GEMINI_API_KEY',
  },
};

/** The platform-wide default provider (what a workspace gets with no key). */
export function activeProvider() {
  return env.AI_PROVIDER;
}

function platformProvider() {
  return PROVIDERS[env.AI_PROVIDER] ?? PROVIDERS.openai;
}

/** Whether the platform itself has a usable key configured. */
export function isAiConfigured() {
  return platformProvider().isConfigured();
}

/** Name of the env var that holds the active provider's key (for messages). */
export function activeKeyVar() {
  return platformProvider().keyVar;
}

/**
 * True when this workspace can run AI at all — either it brought its own key or
 * the platform has one.
 */
export async function isAiAvailableFor(workspaceId) {
  const credential = await resolveCredential(workspaceId);
  return Boolean(credential.apiKey);
}

/** Picks the client matching the credential's provider. */
async function dispatch(method, { workspaceId, ...args }) {
  const credential = await resolveCredential(workspaceId);
  const provider = PROVIDERS[credential.provider] ?? platformProvider();
  return provider[method]({ ...args, credential });
}

export function chatJson(args) {
  return dispatch('chatJson', args);
}

/** Multi-turn conversation returning prose (assistant chat). */
export function chatText(args) {
  return dispatch('chatText', args);
}

export default { chatJson, chatText, isAiConfigured, isAiAvailableFor, activeProvider, activeKeyVar };
