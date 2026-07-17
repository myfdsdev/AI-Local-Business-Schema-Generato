import { ERROR_CODES } from '../config/constants.js';

/**
 * Errors thrown with this class are considered "expected" and their message is
 * safe to show the user. Anything else reaching the error handler is treated as
 * an internal fault and replaced with a generic message.
 */
export class ApiError extends Error {
  constructor(statusCode, message, { code = ERROR_CODES.INTERNAL_ERROR, errors = [], cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, options = {}) {
    return new ApiError(400, message, { code: ERROR_CODES.VALIDATION_ERROR, ...options });
  }

  static unauthorized(message = 'You must be signed in to do that.', options = {}) {
    return new ApiError(401, message, { code: ERROR_CODES.UNAUTHORIZED, ...options });
  }

  static forbidden(message = 'You do not have access to this resource.', options = {}) {
    return new ApiError(403, message, { code: ERROR_CODES.FORBIDDEN, ...options });
  }

  static notFound(message = 'Resource not found.', options = {}) {
    return new ApiError(404, message, { code: ERROR_CODES.NOT_FOUND, ...options });
  }

  static conflict(message, options = {}) {
    return new ApiError(409, message, { code: ERROR_CODES.CONFLICT, ...options });
  }

  static internal(message = 'Something went wrong on our side.', options = {}) {
    return new ApiError(500, message, { code: ERROR_CODES.INTERNAL_ERROR, ...options });
  }
}

export default ApiError;
