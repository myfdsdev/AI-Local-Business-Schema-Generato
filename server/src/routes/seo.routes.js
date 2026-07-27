import { Router } from 'express';

import * as seoController from '../controllers/seoController.js';
import { authenticate, resolveWorkspace } from '../middleware/auth.js';
import { scanLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { contentRequestSchema, keywordRequestSchema } from '../validators/seo.validators.js';

const router = Router();

// Signed-in users only: these call a paid AI backend. scanLimiter bounds the
// per-user rate for the same reason. resolveWorkspace attaches req.workspaceId
// so each tenant spends its own provider key when it has set one.
router.use(authenticate);
router.use(resolveWorkspace);

router.get('/capabilities', seoController.capabilities);
router.post('/keywords', scanLimiter, validate({ body: keywordRequestSchema }), seoController.keywords);
router.post('/content', scanLimiter, validate({ body: contentRequestSchema }), seoController.content);

export default router;
