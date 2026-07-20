import { ERROR_CODES, ROLES, USER_STATUS } from '../config/constants.js';
import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../services/auth/tokenService.js';

function readBearerToken(req) {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verifies the access token and loads the user.
 *
 * The database read on every request is deliberate: a token stays
 * cryptographically valid until it expires, so without it a suspended or
 * deleted user would keep full access for the rest of the token's lifetime.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    throw ApiError.unauthorized('You must be signed in to do that.', {
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);

  if (!user || user.status === USER_STATUS.DELETED) {
    throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.', {
      code: ERROR_CODES.SESSION_EXPIRED,
    });
  }

  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden('This account has been suspended. Contact support for help.', {
      code: ERROR_CODES.ACCOUNT_SUSPENDED,
    });
  }

  req.user = user;
  return next();
});

/** Populates req.user when a token is present, but never rejects. */
export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.status === USER_STATUS.ACTIVE) req.user = user;
  } catch {
    // Ignored on purpose: this route works signed out.
  }

  return next();
});

export function requireRole(...roles) {
  const allowed = new Set(roles.flat());

  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('You must be signed in to do that.'));
    }
    // Admins pass every role gate.
    if (req.user.role === ROLES.ADMIN) return next();

    if (!allowed.has(req.user.role)) {
      return next(ApiError.forbidden('You do not have access to this resource.'));
    }
    return next();
  };
}

export const requireAdmin = requireRole(ROLES.ADMIN);

export default { authenticate, optionalAuthenticate, requireRole, requireAdmin };
