import axios from 'axios';

import { env } from '../../config/env.js';
import { ERROR_CODES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

/**
 * Google Gemini (Generative Language API) client over axios. Mirrors the OpenAI
 * client's contract so the callers stay provider-agnostic.
 *
 * The key travels in the `x-goog-api-key` header, never in the URL query string,
 * so it can't leak via logs or referrers.
 */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function isGeminiConfigured() {
  return Boolean(env.GEMINI_API_KEY);
}

/**
 * Core request. `json: true` forces a parseable JSON response (used by the
 * extraction/generation prompts); `json: false` returns prose, which is what the
 * assistant chat needs.
 */
async function geminiGenerate({ system, messages, temperature = 0, maxTokens = 1500, json }) {
  if (!isGeminiConfigured()) {
    throw new ApiError(503, 'AI is not configured on this server yet.', {
      code: 'AI_NOT_CONFIGURED',
      errors: [{ field: 'server', message: 'Set GEMINI_API_KEY to enable AI features.' }],
    });
  }

  const url = `${GEMINI_BASE}/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`;

  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens,
    // Disable "thinking" on 2.5 flash models. Thinking tokens count against
    // maxOutputTokens and can starve the actual output, truncating it.
    // (2.5-pro requires thinking; use a flash model, which is the default.)
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (json) generationConfig.responseMimeType = 'application/json';

  try {
    const response = await axios.post(
      url,
      {
        systemInstruction: { parts: [{ text: system }] },
        // Gemini names the assistant role "model".
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig,
      },
      {
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        timeout: 45_000,
      },
    );

    const candidate = response.data?.candidates?.[0];
    const content = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    if (!content) {
      const reason = candidate?.finishReason || response.data?.promptFeedback?.blockReason;
      throw new ApiError(502, 'The AI service returned no usable content.', {
        code: 'AI_EMPTY_RESPONSE',
        errors: reason ? [{ field: 'model', message: `finishReason: ${reason}` }] : [],
      });
    }

    return { content, model: env.GEMINI_MODEL, usage: response.data?.usageMetadata ?? null };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const status = error.response?.status;
    const providerError = error.response?.data?.error;
    const providerMessage = providerError?.message;
    const reason = providerError?.details?.find((detail) => detail.reason)?.reason;

    logger.error('Gemini request failed', { status, reason, message: error.message, providerMessage });

    const isAuth =
      status === 403 ||
      reason === 'API_KEY_INVALID' ||
      (status === 400 && /api key/i.test(providerMessage ?? ''));

    if (isAuth) {
      throw new ApiError(502, 'The AI service rejected the configured API key.', {
        code: 'AI_AUTH_FAILED',
        errors: providerMessage ? [{ field: 'GEMINI_API_KEY', message: providerMessage }] : [],
      });
    }
    if (status === 429) {
      throw new ApiError(503, 'The AI service is rate limited right now. Please try again shortly.', {
        code: ERROR_CODES.RATE_LIMITED,
      });
    }
    if (status === 404) {
      throw new ApiError(502, `The AI model "${env.GEMINI_MODEL}" was not found for this key.`, {
        code: 'AI_MODEL_NOT_FOUND',
        errors: [{ field: 'GEMINI_MODEL', message: providerMessage ?? 'Unknown model.' }],
      });
    }
    throw new ApiError(502, 'The AI service could not complete this request. Please try again.', {
      code: 'AI_REQUEST_FAILED',
      cause: error,
    });
  }
}

/** Single-turn call that must return parseable JSON. */
export function geminiChatJson({ system, user, temperature = 0, maxTokens = 1500 }) {
  return geminiGenerate({
    system,
    messages: [{ role: 'user', content: user }],
    temperature,
    maxTokens,
    json: true,
  });
}

/** Multi-turn conversational call returning prose. */
export function geminiChatText({ system, messages, temperature = 0.4, maxTokens = 1200 }) {
  return geminiGenerate({ system, messages, temperature, maxTokens, json: false });
}

export default { geminiChatJson, geminiChatText, isGeminiConfigured };
