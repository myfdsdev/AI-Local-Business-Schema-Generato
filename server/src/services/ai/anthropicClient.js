import axios from 'axios';

import { env } from '../../config/env.js';
import { ERROR_CODES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

/**
 * Anthropic (Claude) Messages API client. Mirrors the other providers' contract
 * — same { system, messages, credential } in, same { content, model } out — so
 * callers stay provider-agnostic.
 *
 * Two things differ from the OpenAI-shaped providers and are handled here:
 * the system prompt is a top-level field rather than a message, and there is no
 * `response_format`, so JSON mode is forced by prefilling the assistant turn.
 */
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export function isAnthropicConfigured() {
  return Boolean(env.ANTHROPIC_API_KEY);
}

async function anthropicGenerate({ system, messages, temperature, maxTokens, json, credential }) {
  const apiKey = credential?.apiKey ?? env.ANTHROPIC_API_KEY;
  const model = credential?.model || env.ANTHROPIC_MODEL;

  if (!apiKey) {
    throw new ApiError(503, 'AI is not configured on this server yet.', {
      code: 'AI_NOT_CONFIGURED',
      errors: [{ field: 'server', message: 'Set ANTHROPIC_API_KEY to enable AI features.' }],
    });
  }

  const turns = messages.map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
  }));

  // Claude has no JSON response mode. Prefilling the assistant turn with "{"
  // constrains it to continue an object — the documented technique. The opening
  // brace is not echoed back, so it is prepended to the result below.
  if (json) turns.push({ role: 'assistant', content: '{' });

  try {
    const response = await axios.post(
      ANTHROPIC_URL,
      { model, max_tokens: maxTokens, temperature, system, messages: turns },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
        timeout: 45_000,
      },
    );

    const text = (response.data?.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');

    if (!text) {
      throw new ApiError(502, 'The AI service returned no usable content.', {
        code: 'AI_EMPTY_RESPONSE',
        errors: response.data?.stop_reason
          ? [{ field: 'model', message: `stop_reason: ${response.data.stop_reason}` }]
          : [],
      });
    }

    return {
      content: json ? `{${text}` : text,
      model: response.data?.model ?? model,
      usage: response.data?.usage ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const status = error.response?.status;
    const providerMessage = error.response?.data?.error?.message;
    logger.error('Anthropic request failed', { status, message: error.message, providerMessage });

    if (status === 401 || status === 403) {
      throw new ApiError(502, 'The AI service rejected the configured API key.', {
        code: 'AI_AUTH_FAILED',
        errors: providerMessage ? [{ field: 'ANTHROPIC_API_KEY', message: providerMessage }] : [],
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
        errors: [{ field: 'ANTHROPIC_MODEL', message: providerMessage ?? 'Unknown model.' }],
      });
    }
    throw new ApiError(502, 'The AI service could not complete this request. Please try again.', {
      code: 'AI_REQUEST_FAILED',
      cause: error,
    });
  }
}

/** Single-turn call that must return parseable JSON. */
export function anthropicChatJson({ system, user, temperature = 0, maxTokens = 1500, credential }) {
  return anthropicGenerate({
    system,
    messages: [{ role: 'user', content: user }],
    temperature,
    maxTokens,
    json: true,
    credential,
  });
}

/** Multi-turn conversational call returning prose. */
export function anthropicChatText({ system, messages, temperature = 0.4, maxTokens = 1200, credential }) {
  return anthropicGenerate({ system, messages, temperature, maxTokens, json: false, credential });
}

export default { anthropicChatJson, anthropicChatText, isAnthropicConfigured };
