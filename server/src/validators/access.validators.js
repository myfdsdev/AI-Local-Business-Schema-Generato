import { z } from 'zod';

export const requestAccessSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  // Optional ?code= from the link. Only required when ADMIN_ACCESS_CODE is
  // configured; the service decides, not this schema.
  code: z.string().trim().max(200).optional().default(''),
});

/** Direct signup on /join-admin — same password policy as normal registration. */
export const registerOwnerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(128)
    .refine((value) => /[a-zA-Z]/.test(value), 'Include at least one letter.')
    .refine((value) => /[0-9]/.test(value), 'Include at least one number.'),
  code: z.string().trim().max(200).optional().default(''),
});

export const claimAccessSchema = z.object({
  token: z.string().trim().min(10, 'This link is incomplete.').max(200),
});
