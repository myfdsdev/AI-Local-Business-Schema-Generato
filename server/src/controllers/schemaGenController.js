import { z } from 'zod';

import {
  activeProvider,
  generateFromDocuments,
  isAiConfigured,
} from '../services/ai/schemaGenerationService.js';
import { uploadLimits } from '../middleware/upload.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const notesSchema = z.string().trim().max(20_000).optional();

/** Reports whether AI generation is available and what uploads are allowed. */
export const capabilities = asyncHandler(async (_req, res) =>
  sendSuccess(res, {
    message: 'OK',
    data: {
      aiConfigured: isAiConfigured(),
      aiProvider: activeProvider(),
      maxFileBytes: uploadLimits.MAX_FILE_BYTES,
      maxFiles: uploadLimits.MAX_FILES,
      supportedExtensions: uploadLimits.SUPPORTED_EXTENSIONS,
    },
  }),
);

/**
 * Accepts uploaded documents (and/or typed notes), runs the generate-and-
 * validate pipeline, and returns the validated JSON-LD.
 */
export const generate = asyncHandler(async (req, res) => {
  const notes = notesSchema.parse(req.body?.notes ?? '');
  const files = req.files ?? [];

  if (files.length === 0 && !notes?.trim()) {
    throw ApiError.badRequest('Upload at least one document or enter some business details.', {
      errors: [{ field: 'files', message: 'Nothing to generate from.' }],
    });
  }

  const result = await generateFromDocuments({ files, notes: notes ?? '' });

  return sendSuccess(res, {
    message: result.valid ? 'Schema generated and validated.' : 'Schema generated with validation issues.',
    data: result,
  });
});

export default { capabilities, generate };
