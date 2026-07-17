import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { ERROR_CODES } from '../config/constants.js';
import { isProduction, isTest } from '../config/env.js';
import logger from '../config/logger.js';
import { SystemLog } from '../models/index.js';
import ApiError from '../utils/ApiError.js';

/**
 * Translates known library errors into ApiError. Anything not matched here is
 * an unexpected fault and gets a generic message.
 */
function normalize(error) {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return ApiError.badRequest('Please check the highlighted fields and try again.', {
      code: ERROR_CODES.VALIDATION_ERROR,
      errors: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
      cause: error,
    });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return ApiError.badRequest('Please check the highlighted fields and try again.', {
      code: ERROR_CODES.VALIDATION_ERROR,
      errors: Object.values(error.errors).map((detail) => ({
        field: detail.path,
        message: detail.message,
      })),
      cause: error,
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${error.path}.`, {
      code: ERROR_CODES.VALIDATION_ERROR,
      errors: [{ field: error.path, message: 'Invalid identifier.' }],
      cause: error,
    });
  }

  // Duplicate key from a unique index.
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? 'field';
    return ApiError.conflict('That record already exists.', {
      code: ERROR_CODES.CONFLICT,
      errors: [{ field, message: `This ${field} is already in use.` }],
      cause: error,
    });
  }

  if (error?.type === 'entity.too.large') {
    return ApiError.badRequest('That request is too large.', { cause: error });
  }

  // Malformed JSON body from body-parser.
  if (error instanceof SyntaxError && 'body' in error) {
    return ApiError.badRequest('The request body is not valid JSON.', { cause: error });
  }

  return null;
}

/** Persists the full fault for admins; never blocks the response. */
async function persistSystemLog(error, req, statusCode) {
  if (isTest) return;

  try {
    await SystemLog.create({
      level: 'error',
      message: error.message,
      code: error.code ?? '',
      stack: error.stack ?? '',
      requestId: req.id ?? '',
      method: req.method,
      path: req.originalUrl,
      statusCode,
      userId: req.user?._id ?? null,
      ipAddress: req.ip ?? '',
      userAgent: req.get('user-agent') ?? '',
    });
  } catch (writeError) {
    logger.error('Failed to persist system log', { message: writeError.message });
  }
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(error, req, res, next) {
  const normalized = normalize(error);
  const isExpected = normalized !== null;

  const apiError =
    normalized ??
    ApiError.internal('Something went wrong on our side. Please try again.', { cause: error });

  const statusCode = apiError.statusCode ?? 500;

  // 5xx means we did something wrong, so keep the full detail. Expected 4xx
  // responses are routine and would only add noise.
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}: ${error.message}`, {
      requestId: req.id,
      stack: isProduction ? undefined : error.stack,
    });
    persistSystemLog(error, req, statusCode);
  } else if (!isTest) {
    logger.debug(`${req.method} ${req.originalUrl} -> ${statusCode}: ${apiError.message}`);
  }

  const body = {
    success: false,
    message: apiError.message,
    code: apiError.code ?? ERROR_CODES.INTERNAL_ERROR,
    errors: apiError.errors ?? [],
  };

  if (req.id) body.requestId = req.id;

  // The stack is a debugging aid for the developer running the server, and is
  // withheld outside development so it can never leak to a user.
  if (!isProduction && !isExpected && error.stack) {
    body.stack = error.stack.split('\n').slice(0, 12);
  }

  return res.status(statusCode).json(body);
}

export default errorHandler;
