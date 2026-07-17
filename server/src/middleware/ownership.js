import mongoose from 'mongoose';

import { ROLES } from '../config/constants.js';
import { BusinessProject } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Loads the project named in the route and proves the caller may touch it.
 *
 * A caller who is not the owner gets 404, not 403: a 403 would confirm the
 * project exists, letting someone probe for valid IDs. Admins get the real
 * project regardless of owner.
 */
export const loadProject = asyncHandler(async (req, _res, next) => {
  const { projectId } = req.params;

  if (!mongoose.isValidObjectId(projectId)) throw ApiError.notFound('Project not found.');

  const project = await BusinessProject.findById(projectId);
  if (!project) throw ApiError.notFound('Project not found.');

  const isOwner = String(project.userId) === String(req.user._id);
  const isAgencyOwner = project.agencyId && String(project.agencyId) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isOwner && !isAgencyOwner && !isAdmin) throw ApiError.notFound('Project not found.');

  req.project = project;
  return next();
});

/**
 * Restricts a route to the project's owner even if the caller can otherwise
 * read it — used for destructive actions.
 */
export function requireProjectOwner(req, _res, next) {
  if (!req.project) return next(ApiError.internal('requireProjectOwner used without loadProject.'));

  const isOwner = String(req.project.userId) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    return next(ApiError.forbidden('Only the project owner can do that.'));
  }
  return next();
}

/** Scopes a query to what the caller is allowed to see. */
export function ownershipFilter(user) {
  if (user.role === ROLES.ADMIN) return {};
  if (user.role === ROLES.AGENCY) {
    return { $or: [{ userId: user._id }, { agencyId: user._id }] };
  }
  return { userId: user._id };
}

export default { loadProject, requireProjectOwner, ownershipFilter };
