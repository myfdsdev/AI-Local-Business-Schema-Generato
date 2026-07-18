import { activeProvider, isAiConfigured } from '../services/ai/aiClient.js';
import { generateContent } from '../services/seo/contentService.js';
import { researchKeywords } from '../services/seo/keywordService.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/** Whether the SEO tools can run (they share the AI provider config). */
export const capabilities = asyncHandler(async (_req, res) =>
  sendSuccess(res, {
    message: 'OK',
    data: { aiConfigured: isAiConfigured(), aiProvider: activeProvider() },
  }),
);

export const keywords = asyncHandler(async (req, res) => {
  if (!isAiConfigured()) {
    throw new ApiError(503, 'AI is not configured on this server yet.', { code: 'AI_NOT_CONFIGURED' });
  }

  const result = await researchKeywords(req.body);
  return sendSuccess(res, { message: 'Keyword ideas generated.', data: result });
});

export const content = asyncHandler(async (req, res) => {
  if (!isAiConfigured()) {
    throw new ApiError(503, 'AI is not configured on this server yet.', { code: 'AI_NOT_CONFIGURED' });
  }

  const result = await generateContent(req.body);
  return sendSuccess(res, { message: 'Page content generated.', data: result });
});

export default { capabilities, keywords, content };
