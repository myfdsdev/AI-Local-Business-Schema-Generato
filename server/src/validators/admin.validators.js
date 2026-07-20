import { z } from 'zod';

import { PLAN_SLUG_VALUES, PROJECT_STATUS_VALUES, ROLE_VALUES, USER_STATUS_VALUES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');

export const userIdSchema = z.object({ userId: objectId });
export const schemaTypeIdSchema = z.object({ schemaTypeId: objectId });

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(USER_STATUS_VALUES).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  search: z.string().trim().max(160).optional(),
});

export const listProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(PROJECT_STATUS_VALUES).optional(),
  search: z.string().trim().max(160).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const auditLogQuerySchema = paginationSchema.extend({
  action: z.string().trim().max(80).optional(),
  userId: objectId.optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  plan: z.enum(PLAN_SLUG_VALUES).optional(),
  companyName: z.string().trim().max(160).optional(),
});

export const suspendUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const adjustCreditsSchema = z.object({
  // Negative removes credits; zero is rejected as a no-op.
  amount: z.coerce.number().int().refine((value) => value !== 0, 'Enter a non-zero amount.'),
  reason: z.string().trim().min(3, 'Give a reason for this adjustment.').max(500),
});

const propertyDefinitionSchema = z.object({
  name: z.string().trim().min(1),
  label: z.string().trim().optional(),
  valueType: z
    .enum(['text', 'url', 'email', 'telephone', 'number', 'date', 'time', 'boolean', 'array', 'object'])
    .optional(),
  description: z.string().trim().max(500).optional(),
  expectedSchemaType: z.string().trim().optional(),
  group: z.enum(['required', 'recommended', 'advanced']).optional(),
  example: z.string().trim().optional(),
});

export const createSchemaTypeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  label: z.string().trim().min(2).max(120),
  parentType: z.string().trim().max(80).default('LocalBusiness'),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(80).optional(),
  requiredProperties: z.array(z.string().trim()).optional(),
  recommendedProperties: z.array(z.string().trim()).optional(),
  allowedProperties: z.array(z.string().trim()).optional(),
  propertyDefinitions: z.array(propertyDefinitionSchema).optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateSchemaTypeSchema = createSchemaTypeSchema.partial();
