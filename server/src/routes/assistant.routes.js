import { Router } from 'express';

import { z } from 'zod';

import { activeProvider, isAiAvailableFor } from '../services/ai/aiClient.js';
import { askAssistant } from '../services/ai/assistantService.js';
import { getWorkspaceKey } from '../services/workspace/apiKeyService.js';
import { authenticate, resolveWorkspace } from '../middleware/auth.js';
import { scanLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1, 'Message cannot be empty.').max(4000),
      }),
    )
    .min(1, 'Send at least one message.')
    .max(40),
});

const router = Router();

// Signed-in users only — this calls a paid AI backend. scanLimiter bounds the
// per-user rate for the same reason. resolveWorkspace attaches req.workspaceId
// so the tenant's own provider key is used when they have set one.
router.use(authenticate);
router.use(resolveWorkspace);

router.get(
  '/capabilities',
  asyncHandler(async (req, res) => {
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
  }),
);

router.post(
  '/chat',
  scanLimiter,
  validate({ body: chatSchema }),
  asyncHandler(async (req, res) => {
    if (!(await isAiAvailableFor(req.workspaceId))) {
      throw new ApiError(503, 'The assistant is not configured yet. Add your API key in Settings.', {
        code: 'AI_NOT_CONFIGURED',
      });
    }

    const result = await askAssistant({
      messages: req.body.messages,
      workspaceId: req.workspaceId,
    });
    return sendSuccess(res, { message: 'OK', data: result });
  }),
);

export default router;
