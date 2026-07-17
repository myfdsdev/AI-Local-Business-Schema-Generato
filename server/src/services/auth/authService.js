import {
  ERROR_CODES,
  INITIAL_SCAN_CREDITS,
  PLAN_SLUGS,
  ROLES,
  SUBSCRIPTION_STATUS,
  USER_STATUS,
} from '../../config/constants.js';
import logger from '../../config/logger.js';
import { CreditTransaction, Plan, Subscription, User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { DURATIONS, addDuration, generateRawToken, hashToken } from '../../utils/tokens.js';
import { AUDIT_ACTIONS, recordAudit } from '../audit/auditService.js';
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../email/emailService.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './tokenService.js';

const VERIFICATION_TTL = 24 * DURATIONS.HOUR;
const RESET_TTL = 1 * DURATIONS.HOUR;

/**
 * Chooses the account role from what the user says they are at signup.
 * Admin is never self-assignable — it is only ever set by the seed script or
 * another admin, so a crafted `role` in the request body cannot escalate.
 */
function resolveRole(accountType) {
  return accountType === 'seo_agency' ? ROLES.AGENCY : ROLES.USER;
}

function issueTokens(user) {
  return { accessToken: signAccessToken(user), refreshToken: signRefreshToken(user) };
}

async function createFreeSubscription(userId) {
  const freePlan = await Plan.findOne({ slug: PLAN_SLUGS.FREE, active: true });
  if (!freePlan) {
    // Seeds have not run. Registration still succeeds; billing attaches later.
    logger.warn('No active free plan found; skipping subscription creation', { userId });
    return null;
  }

  return Subscription.create({
    userId,
    planId: freePlan._id,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    billingProvider: 'none',
    currentPeriodStart: new Date(),
    currentPeriodEnd: addDuration(new Date(), 30 * DURATIONS.DAY),
  });
}

export async function register({ name, email, password, companyName, accountType }, req) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail }).select('_id').lean();
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.', {
      code: ERROR_CODES.EMAIL_ALREADY_REGISTERED,
      errors: [{ field: 'email', message: 'This email is already registered.' }],
    });
  }

  const rawToken = generateRawToken();

  const user = new User({
    name: name.trim(),
    email: normalizedEmail,
    password, // hashed by the model's pre-save hook
    companyName: companyName?.trim() ?? '',
    accountType: accountType ?? null,
    role: resolveRole(accountType),
    scanCredits: INITIAL_SCAN_CREDITS,
    plan: PLAN_SLUGS.FREE,
    verificationToken: hashToken(rawToken), // only the digest is stored
    verificationTokenExpires: addDuration(new Date(), VERIFICATION_TTL),
  });

  await user.save();

  await createFreeSubscription(user._id);

  await CreditTransaction.create({
    userId: user._id,
    amount: INITIAL_SCAN_CREDITS,
    type: 'grant',
    reason: 'Initial signup credits',
    balanceBefore: 0,
    balanceAfter: INITIAL_SCAN_CREDITS,
  });

  await sendVerificationEmail({ to: user.email, name: user.name, token: rawToken });
  recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_REGISTERED, resourceType: 'User', resourceId: user._id, req });

  return { user, tokens: issueTokens(user) };
}

export async function login({ email, password }, req) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

  // Same message and code for "no such user" and "wrong password", so the
  // response cannot be used to enumerate which emails have accounts.
  const invalid = () =>
    ApiError.unauthorized('Incorrect email or password.', { code: ERROR_CODES.INVALID_CREDENTIALS });

  if (!user) throw invalid();

  const passwordMatches = await user.verifyPassword(password);
  if (!passwordMatches) throw invalid();

  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden('This account has been suspended. Contact support for help.', {
      code: ERROR_CODES.ACCOUNT_SUSPENDED,
    });
  }

  if (user.status === USER_STATUS.DELETED) throw invalid();

  user.lastLoginAt = new Date();
  await user.save();

  recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_LOGGED_IN, resourceType: 'User', resourceId: user._id, req });

  return { user, tokens: issueTokens(user) };
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.', {
      code: ERROR_CODES.SESSION_EXPIRED,
    });
  }

  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub);

  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.', {
      code: ERROR_CODES.SESSION_EXPIRED,
    });
  }

  // tokenVersion is bumped on password change and account deletion, which
  // invalidates every refresh token minted before that moment.
  if ((payload.tv ?? 0) !== user.tokenVersion) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.', {
      code: ERROR_CODES.SESSION_EXPIRED,
    });
  }

  return { user, tokens: issueTokens(user) };
}

export async function verifyEmail(rawToken, req) {
  const user = await User.findOne({
    verificationToken: hashToken(rawToken),
    verificationTokenExpires: { $gt: new Date() },
  }).select('+verificationToken +verificationTokenExpires');

  if (!user) {
    throw ApiError.badRequest('This verification link is invalid or has expired.', {
      code: ERROR_CODES.INVALID_TOKEN,
    });
  }

  user.emailVerified = true;
  user.verificationToken = null;
  user.verificationTokenExpires = null;
  await user.save();

  await sendWelcomeEmail({ to: user.email, name: user.name });
  recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_EMAIL_VERIFIED, resourceType: 'User', resourceId: user._id, req });

  return user;
}

export async function resendVerification(email) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    '+verificationToken +verificationTokenExpires',
  );

  // Silent no-op for unknown or already-verified addresses: the caller always
  // gets the same response, so this cannot confirm whether an account exists.
  if (!user || user.emailVerified) return;

  const rawToken = generateRawToken();
  user.verificationToken = hashToken(rawToken);
  user.verificationTokenExpires = addDuration(new Date(), VERIFICATION_TTL);
  await user.save();

  await sendVerificationEmail({ to: user.email, name: user.name, token: rawToken });
}

export async function requestPasswordReset(email, req) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    '+resetPasswordToken +resetPasswordExpires',
  );

  // Same silent no-op as above; the controller returns success regardless.
  if (!user || user.status !== USER_STATUS.ACTIVE) return;

  const rawToken = generateRawToken();
  user.resetPasswordToken = hashToken(rawToken);
  user.resetPasswordExpires = addDuration(new Date(), RESET_TTL);
  await user.save();

  await sendPasswordResetEmail({ to: user.email, name: user.name, token: rawToken });
  recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_PASSWORD_RESET_REQUESTED, resourceType: 'User', resourceId: user._id, req });
}

export async function resetPassword({ token, password }, req) {
  const user = await User.findOne({
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) {
    throw ApiError.badRequest('This password reset link is invalid or has expired.', {
      code: ERROR_CODES.INVALID_TOKEN,
    });
  }

  user.password = password;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  user.tokenVersion += 1; // sign out every existing session
  await user.save();

  await sendPasswordChangedEmail({ to: user.email, name: user.name });
  recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_PASSWORD_RESET, resourceType: 'User', resourceId: user._id, req });

  return user;
}

export async function changePassword({ userId, currentPassword, newPassword }, req) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found.');

  const matches = await user.verifyPassword(currentPassword);
  if (!matches) {
    throw ApiError.badRequest('Your current password is incorrect.', {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      errors: [{ field: 'currentPassword', message: 'Incorrect password.' }],
    });
  }

  user.password = newPassword;
  user.tokenVersion += 1;
  await user.save();

  await sendPasswordChangedEmail({ to: user.email, name: user.name });
  recordAudit({ userId: user._id, action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED, resourceType: 'User', resourceId: user._id, req });

  // Caller must re-issue tokens: the old ones no longer validate.
  return { user, tokens: issueTokens(user) };
}

export async function updateProfile({ userId, updates }, req) {
  const allowed = ['name', 'companyName', 'profileImage', 'accountType'];
  const patch = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }

  const user = await User.findByIdAndUpdate(userId, patch, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found.');

  recordAudit({ userId, action: AUDIT_ACTIONS.USER_PROFILE_UPDATED, resourceType: 'User', resourceId: userId, metadata: { fields: Object.keys(patch) }, req });

  return user;
}

export async function completeOnboarding({ userId, goal, accountType }) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found.');

  if (accountType) {
    user.accountType = accountType;
    user.role = user.role === ROLES.ADMIN ? ROLES.ADMIN : resolveRole(accountType);
  }
  if (goal) user.onboarding.goal = goal;

  user.onboarding.completed = true;
  user.onboarding.completedAt = new Date();
  await user.save();

  return user;
}

/**
 * Soft delete: the email is released and the account is anonymized, but the row
 * survives so audit logs and credit history keep referential integrity.
 */
export async function deleteAccount({ userId, password }, req) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found.');

  const matches = await user.verifyPassword(password);
  if (!matches) {
    throw ApiError.badRequest('Your password is incorrect.', {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      errors: [{ field: 'password', message: 'Incorrect password.' }],
    });
  }

  user.status = USER_STATUS.DELETED;
  user.deletedAt = new Date();
  user.email = `deleted+${user._id}@localschema.invalid`;
  user.name = 'Deleted user';
  user.tokenVersion += 1;
  await user.save();

  recordAudit({ userId, action: AUDIT_ACTIONS.USER_ACCOUNT_DELETED, resourceType: 'User', resourceId: userId, req });

  return user;
}

export default {
  register,
  login,
  refreshSession,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  changePassword,
  updateProfile,
  completeOnboarding,
  deleteAccount,
};
