import * as authService from '../services/auth/authService.js';
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
    emailVerified: user.emailVerified,
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
  const result = await authService.register(req.body, req);

  return sendCreated(res, {
    message: 'Account created. Check your email to verify your address.',
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

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await authService.verifyEmail(req.body.token, req);

  return sendSuccess(res, {
    message: 'Your email address is verified.',
    data: { user: presentUser(user) },
  });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.body.email);

  // Deliberately identical whether or not the address exists.
  return sendSuccess(res, {
    message: 'If that address needs verification, a new link is on its way.',
    data: {},
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email, req);

  return sendSuccess(res, {
    message: 'If an account exists for that address, a reset link is on its way.',
    data: {},
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body, req);

  // No session is issued here: resetting invalidates every token, and the user
  // must sign in with the new password to prove they hold it.
  clearRefreshCookie(res);

  return sendSuccess(res, {
    message: 'Your password has been reset. Sign in with your new password.',
    data: {},
  });
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

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(
    {
      userId: req.user._id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    },
    req,
  );

  // Changing the password bumps tokenVersion, so this session needs fresh
  // tokens or the user would be signed out of the tab they just used.
  return sendSuccess(res, {
    message: 'Password changed. Other sessions have been signed out.',
    data: issueSession(res, result),
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
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  me,
  updateProfile,
  changePassword,
  completeOnboarding,
  deleteAccount,
};
