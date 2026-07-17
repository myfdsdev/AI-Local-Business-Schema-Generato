import mongoose from 'mongoose';

import { TEAM_MEMBER_STATUS, TEAM_ROLES, TEAM_ROLE_VALUES } from '../config/constants.js';

const teamMemberSchema = new mongoose.Schema(
  {
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Null until an invited person accepts and their account exists.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    role: { type: String, enum: TEAM_ROLE_VALUES, default: TEAM_ROLES.VIEWER },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: TEAM_MEMBER_STATUS, default: 'invited', index: true },

    inviteToken: { type: String, default: null, select: false },
    inviteTokenExpires: { type: Date, default: null, select: false },

    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    invitedAt: { type: Date, default: () => new Date() },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

teamMemberSchema.index({ agencyId: 1, email: 1 }, { unique: true });

export const TeamMember =
  mongoose.models.TeamMember || mongoose.model('TeamMember', teamMemberSchema);

export default TeamMember;
