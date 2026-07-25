import { env } from '../config/env.js';
import * as authService from '../services/auth/authService.js';
import ApiError from '../utils/ApiError.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from '../services/auth/tokenService.js';
import { AUDIT_ACTIONS, recordAudit } from '../services/audit/auditService.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/** Shape of the user object returned to the client. */
function presentUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountType: user.accountType,
    companyName: user.companyName,
    profileImage: user.profileImage,
    plan: user.plan,
    scanCredits: user.scanCredits,
    status: user.status,
    onboarding: user.onboarding,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

/**
 * The refresh token goes only into the HTTP-only cookie and is never included
 * in the JSON body, so page scripts cannot read it.
 */
function issueSession(res, { user, tokens }) {
  setRefreshCookie(res, tokens.refreshToken);
  return { user: presentUser(user), accessToken: tokens.accessToken };
}

export const register = asyncHandler(async (req, res) => {
  // Accounts come from a purchase (the hub provisions the owner) or from a
  // workspace owner inviting a teammate — never from open self-signup.
  // Open unless explicitly turned off (ALLOW_PUBLIC_SIGNUP=false). Read at
  // request time so it can be flipped without a restart and exercised in tests.
  const signupAllowed = process.env.ALLOW_PUBLIC_SIGNUP !== 'false';
  if (!signupAllowed) {
    throw new ApiError(403, 'Accounts are created when you buy the app. Check your email for your login details, or ask your workspace owner to invite you.', {
      code: 'SIGNUP_DISABLED',
    });
  }

  const result = await authService.register(req.body, req);

  return sendCreated(res, {
    message: 'Account created.',
    data: issueSession(res, result),
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req);

  return sendSuccess(res, {
    message: 'Signed in successfully.',
    data: issueSession(res, result),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refreshSession(readRefreshCookie(req));

  return sendSuccess(res, {
    message: 'Session refreshed.',
    data: issueSession(res, result),
  });
});

export const logout = asyncHandler(async (req, res) => {
  clearRefreshCookie(res);

  if (req.user) {
    recordAudit({
      userId: req.user._id,
      action: AUDIT_ACTIONS.USER_LOGGED_OUT,
      resourceType: 'User',
      resourceId: req.user._id,
      req,
    });
  }

  return sendSuccess(res, { message: 'Signed out.', data: {} });
});

export const me = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'OK', data: { user: presentUser(req.user) } }),
);

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile({ userId: req.user._id, updates: req.body }, req);

  return sendSuccess(res, {
    message: 'Profile updated.',
    data: { user: presentUser(user) },
  });
});

export const completeOnboarding = asyncHandler(async (req, res) => {
  const user = await authService.completeOnboarding({ userId: req.user._id, ...req.body });

  return sendSuccess(res, {
    message: 'Onboarding complete.',
    data: { user: presentUser(user) },
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await authService.deleteAccount({ userId: req.user._id, password: req.body.password }, req);
  clearRefreshCookie(res);

  return sendSuccess(res, { message: 'Your account has been deleted.', data: {} });
});

export default {
  register,
  login,
  refresh,
  logout,
  me,
  updateProfile,
  completeOnboarding,
  deleteAccount,
};
