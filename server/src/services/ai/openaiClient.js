import axios from 'axios';

import { env } from '../../config/env.js';
import { ERROR_CODES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

/**
 * Minimal OpenAI Chat Completions client over axios (the spec mandates axios
 * rather than the OpenAI SDK). Gated on OPENAI_API_KEY: when the key is absent
 * the feature reports itself as unconfigured instead of failing obscurely.
 *
 * The key is read from server env and never sent to or exposed on the client.
 */
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export function isAiConfigured() {
  return Boolean(env.OPENAI_API_KEY);
}

export async function chatJson({ system, user, temperature = 0, maxTokens = 1500 }) {
  if (!isAiConfigured()) {
    throw new ApiError(503, 'AI generation is not configured on this server yet.', {
      code: 'AI_NOT_CONFIGURED',
      errors: [{ field: 'server', message: 'Set OPENAI_API_KEY to enable AI generation.' }],
    });
  }

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: env.OPENAI_MODEL,
        temperature,
        max_tokens: maxTokens,
        // Forces syntactically valid JSON, matching the prompt's "parseable by
        // JSON.parse()" contract.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 45_000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty completion from model.');

    return {
      content,
      model: response.data?.model ?? env.OPENAI_MODEL,
      usage: response.data?.usage ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const status = error.response?.status;
    logger.error('OpenAI request failed', { status, message: error.message });

    if (status === 401) {
      throw new ApiError(502, 'The AI service rejected the configured API key.', { code: 'AI_AUTH_FAILED' });
    }
    if (status === 429) {
      throw new ApiError(503, 'The AI service is rate limited right now. Please try again shortly.', {
        code: ERROR_CODES.RATE_LIMITED,
      });
    }
    throw new ApiError(502, 'The AI service could not complete this request. Please try again.', {
      code: 'AI_REQUEST_FAILED',
      cause: error,
    });
  }
}

export default { chatJson, isAiConfigured };
