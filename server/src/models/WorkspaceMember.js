import mongoose from 'mongoose';

import {
  APP_ID,
  MEMBER_STATUS,
  MEMBER_STATUS_VALUES,
  WORKSPACE_ROLES,
  WORKSPACE_ROLE_VALUES,
} from '../config/constants.js';

/**
 * The map from a user to their workspace (buyer). This is what "routes a user to
 * the right buyer": on login, the user's membership decides their workspaceId —
 * never the URL. A user is normally in exactly one workspace in this app.
 */
const workspaceMemberSchema = new mongoose.Schema(
  {
    appId: { type: String, default: APP_ID, index: true },
    workspaceId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: WORKSPACE_ROLE_VALUES, default: WORKSPACE_ROLES.MEMBER },
    status: { type: String, enum: MEMBER_STATUS_VALUES, default: MEMBER_STATUS.ACTIVE, index: true },
  },
  { timestamps: true },
);

// One membership per user per workspace.
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const WorkspaceMember =
  mongoose.models.WorkspaceMember || mongoose.model('WorkspaceMember', workspaceMemberSchema);

export default WorkspaceMember;
