import { Router } from 'express';

import * as accessController from '../controllers/accessController.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  claimAccessSchema,
  registerOwnerSchema,
  requestAccessSchema,
} from '../validators/access.validators.js';

const router = Router();

// Public by necessity — the caller has no account yet. authLimiter is doing real
// work on both: without it the first is an email bomber and the second lets
// someone brute-force claim tokens.
// Direct signup — what /join-admin uses. Creates the account and signs them in.
router.post(
  '/register',
  authLimiter,
  validate({ body: registerOwnerSchema }),
  accessController.registerOwner,
);

// Email-link variant, kept for flows where the password can't be typed.
router.post(
  '/request',
  authLimiter,
  validate({ body: requestAccessSchema }),
  accessController.request,
);
router.post('/claim', authLimiter, validate({ body: claimAccessSchema }), accessController.claim);

export default router;
