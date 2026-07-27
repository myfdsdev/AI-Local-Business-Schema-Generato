import { activeProvider, isAiAvailableFor } from '../services/ai/aiClient.js';
import { getWorkspaceKey } from '../services/workspace/apiKeyService.js';
import { generateContent } from '../services/seo/contentService.js';
import { researchKeywords } from '../services/seo/keywordService.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Whether the SEO tools can run for THIS workspace — true if it brought its own
 * key or the platform has one configured.
 */
export const capabilities = asyncHandler(async (req, res) => {
  const [aiConfigured, workspaceKey] = await Promise.all([
    isAiAvailableFor(req.workspaceId),
    getWorkspaceKey(req.workspaceId),
  ]);

  return sendSuccess(res, {
    message: 'OK',
    data: {
      aiConfigured,
      aiProvider: workspaceKey?.provider ?? activeProvider(),
      usingOwnKey: Boolean(workspaceKey),
    },
  });
});

/** Shared guard: refuse early when no key is reachable for this workspace. */
async function assertAiAvailable(workspaceId) {
  if (!(await isAiAvailableFor(workspaceId))) {
    throw new ApiError(503, 'AI is not configured yet. Add your API key in Settings to enable it.', {
      code: 'AI_NOT_CONFIGURED',
    });
  }
}

export const keywords = asyncHandler(async (req, res) => {
  await assertAiAvailable(req.workspaceId);

  const result = await researchKeywords(req.body, { workspaceId: req.workspaceId });
  return sendSuccess(res, { message: 'Keyword ideas generated.', data: result });
});

export const content = asyncHandler(async (req, res) => {
  await assertAiAvailable(req.workspaceId);

  const result = await generateContent(req.body, { workspaceId: req.workspaceId });
  return sendSuccess(res, { message: 'Page content generated.', data: result });
});

export default { capabilities, keywords, content };
