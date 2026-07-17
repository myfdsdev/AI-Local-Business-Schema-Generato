import mongoose from 'mongoose';

import {
  INSTALL_STATUS,
  INSTALL_STATUS_VALUES,
  SCHEMA_STATUS,
  SCHEMA_STATUS_VALUES,
} from '../config/constants.js';

const issueSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    path: { type: String, default: '' },
    severity: { type: String, enum: ['error', 'warning', 'info'], default: 'error' },
  },
  { _id: false },
);

const schemaDocumentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProject',
      required: true,
      index: true,
    },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    pageUrl: { type: String, required: true },
    schemaName: { type: String, required: true, trim: true },
    schemaTypes: { type: [String], default: [] },

    // The connected @graph (spec section 8) and its serialized form.
    graph: { type: mongoose.Schema.Types.Mixed, default: null },
    jsonLd: { type: String, default: '' },

    status: { type: String, enum: SCHEMA_STATUS_VALUES, default: SCHEMA_STATUS.DRAFT, index: true },
    validationErrors: { type: [issueSchema], default: [] },
    validationWarnings: { type: [issueSchema], default: [] },

    installedStatus: {
      type: String,
      enum: INSTALL_STATUS_VALUES,
      default: INSTALL_STATUS.NOT_INSTALLED,
    },
    // Comparing these two hashes is how "generated schema has changed" is
    // detected: installedHash is what was last seen live on the page.
    installedHash: { type: String, default: null },
    generatedHash: { type: String, default: null },
    markedInstalledAt: { type: Date, default: null },

    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

schemaDocumentSchema.index({ projectId: 1, createdAt: -1 });
schemaDocumentSchema.index({ projectId: 1, locationId: 1, version: -1 });

export const SchemaDocument =
  mongoose.models.SchemaDocument || mongoose.model('SchemaDocument', schemaDocumentSchema);

export default SchemaDocument;
