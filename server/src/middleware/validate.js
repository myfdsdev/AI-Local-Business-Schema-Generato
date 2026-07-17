import { ZodError } from 'zod';

import { ERROR_CODES } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validates request parts against Zod schemas and replaces each part with the
 * parsed result, so handlers receive coerced, stripped values and can never
 * read an unvalidated field off the raw request.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      // req.query has only a getter on some Express versions; assign fields
      // onto the existing object rather than replacing it.
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query ?? {});
        req.validatedQuery = parsed;
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          ApiError.badRequest('Please check the highlighted fields and try again.', {
            code: ERROR_CODES.VALIDATION_ERROR,
            errors: formatIssues(error),
          }),
        );
      }
      return next(error);
    }
  };
}

export default validate;
