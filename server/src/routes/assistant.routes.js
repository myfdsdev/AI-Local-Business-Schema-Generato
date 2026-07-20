import { Router } from 'express';

import { z } from 'zod';

import { activeProvider, isAiConfigured } from '../services/ai/aiClient.js';
import { askAssistant } from '../services/ai/assistantService.js';
import { authenticate } from '../middleware/auth.js';
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
// per-user rate for the same reason.
router.use(authenticate);

router.get(
  '/capabilities',
  asyncHandler(async (_req, res) =>
    sendSuccess(res, {
      message: 'OK',
      data: { aiConfigured: isAiConfigured(), aiProvider: activeProvider() },
    }),
  ),
);

router.post(
  '/chat',
  scanLimiter,
  validate({ body: chatSchema }),
  asyncHandler(async (req, res) => {
    if (!isAiConfigured()) {
      throw new ApiError(503, 'The assistant is not configured on this server yet.', {
        code: 'AI_NOT_CONFIGURED',
      });
    }

    const result = await askAssistant({ messages: req.body.messages });
    return sendSuccess(res, { message: 'OK', data: result });
  }),
);

export default router;
