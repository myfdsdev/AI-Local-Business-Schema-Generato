import axios from 'axios';

import { env } from '../../config/env.js';
import { ERROR_CODES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

/**
 * Google Gemini (Generative Language API) client over axios. Mirrors the OpenAI
 * client's contract — same { system, user } in, same { content } out — so the
 * generation service is provider-agnostic.
 *
 * The key travels in the `x-goog-api-key` header, never in the URL query string,
 * so it can't leak via logs or referrers.
 */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function isGeminiConfigured() {
  return Boolean(env.GEMINI_API_KEY);
}

export async function geminiChatJson({ system, user, temperature = 0, maxTokens = 1500 }) {
  if (!isGeminiConfigured()) {
    throw new ApiError(503, 'AI generation is not configured on this server yet.', {
      code: 'AI_NOT_CONFIGURED',
      errors: [{ field: 'server', message: 'Set GEMINI_API_KEY to enable AI generation.' }],
    });
  }

  const url = `${GEMINI_BASE}/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`;

  try {
    const response = await axios.post(
      url,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          // Forces syntactically valid JSON, matching the prompt's "parseable by
          // JSON.parse()" contract (Gemini's equivalent of response_format).
          responseMimeType: 'application/json',
          // Disable "thinking" on 2.5 flash models. Thinking tokens count
          // against maxOutputTokens, and for these structured extraction tasks
          // they add latency/cost and can starve the actual JSON output,
          // truncating it into unparseable text. (2.5-pro requires thinking; use
          // a flash model, which is the default.)
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      {
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        timeout: 45_000,
      },
    );

    const candidate = response.data?.candidates?.[0];
    const content = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    if (!content) {
      // A blocked prompt yields no text but a finishReason such as SAFETY.
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
    // Gemini flags a bad key as INVALID_ARGUMENT/API_KEY_INVALID or PERMISSION_DENIED.
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

export default { geminiChatJson, isGeminiConfigured };
