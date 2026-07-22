import { workspaceFilter } from '../middleware/ownership.js';
import * as dashboardService from '../services/dashboard/dashboardService.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const overview = asyncHandler(async (req, res) => {
  const scope = workspaceFilter(req);
  // Fired together: they hit different collections and none depends on another.
  const [stats, activity, validationBreakdown] = await Promise.all([
    dashboardService.getDashboardStats(scope, req.user),
    dashboardService.getRecentActivity(scope),
    dashboardService.getValidationBreakdown(scope),
  ]);

  return sendSuccess(res, {
    message: 'OK',
    data: { stats, ...activity, validationBreakdown },
  });
});

export default { overview };
