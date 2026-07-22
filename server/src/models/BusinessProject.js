import mongoose from 'mongoose';

import {
  APP_ID,
  CMS_OPTIONS,
  LOCATION_MODES,
  LOCATION_MODE_VALUES,
  PROJECT_STATUS,
  PROJECT_STATUS_VALUES,
} from '../config/constants.js';

const businessProjectSchema = new mongoose.Schema(
  {
    appId: { type: String, default: APP_ID, index: true },
    // The buyer/tenant this project belongs to — the isolation boundary.
    workspaceId: { type: String, required: true, index: true },
    // The individual member who created it (members see only their own).
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Set when the project belongs to an agency workspace rather than a single user.
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    projectName: { type: String, required: true, trim: true, maxlength: 160 },
    websiteUrl: { type: String, required: true, trim: true },
    // Canonical host, used to detect duplicate projects for the same site.
    normalizedDomain: { type: String, required: true, index: true },

    businessName: { type: String, required: true, trim: true, maxlength: 200 },
    businessType: { type: String, default: 'LocalBusiness' },
    country: { type: String, required: true, maxlength: 2, uppercase: true },
    language: { type: String, default: 'en', maxlength: 10 },
    cms: { type: String, enum: CMS_OPTIONS, default: 'other' },
    locationMode: { type: String, enum: LOCATION_MODE_VALUES, default: LOCATION_MODES.SINGLE },

    status: {
      type: String,
      enum: PROJECT_STATUS_VALUES,
      default: PROJECT_STATUS.DRAFT,
      index: true,
    },

    schemaHealthScore: { type: Number, default: null, min: 0, max: 100 },
    previousSchemaHealthScore: { type: Number, default: null, min: 0, max: 100 },

    lastScannedAt: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Dashboard lists are always "this workspace's projects, newest first".
businessProjectSchema.index({ workspaceId: 1, createdAt: -1 });
businessProjectSchema.index({ workspaceId: 1, status: 1 });
businessProjectSchema.index({ workspaceId: 1, userId: 1, createdAt: -1 });
// Duplicate guard: one project per domain per WORKSPACE, ignoring archived ones.
businessProjectSchema.index(
  { workspaceId: 1, normalizedDomain: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: PROJECT_STATUS.ARCHIVED } } },
);

businessProjectSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

export const BusinessProject =
  mongoose.models.BusinessProject || mongoose.model('BusinessProject', businessProjectSchema);

export default BusinessProject;
