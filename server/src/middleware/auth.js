import { ERROR_CODES, ROLES, USER_STATUS, WORKSPACE_STATUS } from '../config/constants.js';
import { User, Workspace } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../services/auth/tokenService.js';
import { ensurePersonalWorkspace, findActiveMembership } from '../services/workspace/workspaceService.js';

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

/**
 * Resolves the caller's workspace from their MEMBERSHIP — never from the URL or
 * body. Attaches req.workspaceId and req.wsRole for downstream scoping. Runs
 * after authenticate. Blocks access to a suspended workspace. Lazily creates a
 * personal workspace for any user that has none, so the app never 500s on a
 * pre-multi-tenancy account.
 */
export const resolveWorkspace = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized('You must be signed in to do that.');

  let membership = await findActiveMembership(req.user._id);
  if (!membership) {
    membership = await ensurePersonalWorkspace({ userId: req.user._id, name: req.user.name });
  }

  const workspace = await Workspace.findOne({ workspaceId: membership.workspaceId }).lean();
  if (!workspace || workspace.status !== WORKSPACE_STATUS.ACTIVE) {
    throw ApiError.forbidden('This workspace is not active. Contact support.', {
      code: 'WORKSPACE_INACTIVE',
    });
  }

  req.workspaceId = membership.workspaceId;
  req.wsRole = membership.role;
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

/** Gate for workspace-admin actions (managing team, settings). Owner + admin. */
export function requireWorkspaceRole(...roles) {
  const allowed = new Set(roles.flat());
  return (req, _res, next) => {
    if (!req.wsRole || !allowed.has(req.wsRole)) {
      return next(ApiError.forbidden('You do not have permission in this workspace.'));
    }
    return next();
  };
}

export default {
  authenticate,
  optionalAuthenticate,
  resolveWorkspace,
  requireRole,
  requireAdmin,
  requireWorkspaceRole,
};
