import { z } from 'zod';

export const createProjectSchema = z.object({
  projectName: z.string().trim().min(2, 'Enter a project name.').max(160),
  websiteUrl: z
    .string()
    .trim()
    .min(4, 'Enter your website URL.')
    .refine(
      (value) => /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i.test(value),
      'Enter a valid public website URL, e.g. https://example.com.',
    ),
  businessName: z.string().trim().min(2, 'Enter the business name.').max(200),
  businessType: z.string().trim().min(1, 'Select a business type.'),
  country: z.string().trim().length(2, 'Select a country.'),
  language: z.string().trim().min(2).max(10).default('en'),
  cms: z.enum(
    ['wordpress', 'shopify', 'wix', 'webflow', 'squarespace', 'react', 'nextjs', 'custom_html', 'other'],
  ),
  locationMode: z.enum(['single', 'multi']),
});

export const CMS_OPTIONS = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'wix', label: 'Wix' },
  { value: 'webflow', label: 'Webflow' },
  { value: 'squarespace', label: 'Squarespace' },
  { value: 'react', label: 'React' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'custom_html', label: 'Custom HTML' },
  { value: 'other', label: 'Other' },
];

// A short list of common countries for the MVP picker. The stored value is the
// ISO 3166-1 alpha-2 code the backend expects.
export const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IE', label: 'Ireland' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'ZA', label: 'South Africa' },
];

export const LOCATION_MODE_OPTIONS = [
  { value: 'single', label: 'Single location' },
  { value: 'multi', label: 'Multiple locations' },
];
