import axios from 'axios';

import { env } from '../../config/env.js';
import { ERROR_CODES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

/**
 * Minimal OpenAI Chat Completions client over axios (the spec mandates axios
 * rather than the OpenAI SDK).
 *
 * Also serves every OpenAI-compatible provider (Groq, OpenRouter): they speak
 * the same wire format, so they only differ by `credential.baseUrl`.
 *
 * The key comes either from the calling workspace's own stored credential or
 * from server env — never from a request body — and is never returned to the
 * client.
 */
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export function isOpenaiConfigured() {
  return Boolean(env.OPENAI_API_KEY);
}

/**
 * Core request shared by the JSON and prose entry points. `json: true` forces a
 * syntactically valid JSON body, matching the extraction prompts' contract.
 */
async function openaiGenerate({ system, messages, temperature, maxTokens, json, credential }) {
  const apiKey = credential?.apiKey ?? env.OPENAI_API_KEY;
  const model = credential?.model || env.OPENAI_MODEL;
  const url = credential?.baseUrl ?? OPENAI_URL;
  // Named in error messages so a Groq/OpenRouter failure doesn't read "OpenAI".
  const label = credential?.providerLabel ?? 'OpenAI';

  if (!apiKey) {
    throw new ApiError(503, 'AI is not configured on this server yet.', {
      code: 'AI_NOT_CONFIGURED',
      errors: [{ field: 'server', message: 'Set OPENAI_API_KEY to enable AI features.' }],
    });
  }

  const body = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, ...messages],
  };
  if (json) body.response_format = { type: 'json_object' };

  try {
    const response = await axios.post(url, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 45_000,
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty completion from model.');

    return {
      content,
      model: response.data?.model ?? model,
      usage: response.data?.usage ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const status = error.response?.status;
    // Surface OpenAI's own error text in the server log to make key/model
    // problems diagnosable without guesswork.
    const providerMessage = error.response?.data?.error?.message;
    logger.error(`${label} request failed`, { status, message: error.message, providerMessage });

    if (status === 401) {
      throw new ApiError(502, 'The AI service rejected the configured API key.', {
        code: 'AI_AUTH_FAILED',
        errors: providerMessage ? [{ field: 'OPENAI_API_KEY', message: providerMessage }] : [],
      });
    }
    if (status === 429) {
      throw new ApiError(503, 'The AI service is rate limited right now. Please try again shortly.', {
        code: ERROR_CODES.RATE_LIMITED,
      });
    }
    if (status === 404) {
      throw new ApiError(502, `The AI model "${model}" was not found for this key.`, {
        code: 'AI_MODEL_NOT_FOUND',
        errors: [{ field: 'OPENAI_MODEL', message: providerMessage ?? 'Unknown model.' }],
      });
    }
    throw new ApiError(502, 'The AI service could not complete this request. Please try again.', {
      code: 'AI_REQUEST_FAILED',
      cause: error,
    });
  }
}

/** Single-turn call that must return parseable JSON. */
export function openaiChatJson({ system, user, temperature = 0, maxTokens = 1500, credential }) {
  return openaiGenerate({
    system,
    messages: [{ role: 'user', content: user }],
    temperature,
    maxTokens,
    json: true,
    credential,
  });
}

/** Multi-turn conversational call returning prose. */
export function openaiChatText({ system, messages, temperature = 0.4, maxTokens = 1200, credential }) {
  return openaiGenerate({ system, messages, temperature, maxTokens, json: false, credential });
}

export default { openaiChatJson, openaiChatText, isOpenaiConfigured };
