import { z } from 'zod';

// Mirrors the server's password policy so the user sees the rule before submit.
const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Use no more than 128 characters.')
  .refine((value) => /[a-zA-Z]/.test(value), 'Include at least one letter.')
  .refine((value) => /[0-9]/.test(value), 'Include at least one number.');

export const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

// Business name and account type are collected during onboarding, so sign-up
// asks only for the essentials.
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password,
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Enter your email.').email('Enter a valid email address.'),
});

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'local_business', label: 'Local business owner' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'seo_agency', label: 'SEO agency' },
  { value: 'web_developer', label: 'Web developer' },
  { value: 'marketing_consultant', label: 'Marketing consultant' },
];
