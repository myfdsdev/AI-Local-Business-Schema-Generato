import logger from '../../config/logger.js';
import { AuditLog } from '../../models/index.js';

export const AUDIT_ACTIONS = Object.freeze({
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_ACCOUNT_DELETED: 'user.account_deleted',

  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_ARCHIVED: 'project.archived',
  PROJECT_RESTORED: 'project.restored',

  ADMIN_USER_UPDATED: 'admin.user_updated',
  ADMIN_USER_SUSPENDED: 'admin.user_suspended',
  ADMIN_USER_ACTIVATED: 'admin.user_activated',
  ADMIN_CREDITS_ADJUSTED: 'admin.credits_adjusted',
  ADMIN_SCHEMA_TYPE_CREATED: 'admin.schema_type_created',
  ADMIN_SCHEMA_TYPE_UPDATED: 'admin.schema_type_updated',
  ADMIN_SCHEMA_TYPE_DELETED: 'admin.schema_type_deleted',
});

/** Request context for an audit entry. Falls back safely outside HTTP calls. */
export function auditContext(req) {
  return {
    ipAddress: req?.ip ?? '',
    userAgent: req?.get?.('user-agent') ?? '',
  };
}

/**
 * Never throws: an audit write failing must not break the action it records.
 * Not awaited by callers on hot paths — failures surface in the system log.
 */
export async function recordAudit({ userId, action, resourceType, resourceId, metadata, req }) {
  try {
    await AuditLog.create({
      userId: userId ?? null,
      action,
      resourceType: resourceType ?? '',
      resourceId: resourceId ? String(resourceId) : '',
      metadata: metadata ?? {},
      ...auditContext(req),
    });
  } catch (error) {
    logger.error('Failed to write audit log', { action, message: error.message });
  }
}

export default { recordAudit, AUDIT_ACTIONS, auditContext };
