import crypto from 'node:crypto';

import {
  APP_ID,
  MEMBER_STATUS,
  WORKSPACE_ROLES,
  WORKSPACE_STATUS,
} from '../../config/constants.js';
import { Workspace, WorkspaceMember } from '../../models/index.js';

/** Random, unguessable workspace id — never sequential. */
export function generateWorkspaceId() {
  return `ws_${crypto.randomBytes(18).toString('base64url')}`;
}

/** The caller's active membership, or null. A user is in one workspace here. */
export function findActiveMembership(userId) {
  return WorkspaceMember.findOne({
    appId: APP_ID,
    userId,
    status: MEMBER_STATUS.ACTIVE,
  }).lean();
}

/**
 * Guarantees the user has a workspace. On self-registration this creates their
 * personal workspace with them as owner; it also self-heals any pre-existing
 * user who has no membership yet (e.g. accounts created before multi-tenancy),
 * so no separate backfill migration is needed.
 */
export async function ensurePersonalWorkspace({ userId, name = '' }) {
  const existing = await findActiveMembership(userId);
  if (existing) return existing;

  const workspaceId = generateWorkspaceId();
  await Workspace.create({
    appId: APP_ID,
    workspaceId,
    name,
    ownerUserId: userId,
    status: WORKSPACE_STATUS.ACTIVE,
  });
  const member = await WorkspaceMember.create({
    appId: APP_ID,
    workspaceId,
    userId,
    role: WORKSPACE_ROLES.OWNER,
    status: MEMBER_STATUS.ACTIVE,
  });

  return member.toObject();
}

export default { generateWorkspaceId, findActiveMembership, ensurePersonalWorkspace };
