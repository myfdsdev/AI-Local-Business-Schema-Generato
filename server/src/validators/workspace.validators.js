import { z } from 'zod';

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Enter a workspace name.').max(200),
});
