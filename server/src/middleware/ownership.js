import mongoose from 'mongoose';

import { WORKSPACE_ROLES } from '../config/constants.js';
import { BusinessProject } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/** Owner and admin see the whole workspace; members see only their own. */
const isWorkspaceAdmin = (req) =>
  req.wsRole === WORKSPACE_ROLES.OWNER || req.wsRole === WORKSPACE_ROLES.ADMIN;

/**
 * Loads the project named in the route and proves the caller may touch it —
 * scoped by WORKSPACE, never by the URL.
 *
 * A project outside the caller's workspace returns 404 (not 403): a 403 would
 * confirm the id exists, letting someone probe. Members additionally only reach
 * their own projects.
 */
export const loadProject = asyncHandler(async (req, _res, next) => {
  const { projectId } = req.params;
  if (!mongoose.isValidObjectId(projectId)) throw ApiError.notFound('Project not found.');

  const project = await BusinessProject.findById(projectId);

  // Not in my workspace → indistinguishable from "does not exist".
  if (!project || project.workspaceId !== req.workspaceId) {
    throw ApiError.notFound('Project not found.');
  }

  // Members are confined to what they created.
  if (!isWorkspaceAdmin(req) && String(project.userId) !== String(req.user._id)) {
    throw ApiError.notFound('Project not found.');
  }

  req.project = project;
  return next();
});

/**
 * Restricts destructive actions to the workspace owner/admin or the member who
 * created the project.
 */
export function requireProjectOwner(req, _res, next) {
  if (!req.project) return next(ApiError.internal('requireProjectOwner used without loadProject.'));

  const isCreator = String(req.project.userId) === String(req.user._id);
  if (!isCreator && !isWorkspaceAdmin(req)) {
    return next(ApiError.forbidden('Only the workspace owner/admin or the creator can do that.'));
  }
  return next();
}

/**
 * The list filter for the caller — always locked to their workspace, and
 * narrowed to their own records when they are a plain member.
 */
export function workspaceFilter(req) {
  const filter = { workspaceId: req.workspaceId };
  if (!isWorkspaceAdmin(req)) filter.userId = req.user._id;
  return filter;
}

export default { loadProject, requireProjectOwner, workspaceFilter };
