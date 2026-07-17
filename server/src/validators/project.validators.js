import { z } from 'zod';

import { CMS_OPTIONS, LOCATION_MODE_VALUES, PROJECT_STATUS_VALUES } from '../config/constants.js';
import { isSafeUrl } from '../utils/url.js';

/**
 * URL validation runs the same SSRF checks the crawler will use, so a project
 * pointing at private infrastructure is rejected at creation rather than at
 * scan time (spec section 3, step 3: "Validate the URL before creating").
 */
export const websiteUrlSchema = z
  .string()
  .trim()
  .min(4, 'Enter your website URL.')
  .max(2048)
  .refine((value) => isSafeUrl(value), {
    message: 'Enter a valid public website URL, for example https://example.com.',
  });

export const countrySchema = z
  .string()
  .trim()
  .length(2, 'Select a country.')
  .toUpperCase();

export const createProjectSchema = z.object({
  projectName: z.string().trim().min(2, 'Enter a project name.').max(160),
  websiteUrl: websiteUrlSchema,
  businessName: z.string().trim().min(2, 'Enter the business name.').max(200),
  businessType: z.string().trim().max(80).default('LocalBusiness'),
  country: countrySchema,
  language: z.string().trim().min(2).max(10).default('en'),
  cms: z.enum(CMS_OPTIONS).default('other'),
  locationMode: z.enum(LOCATION_MODE_VALUES).default('single'),
});

export const updateProjectSchema = z.object({
  projectName: z.string().trim().min(2).max(160).optional(),
  websiteUrl: websiteUrlSchema.optional(),
  businessName: z.string().trim().min(2).max(200).optional(),
  businessType: z.string().trim().max(80).optional(),
  country: countrySchema.optional(),
  language: z.string().trim().min(2).max(10).optional(),
  cms: z.enum(CMS_OPTIONS).optional(),
  locationMode: z.enum(LOCATION_MODE_VALUES).optional(),
});

export const projectIdSchema = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid project id.'),
});

export const listProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(PROJECT_STATUS_VALUES).optional(),
  search: z.string().trim().max(160).optional(),
  sort: z.string().trim().max(40).optional(),
});
