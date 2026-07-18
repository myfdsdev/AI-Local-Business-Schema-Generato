import { z } from 'zod';

import {
  ACCOUNT_TYPE_VALUES,
  ONBOARDING_BUSINESS_CATEGORIES,
  ONBOARDING_EXPERIENCE_LEVELS,
  ONBOARDING_GOAL_VALUES,
  ONBOARDING_LOCATION_BANDS,
} from '../config/constants.js';

/**
 * Password policy: length is the dominant factor in resistance to guessing, so
 * a 10-character floor is required and composition rules are kept light rather
 * than pushing people toward "Password1!" patterns.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Use no more than 128 characters.')
  .refine((value) => /[a-zA-Z]/.test(value), 'Include at least one letter.')
  .refine((value) => /[0-9]/.test(value), 'Include at least one number.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().trim().max(160).optional().default(''),
  accountType: z.enum(ACCOUNT_TYPE_VALUES).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  // Not `passwordSchema`: sign-in must accept whatever was set previously,
  // including passwords created before any policy change.
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10, 'This verification link is invalid.'),
});

export const resendVerificationSchema = z.object({ email: emailSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'This reset link is invalid.'),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one.',
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  companyName: z.string().trim().max(160).optional(),
  profileImage: z.string().url('Enter a valid image URL.').or(z.literal('')).optional(),
  accountType: z.enum(ACCOUNT_TYPE_VALUES).optional(),
});

export const onboardingSchema = z.object({
  accountType: z.enum(ACCOUNT_TYPE_VALUES).optional(),
  companyName: z.string().trim().max(160).optional(),
  goal: z.enum(ONBOARDING_GOAL_VALUES).optional(),
  businessCategory: z.enum(ONBOARDING_BUSINESS_CATEGORIES).optional(),
  locationCount: z.enum(ONBOARDING_LOCATION_BANDS).optional(),
  experienceLevel: z.enum(ONBOARDING_EXPERIENCE_LEVELS).optional(),
  // Sent when the user skips the questionnaire; still marks it done so it stops
  // showing on every login.
  skipped: z.boolean().optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm.'),
});
