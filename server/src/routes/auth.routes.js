import { Router } from 'express';

import * as authController from '../controllers/authController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { authLimiter, emailLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  onboardingSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../validators/auth.validators.js';

const router = Router();

// --- Public -----------------------------------------------------------------
router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', optionalAuthenticate, authController.logout);

router.post('/verify-email', validate({ body: verifyEmailSchema }), authController.verifyEmail);
router.post(
  '/resend-verification',
  emailLimiter,
  validate({ body: resendVerificationSchema }),
  authController.resendVerification,
);
router.post(
  '/forgot-password',
  emailLimiter,
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
router.put(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
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
