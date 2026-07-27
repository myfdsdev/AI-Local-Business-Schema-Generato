import mongoose from 'mongoose';

import { APP_ID, WORKSPACE_ROLES } from '../../config/constants.js';
import { BusinessProject, Location } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';

const isWorkspaceAdmin = (wsRole) =>
  wsRole === WORKSPACE_ROLES.OWNER || wsRole === WORKSPACE_ROLES.ADMIN;

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'location';

/** Base filter: always the caller's workspace; members see only their own. */
function scope({ workspaceId, wsRole, userId }) {
  const filter = { appId: APP_ID, workspaceId };
  if (!isWorkspaceAdmin(wsRole)) filter.userId = userId;
  return filter;
}

/** Confirms a project is in the caller's reach, or throws 404. */
async function assertProject({ projectId, workspaceId, wsRole, userId }) {
  if (!mongoose.isValidObjectId(projectId)) throw ApiError.notFound('Project not found.');
  const project = await BusinessProject.findById(projectId).lean();
  if (!project || project.workspaceId !== workspaceId) throw ApiError.notFound('Project not found.');
  if (!isWorkspaceAdmin(wsRole) && String(project.userId) !== String(userId)) {
    throw ApiError.notFound('Project not found.');
  }
  return project;
}

export async function listLocations({ workspaceId, wsRole, userId }) {
  return Location.find(scope({ workspaceId, wsRole, userId }))
    .sort({ createdAt: -1 })
    .populate('projectId', 'projectName')
    .lean();
}

export async function createLocation({ workspaceId, wsRole, userId, payload }) {
  await assertProject({ projectId: payload.projectId, workspaceId, wsRole, userId });

  const slug = slugify(payload.name);
  const clash = await Location.findOne({ projectId: payload.projectId, slug }).select('_id').lean();
  if (clash) {
    throw ApiError.conflict('A location with a similar name already exists in this project.', {
      code: 'DUPLICATE_LOCATION',
    });
  }

  const location = await Location.create({
    appId: APP_ID,
    workspaceId,
    projectId: payload.projectId,
    userId,
    name: payload.name,
    slug,
    pageUrl: payload.pageUrl,
    businessType: payload.businessType || 'LocalBusiness',
    telephone: payload.telephone,
    email: payload.email,
    address: payload.address,
    active: payload.active,
  });

  return location;
}

/** Loads a location the caller may touch, or throws 404 (never 403). */
async function loadOwned({ locationId, workspaceId, wsRole, userId }) {
  if (!mongoose.isValidObjectId(locationId)) throw ApiError.notFound('Location not found.');
  const location = await Location.findById(locationId);
  if (!location || location.workspaceId !== workspaceId) throw ApiError.notFound('Location not found.');
  if (!isWorkspaceAdmin(wsRole) && String(location.userId) !== String(userId)) {
    throw ApiError.notFound('Location not found.');
  }
  return location;
}

export async function updateLocation({ locationId, workspaceId, wsRole, userId, payload }) {
  const location = await loadOwned({ locationId, workspaceId, wsRole, userId });

  const patch = { ...payload };
  if (payload.name) patch.slug = slugify(payload.name);
  Object.assign(location, patch);
  await location.save();
  return location;
}

export async function deleteLocation({ locationId, workspaceId, wsRole, userId }) {
  const location = await loadOwned({ locationId, workspaceId, wsRole, userId });
  await Location.deleteOne({ _id: location._id });
}

export default { listLocations, createLocation, updateLocation, deleteLocation };
