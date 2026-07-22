import mongoose from 'mongoose';

import {
  APP_ID,
  INVITATION_STATUS,
  INVITATION_STATUS_VALUES,
  WORKSPACE_ROLES,
  WORKSPACE_ROLE_VALUES,
} from '../config/constants.js';

/**
 * A single-use link that binds an incoming user to one workspace. Only the
 * digest of the token is stored, so a database leak cannot yield usable links.
 * The raw token lives only in the /join/<token> URL the owner sends.
 */
const invitationSchema = new mongoose.Schema(
  {
    appId: { type: String, default: APP_ID, index: true },
    workspaceId: { type: String, required: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    role: { type: String, enum: WORKSPACE_ROLE_VALUES, default: WORKSPACE_ROLES.MEMBER },
    tokenHash: { type: String, required: true, index: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: INVITATION_STATUS_VALUES, default: INVITATION_STATUS.PENDING },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const Invitation = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);

export default Invitation;
