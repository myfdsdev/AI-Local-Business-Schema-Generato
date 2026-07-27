import { z } from 'zod';

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Enter a workspace name.').max(200),
});

/**
 * The provider is deliberately NOT accepted from the client — it is detected
 * from the key's own shape server-side, so a mismatch is impossible.
 */
export const saveApiKeySchema = z.object({
  apiKey: z.string().trim().min(20, 'That key looks too short.').max(400),
  model: z.string().trim().max(120).optional(),
});
