import { z } from 'zod';

// --- Request bodies ---------------------------------------------------------

export const keywordRequestSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter the business name.').max(200),
  category: z.string().trim().min(2, 'Enter the business category.').max(120),
  location: z.string().trim().max(160).optional().default(''),
  services: z.string().trim().max(1000).optional().default(''),
  language: z.string().trim().min(2).max(10).optional().default('en'),
});

export const PAGE_TYPES = ['homepage', 'service', 'about', 'contact', 'location', 'faq'];

export const contentRequestSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter the business name.').max(200),
  category: z.string().trim().min(2, 'Enter the business category.').max(120),
  location: z.string().trim().max(160).optional().default(''),
  pageType: z.enum(PAGE_TYPES).default('homepage'),
  // Keywords the copy should target — accepted as an array or comma-separated.
  keywords: z
    .union([z.array(z.string().trim()), z.string()])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split(','))
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 25),
    )
    .refine((list) => list.length > 0, 'Provide at least one target keyword.'),
  details: z.string().trim().max(2000).optional().default(''),
  tone: z.enum(['professional', 'friendly', 'concise', 'persuasive']).optional().default('professional'),
});

// --- AI response shapes (spec: validate every AI response with Zod) ---------

const INTENTS = ['informational', 'commercial', 'transactional', 'local', 'navigational'];

export const keywordResponseSchema = z.object({
  keywords: z
    .array(
      z.object({
        keyword: z.string().trim().min(1).max(120),
        intent: z
          .string()
          .transform((value) => value.toLowerCase())
          .pipe(z.enum(INTENTS))
          .catch('commercial'),
        theme: z.string().trim().max(60).catch('general'),
        priority: z
          .string()
          .transform((value) => value.toLowerCase())
          .pipe(z.enum(['high', 'medium', 'low']))
          .catch('medium'),
        rationale: z.string().trim().max(300).optional().default(''),
      }),
    )
    .min(1, 'The model returned no keywords.')
    .max(60),
});

export const contentResponseSchema = z.object({
  metaTitle: z.string().trim().min(1).max(120),
  metaDescription: z.string().trim().min(1).max(320),
  h1: z.string().trim().min(1).max(160),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1, 'The model returned no content sections.')
    .max(12),
  keywordsUsed: z.array(z.string().trim()).optional().default([]),
});
