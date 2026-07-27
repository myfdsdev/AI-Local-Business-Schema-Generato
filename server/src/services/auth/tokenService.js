import jwt from 'jsonwebtoken';

import { env, isProduction } from '../../config/env.js';
import { ERROR_CODES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import { parseDuration } from '../../utils/tokens.js';

export const REFRESH_COOKIE_NAME = 'ls_refresh';

/**
 * Access tokens are short-lived and travel in the Authorization header.
 * Refresh tokens are long-lived and travel only in an HTTP-only cookie, so
 * page JavaScript (and any XSS) cannot read them.
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user._id), type: 'refresh', tv: user.tokenVersion ?? 0 },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN },
  );
}

function verify(token, secret, expectedType) {
  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Your session has expired. Please sign in again.', {
        code: ERROR_CODES.TOKEN_EXPIRED,
      });
    }
    throw ApiError.unauthorized('Invalid authentication token.', {
      code: ERROR_CODES.INVALID_TOKEN,
    });
  }

  // A refresh token presented as an access token (or vice versa) is rejected:
  // both are JWTs, so the type claim is what keeps them from being swapped.
  if (payload.type !== expectedType) {
    throw ApiError.unauthorized('Invalid authentication token.', {
      code: ERROR_CODES.INVALID_TOKEN,
    });
  }

  return payload;
}

export function verifyAccessToken(token) {
  return verify(token, env.JWT_ACCESS_SECRET, 'access');
}

export function verifyRefreshToken(token) {
  return verify(token, env.JWT_REFRESH_SECRET, 'refresh');
}

export function refreshCookieOptions() {
  // The frontend and backend run on separate origins (e.g. different
  // *.onrender.com subdomains), so the refresh cookie is cross-site. It must be
  // SameSite=None to be sent at all — and browsers require Secure with None,
  // which is why None is only used in production (HTTPS). Locally everything is
  // same-origin via the Vite proxy, so Lax over plain http works.
  //
  // CSRF risk stays low: the only cookie-authenticated route is /auth/refresh,
  // and its response (a new access token) is unreadable cross-origin thanks to
  // CORS, so a forged refresh yields the attacker nothing.
  return {
    httpOnly: true,
    secure: isProduction, // required whenever sameSite is 'none'
    sameSite: isProduction ? 'none' : 'lax',
    signed: true,
    path: '/api/v1/auth',
    maxAge: parseDuration(env.JWT_REFRESH_EXPIRES_IN),
  };
}

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

export function clearRefreshCookie(res) {
  const { maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

export function readRefreshCookie(req) {
  return req.signedCookies?.[REFRESH_COOKIE_NAME] ?? null;
}
