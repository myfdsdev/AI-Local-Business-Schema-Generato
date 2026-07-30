import { Router } from 'express';

import * as authController from '../controllers/authController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  onboardingSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validators.js';

const router = Router();

// --- Public -----------------------------------------------------------------
router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', optionalAuthenticate, authController.logout);

// Password recovery. authLimiter is essential on both: the first would otherwise
// be an email-bombing tool, and the second a way to brute-force reset tokens.
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

// --- Authenticated ----------------------------------------------------------
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, validate({ body: updateProfileSchema }), authController.updateProfile);
router.post(
  '/onboarding',
  authenticate,
  validate({ body: onboardingSchema }),
  authController.completeOnboarding,
);
router.delete(
  '/account',
  authenticate,
  validate({ body: deleteAccountSchema }),
  authController.deleteAccount,
);

export default router;
