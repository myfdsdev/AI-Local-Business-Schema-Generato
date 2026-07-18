import { z } from 'zod';

export const keywordFormSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter the business name.').max(200),
  category: z.string().trim().min(2, 'Enter the business category.').max(120),
  location: z.string().trim().max(160).optional(),
  website: z.string().trim().max(2048).optional(),
  services: z.string().trim().max(1000).optional(),
  seedKeywords: z.string().trim().max(1000).optional(),
});

export const contentFormSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter the business name.').max(200),
  category: z.string().trim().min(2, 'Enter the business category.').max(120),
  location: z.string().trim().max(160).optional(),
  pageType: z.enum(['homepage', 'service', 'about', 'contact', 'location', 'faq']),
  keywords: z.string().trim().min(2, 'Enter at least one target keyword.'),
  tone: z.enum(['professional', 'friendly', 'concise', 'persuasive']),
  details: z.string().trim().max(2000).optional(),
});

export const PAGE_TYPE_OPTIONS = [
  { value: 'homepage', label: 'Homepage' },
  { value: 'service', label: 'Service page' },
  { value: 'about', label: 'About page' },
  { value: 'contact', label: 'Contact page' },
  { value: 'location', label: 'Location page' },
  { value: 'faq', label: 'FAQ page' },
];

export const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'concise', label: 'Concise' },
  { value: 'persuasive', label: 'Persuasive' },
];

export const INTENT_VARIANT = {
  local: 'default',
  transactional: 'success',
  commercial: 'default',
  informational: 'secondary',
  navigational: 'secondary',
};

export const PRIORITY_VARIANT = { high: 'success', medium: 'secondary', low: 'outline' };
