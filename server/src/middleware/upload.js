import path from 'node:path';

import multer from 'multer';

import { ERROR_CODES } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import { SUPPORTED_EXTENSIONS } from '../services/extraction/documentParser.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per file (spec)
const MAX_FILES = 10;

// Extension is the primary gate: browser-supplied MIME types are inconsistent
// across OSes for Office formats, so we allowlist by extension and treat MIME
// as advisory only.
const ALLOWED_MIME = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/epub+zip',
  'application/octet-stream', // some clients send this for Office files
  '',
]);

// Files are held in memory, not written to disk: they are parsed immediately
// and discarded, so there is nothing to clean up and no path-traversal surface.
const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return cb(new ApiError(400, `Unsupported file type: ${ext || 'unknown'}.`, {
      code: ERROR_CODES.VALIDATION_ERROR,
      errors: [{ field: 'files', message: `${file.originalname}: unsupported type.` }],
    }));
  }

  // MIME is a soft check; a mismatch is allowed through since the extension
  // allowlist and the parser (which validates real file structure) are the
  // real gates.
  if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
    return cb(null, true);
  }

  return cb(null, true);
}

const uploader = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

/**
 * Wraps multer so its size/count errors become the standard API error envelope
 * instead of raw multer errors.
 */
export function uploadDocuments(fieldName = 'files') {
  const handler = uploader.array(fieldName, MAX_FILES);

  return (req, res, next) => {
    handler(req, res, (error) => {
      if (!error) return next();

      if (error instanceof ApiError) return next(error);

      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          ApiError.badRequest('Each file must be 5 MB or smaller.', {
            code: ERROR_CODES.VALIDATION_ERROR,
            errors: [{ field: 'files', message: 'A file exceeds the 5 MB limit.' }],
          }),
        );
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return next(
          ApiError.badRequest(`Upload at most ${MAX_FILES} files at once.`, {
            code: ERROR_CODES.VALIDATION_ERROR,
          }),
        );
      }

      return next(ApiError.badRequest('File upload failed. Please try again.', { cause: error }));
    });
  };
}

export const uploadLimits = { MAX_FILE_BYTES, MAX_FILES, SUPPORTED_EXTENSIONS };

export default uploadDocuments;
