import mongoose from 'mongoose';

import { APP_ID, WORKSPACE_STATUS, WORKSPACE_STATUS_VALUES } from '../config/constants.js';

/**
 * A workspace is one buyer's isolated tenant. Its `workspaceId` is the wall
 * between customers — every tenant-owned record carries it and every query is
 * scoped by it. Created either on self-registration (a personal workspace) or
 * by the AppsFields hub via /platform/provision.
 */
const workspaceSchema = new mongoose.Schema(
  {
    appId: { type: String, default: APP_ID, index: true },
    // Stable public id used across the platform and stamped on every record.
    workspaceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, trim: true, maxlength: 200, default: '' },
    // Null until a hub-provisioned owner accepts their join link and sets a
    // password. Self-registered workspaces set it immediately.
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Filled for workspaces created by the AppsFields hub.
    ownerEmail: { type: String, trim: true, lowercase: true, default: '' },
    status: {
      type: String,
      enum: WORKSPACE_STATUS_VALUES,
      default: WORKSPACE_STATUS.ACTIVE,
      index: true,
    },
  },
  { timestamps: true },
);

export const Workspace = mongoose.models.Workspace || mongoose.model('Workspace', workspaceSchema);

export default Workspace;
