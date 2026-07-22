import { workspaceFilter } from '../middleware/ownership.js';
import * as projectService from '../services/projects/projectService.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await projectService.listProjects({
    user: req.user,
    query: req.validatedQuery ?? {},
    filter: workspaceFilter(req),
  });

  return sendSuccess(res, { message: 'OK', data: { projects: items }, meta });
});

export const create = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(
    { user: req.user, workspaceId: req.workspaceId, payload: req.body },
    req,
  );

  return sendCreated(res, {
    message: 'Project created successfully',
    data: { project },
  });
});

export const detail = asyncHandler(async (req, res) => {
  const data = await projectService.getProjectDetail(req.project);
  return sendSuccess(res, { message: 'OK', data });
});

export const update = asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(
    { project: req.project, payload: req.body, user: req.user },
    req,
  );

  return sendSuccess(res, { message: 'Project updated successfully', data: { project } });
});

export const archive = asyncHandler(async (req, res) => {
  const project = await projectService.archiveProject({ project: req.project, user: req.user }, req);
  return sendSuccess(res, { message: 'Project archived.', data: { project } });
});

export const restore = asyncHandler(async (req, res) => {
  const project = await projectService.restoreProject({ project: req.project, user: req.user }, req);
  return sendSuccess(res, { message: 'Project restored.', data: { project } });
});

export const remove = asyncHandler(async (req, res) => {
  await projectService.deleteProject({ project: req.project, user: req.user }, req);
  return sendSuccess(res, { message: 'Project deleted.', data: {} });
});

export default { list, create, detail, update, archive, restore, remove };
