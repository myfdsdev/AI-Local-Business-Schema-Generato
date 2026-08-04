import * as accessService from '../services/workspace/accessService.js';
import { signAccessToken, signRefreshToken, setRefreshCookie } from '../services/auth/tokenService.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Requests workspace access. Responds identically whether or not the address
 * already has an account or a workspace — any difference would let someone
 * enumerate customers through this public endpoint.
 */
export const request = asyncHandler(async (req, res) => {
  await accessService.requestAdminAccess({
    name: req.body.name,
    email: req.body.email,
    code: req.body.code,
  });

  return sendSuccess(res, {
    message: 'Check your email to confirm and finish setting up your workspace.',
    data: { requested: true },
  });
});

/**
 * Direct signup: creates the account, workspace and owner membership from the
 * form, then signs them in. No email step.
 */
export const registerOwner = asyncHandler(async (req, res) => {
  const { user, workspaceId } = await accessService.registerWorkspaceOwner({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    code: req.body.code,
  });

  setRefreshCookie(res, signRefreshToken(user));
  return sendCreated(res, {
    message: 'Your workspace is ready.',
    data: {
      accessToken: signAccessToken(user),
      user: { id: user._id, name: user.name, email: user.email },
      workspaceId,
    },
  });
});

/** Redeems the emailed link: creates everything, then signs them straight in. */
export const claim = asyncHandler(async (req, res) => {
  const { user, workspaceId } = await accessService.claimAdminAccess({ token: req.body.token });

  setRefreshCookie(res, signRefreshToken(user));
  return sendSuccess(res, {
    message: 'Your workspace is ready.',
    data: {
      accessToken: signAccessToken(user),
      user: { id: user._id, name: user.name, email: user.email },
      workspaceId,
    },
  });
});

export default { request, registerOwner, claim };
