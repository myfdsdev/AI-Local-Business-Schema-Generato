import { z } from 'zod';

const addressSchema = z
  .object({
    streetAddress: z.string().trim().max(300).optional().default(''),
    addressLocality: z.string().trim().max(160).optional().default(''),
    addressRegion: z.string().trim().max(160).optional().default(''),
    postalCode: z.string().trim().max(40).optional().default(''),
    addressCountry: z.string().trim().max(2).optional().default(''),
  })
  .optional()
  .default({});

export const createLocationSchema = z.object({
  projectId: z.string().min(1, 'Choose a project.'),
  name: z.string().trim().min(2, 'Enter the location name.').max(200),
  pageUrl: z.string().trim().url('Enter the full public URL for this location.'),
  telephone: z.string().trim().max(40).optional().default(''),
  email: z.string().trim().max(160).optional().default(''),
  businessType: z.string().trim().max(80).optional().default('LocalBusiness'),
  address: addressSchema,
  active: z.boolean().optional().default(true),
});

export const updateLocationSchema = createLocationSchema.partial().omit({ projectId: true });
