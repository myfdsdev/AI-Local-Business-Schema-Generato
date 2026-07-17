import { PROJECT_STATUS, ROLES, USER_STATUS } from '../config/constants.js';
import {
  AuditLog,
  BusinessProject,
  SchemaDocument,
  SchemaType,
  SystemLog,
  User,
  WebsiteScan,
} from '../models/index.js';
import { adminAdjustCredits } from '../services/credits/creditService.js';
import { AUDIT_ACTIONS, recordAudit } from '../services/audit/auditService.js';
import ApiError from '../utils/ApiError.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildPageMeta, parsePagination } from '../utils/pagination.js';

/** Escapes user input before it becomes a regex. */
function searchPattern(value) {
  return new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export const dashboard = asyncHandler(async (_req, res) => {
  const [userStats, projectCount, scanCount, schemaCount, recentErrors] = await Promise.all([
    User.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    BusinessProject.countDocuments({ status: { $ne: PROJECT_STATUS.ARCHIVED } }),
    WebsiteScan.countDocuments(),
    SchemaDocument.countDocuments(),
    SystemLog.countDocuments({
      level: 'error',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);

  const byStatus = Object.fromEntries(userStats.map((row) => [row._id, row.count]));

  return sendSuccess(res, {
    message: 'OK',
    data: {
      stats: {
        totalUsers: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
        activeUsers: byStatus[USER_STATUS.ACTIVE] ?? 0,
        suspendedUsers: byStatus[USER_STATUS.SUSPENDED] ?? 0,
        totalProjects: projectCount,
        totalScans: scanCount,
        totalSchemas: schemaCount,
        errorsLast24h: recentErrors,
      },
    },
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? {};
  const { page, limit, skip } = parsePagination(query);

  const criteria = {};
  if (query.status) criteria.status = query.status;
  if (query.role) criteria.role = query.role;
  if (query.search) {
    const pattern = searchPattern(query.search);
    criteria.$or = [{ name: pattern }, { email: pattern }, { companyName: pattern }];
  }

  const [items, total] = await Promise.all([
    User.find(criteria).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(criteria),
  ]);

  return sendSuccess(res, {
    message: 'OK',
    data: { users: items },
    meta: buildPageMeta({ page, limit, total }),
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId).lean();
  if (!user) throw ApiError.notFound('User not found.');

  const [projectCount, scanCount] = await Promise.all([
    BusinessProject.countDocuments({ userId: user._id }),
    WebsiteScan.countDocuments({ userId: user._id }),
  ]);

  return sendSuccess(res, {
    message: 'OK',
    data: { user, counts: { projects: projectCount, scans: scanCount } },
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const allowed = ['name', 'role', 'plan', 'companyName', 'emailVerified'];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  const user = await User.findByIdAndUpdate(req.params.userId, patch, {
    new: true,
    runValidators: true,
  });
  if (!user) throw ApiError.notFound('User not found.');

  recordAudit({
    userId: req.user._id,
    action: AUDIT_ACTIONS.ADMIN_USER_UPDATED,
    resourceType: 'User',
    resourceId: user._id,
    metadata: { fields: Object.keys(patch) },
    req,
  });

  return sendSuccess(res, { message: 'User updated.', data: { user } });
});

export const suspendUser = asyncHandler(async (req, res) => {
  // Without this an admin could lock themselves out of the platform.
  if (String(req.params.userId) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot suspend your own account.');
  }

  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound('User not found.');

  user.status = USER_STATUS.SUSPENDED;
  user.tokenVersion += 1; // end their sessions immediately
  await user.save();

  recordAudit({
    userId: req.user._id,
    action: AUDIT_ACTIONS.ADMIN_USER_SUSPENDED,
    resourceType: 'User',
    resourceId: user._id,
    metadata: { reason: req.body?.reason ?? '' },
    req,
  });

  return sendSuccess(res, { message: 'User suspended.', data: { user } });
});

export const activateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound('User not found.');

  if (user.status === USER_STATUS.DELETED) {
    throw ApiError.badRequest('A deleted account cannot be reactivated.');
  }

  user.status = USER_STATUS.ACTIVE;
  await user.save();

  recordAudit({
    userId: req.user._id,
    action: AUDIT_ACTIONS.ADMIN_USER_ACTIVATED,
    resourceType: 'User',
    resourceId: user._id,
    req,
  });

  return sendSuccess(res, { message: 'User activated.', data: { user } });
});

export const adjustCredits = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;

  const result = await adminAdjustCredits({
    userId: req.params.userId,
    amount,
    reason: reason ?? 'Admin adjustment',
    createdBy: req.user._id,
  });

  recordAudit({
    userId: req.user._id,
    action: AUDIT_ACTIONS.ADMIN_CREDITS_ADJUSTED,
    resourceType: 'User',
    resourceId: req.params.userId,
    metadata: { amount, reason },
    req,
  });

  return sendSuccess(res, { message: 'Credits updated.', data: result });
});

export const listProjects = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? {};
  const { page, limit, skip } = parsePagination(query);

  const criteria = {};
  if (query.status) criteria.status = query.status;
  if (query.search) {
    const pattern = searchPattern(query.search);
    criteria.$or = [{ projectName: pattern }, { businessName: pattern }, { normalizedDomain: pattern }];
  }

  const [items, total] = await Promise.all([
    BusinessProject.find(criteria)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email')
      .lean(),
    BusinessProject.countDocuments(criteria),
  ]);

  return sendSuccess(res, {
    message: 'OK',
    data: { projects: items },
    meta: buildPageMeta({ page, limit, total }),
  });
});

export const listScans = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.validatedQuery ?? {});

  const [items, total] = await Promise.all([
    WebsiteScan.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('projectId', 'projectName websiteUrl')
      .populate('userId', 'name email')
      .lean(),
    WebsiteScan.countDocuments(),
  ]);

  return sendSuccess(res, {
    message: 'OK',
    data: { scans: items },
    meta: buildPageMeta({ page, limit, total }),
  });
});

export const listErrors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.validatedQuery ?? {});

  const [items, total] = await Promise.all([
    SystemLog.find({ level: 'error' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SystemLog.countDocuments({ level: 'error' }),
  ]);

  return sendSuccess(res, {
    message: 'OK',
    data: { errors: items },
    meta: buildPageMeta({ page, limit, total }),
  });
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? {};
  const { page, limit, skip } = parsePagination(query);

  const criteria = {};
  if (query.action) criteria.action = query.action;
  if (query.userId) criteria.userId = query.userId;

  const [items, total] = await Promise.all([
    AuditLog.find(criteria)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email')
      .lean(),
    AuditLog.countDocuments(criteria),
  ]);

  return sendSuccess(res, {
    message: 'OK',
    data: { auditLogs: items },
    meta: buildPageMeta({ page, limit, total }),
  });
});

// --- Schema type registry (spec section 7) ----------------------------------

export const listSchemaTypes = asyncHandler(async (_req, res) => {
  const types = await SchemaType.find().sort({ sortOrder: 1, label: 1 }).lean();
  return sendSuccess(res, { message: 'OK', data: { schemaTypes: types } });
});

export const createSchemaType = asyncHandler(async (req, res) => {
  const schemaType = await SchemaType.create(req.body);

  recordAudit({
    userId: req.user._id,
    action: AUDIT_ACTIONS.ADMIN_SCHEMA_TYPE_CREATED,
    resourceType: 'SchemaType',
    resourceId: schemaType._id,
    metadata: { name: schemaType.name },
    req,
  });

  return sendCreated(res, { message: 'Schema type created.', data: { schemaType } });
});

export const updateSchemaType = asyncHandler(async (req, res) => {
  const schemaType = await SchemaType.findByIdAndUpdate(req.params.schemaTypeId, req.body, {
    new: true,
    runValidators: true,
  });
  if (!schemaType) throw ApiError.notFound('Schema type not found.');

  recordAudit({
    userId: req.user._id,
    action: AUDIT_ACTIONS.ADMIN_SCHEMA_TYPE_UPDATED,
    resourceType: 'SchemaType',
    resourceId: schemaType._id,
    req,
  });

  return sendSuccess(res, { message: 'Schema type updated.', data: { schemaType } });
});

export const deleteSchemaType = asyncHandler(async (req, res) => {
  const schemaType = await SchemaType.findById(req.params.schemaTypeId);
  if (!schemaType) throw ApiError.notFound('Schema type not found.');

  // Deactivated rather than removed: existing projects reference this type by
  // name, and deleting the row would strand them.
  schemaType.active = false;
  await schemaType.save();

  recordAudit({
    userId: req.user._id,
    action: AUDIT_ACTIONS.ADMIN_SCHEMA_TYPE_DELETED,
    resourceType: 'SchemaType',
    resourceId: schemaType._id,
    req,
  });

  return sendSuccess(res, { message: 'Schema type deactivated.', data: { schemaType } });
});

export default {
  dashboard,
  listUsers,
  getUser,
  updateUser,
  suspendUser,
  activateUser,
  adjustCredits,
  listProjects,
  listScans,
  listErrors,
  listAuditLogs,
  listSchemaTypes,
  createSchemaType,
  updateSchemaType,
  deleteSchemaType,
};
