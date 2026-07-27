import * as locationService from '../services/locations/locationService.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const ctx = (req) => ({ workspaceId: req.workspaceId, wsRole: req.wsRole, userId: req.user._id });

export const list = asyncHandler(async (req, res) => {
  const locations = await locationService.listLocations(ctx(req));
  return sendSuccess(res, { message: 'OK', data: { locations } });
});

export const create = asyncHandler(async (req, res) => {
  const location = await locationService.createLocation({ ...ctx(req), payload: req.body });
  return sendCreated(res, { message: 'Location added.', data: { location } });
});

export const update = asyncHandler(async (req, res) => {
  const location = await locationService.updateLocation({
    ...ctx(req),
    locationId: req.params.locationId,
    payload: req.body,
  });
  return sendSuccess(res, { message: 'Location updated.', data: { location } });
});

export const remove = asyncHandler(async (req, res) => {
  await locationService.deleteLocation({ ...ctx(req), locationId: req.params.locationId });
  return sendSuccess(res, { message: 'Location removed.', data: {} });
});

export default { list, create, update, remove };
