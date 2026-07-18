import mongoose from 'mongoose';

import { PAGE_TYPES, SCAN_STATUS, SCAN_STATUS_VALUES, SCAN_STEPS } from '../config/constants.js';
import { detectedSchemaSchema } from './shared.schemas.js';

const scannedPageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    pageType: { type: String, enum: PAGE_TYPES, default: 'homepage' },
    statusCode: { type: Number, default: null },
    title: { type: String, default: '' },
    // Renderer actually used for this page; Playwright is the Cheerio fallback.
    renderer: { type: String, enum: ['cheerio', 'playwright'], default: 'cheerio' },
    textLength: { type: Number, default: 0 },
    fetchedAt: { type: Date, default: null },
  },
  { _id: true },
);

const failedPageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    reason: { type: String, default: '' },
    statusCode: { type: Number, default: null },
    attempts: { type: Number, default: 1 },
  },
  { _id: true },
);

const websiteScanSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProject',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: { type: String, enum: SCAN_STATUS_VALUES, default: SCAN_STATUS.QUEUED, index: true },

    requestedPages: { type: [String], default: [] },
    discoveredPages: { type: [String], default: [] },
    scannedPages: { type: [scannedPageSchema], default: [] },
    failedPages: { type: [failedPageSchema], default: [] },

    // Progress is derived from real crawl state, never simulated.
    currentStep: { type: String, enum: SCAN_STEPS, default: SCAN_STEPS[0] },
    progress: { type: Number, default: 0, min: 0, max: 100 },

    pageLimit: { type: Number, default: 5 },
    creditsReserved: { type: Number, default: 0 },
    creditsConsumed: { type: Number, default: 0 },

    sitemapUrl: { type: String, default: null },
    robotsTxtStatus: {
      type: String,
      enum: ['found', 'not_found', 'disallowed', 'error', 'unknown'],
      default: 'unknown',
    },

    extractedBusinessData: { type: mongoose.Schema.Types.Mixed, default: null },
    detectedSchemas: { type: [detectedSchemaSchema], default: [] },

    errors: { type: [{ code: String, message: String, url: String }], default: [] },
    warnings: { type: [{ code: String, message: String, url: String }], default: [] },

    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  // `errors` is a reserved Mongoose path; the spec mandates the field name, so
  // acknowledge it rather than rename. Only accessed via markModified/direct
  // assignment, never Mongoose's validation-error accessor.
  { timestamps: true, suppressReservedKeysWarning: true },
);

websiteScanSchema.index({ projectId: 1, createdAt: -1 });
websiteScanSchema.index({ userId: 1, status: 1 });

export const WebsiteScan =
  mongoose.models.WebsiteScan || mongoose.model('WebsiteScan', websiteScanSchema);

export default WebsiteScan;
