import { z } from 'zod';

// Mirrors server/src/validators/location.validators.js so the form fails fast
// before hitting the API, and the two never drift.
const addressSchema = z.object({
  streetAddress: z.string().trim().max(300).optional().default(''),
  addressLocality: z.string().trim().max(160).optional().default(''),
  addressRegion: z.string().trim().max(160).optional().default(''),
  postalCode: z.string().trim().max(40).optional().default(''),
  addressCountry: z.string().trim().max(2, 'Use a 2-letter code, e.g. US.').optional().default(''),
});

export const locationFormSchema = z.object({
  projectId: z.string().min(1, 'Choose a project.'),
  name: z.string().trim().min(2, 'Enter the location name.').max(200),
  pageUrl: z.string().trim().url('Enter the full public URL for this location.'),
  telephone: z.string().trim().max(40).optional().default(''),
  email: z.string().trim().max(160).optional().default(''),
  businessType: z.string().trim().max(80).optional().default('LocalBusiness'),
  address: addressSchema,
  active: z.boolean().optional().default(true),
});

export const emptyLocation = {
  projectId: '',
  name: '',
  pageUrl: '',
  telephone: '',
  email: '',
  businessType: 'LocalBusiness',
  address: {
    streetAddress: '',
    addressLocality: '',
    addressRegion: '',
    postalCode: '',
    addressCountry: '',
  },
  active: true,
};
