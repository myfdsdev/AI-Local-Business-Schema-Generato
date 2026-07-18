import mongoose from 'mongoose';

import { INSTALL_STATUS_VALUES } from '../config/constants.js';
import { detectedSchemaSchema } from './shared.schemas.js';

const differenceSchema = new mongoose.Schema(
  {
    path: { type: String, required: true },
    kind: {
      type: String,
      enum: ['missing_entity', 'missing_property', 'outdated_value', 'duplicate_entity', 'extra_property'],
      required: true,
    },
    expected: { type: mongoose.Schema.Types.Mixed, default: null },
    actual: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

/** Every verification attempt is retained (spec section 15), never overwritten. */
const verificationResultSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProject',
      required: true,
      index: true,
    },
    schemaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SchemaDocument',
      required: true,
      index: true,
    },

    targetUrl: { type: String, required: true },
    status: { type: String, enum: INSTALL_STATUS_VALUES, required: true },

    detectedSchemas: { type: [detectedSchemaSchema], default: [] },
    differences: { type: [differenceSchema], default: [] },

    errors: { type: [{ code: String, message: String }], default: [] },
    warnings: { type: [{ code: String, message: String }], default: [] },

    verifiedAt: { type: Date, default: () => new Date() },
  },
  // `errors` is a reserved Mongoose path; the spec mandates this field name.
  { timestamps: true, suppressReservedKeysWarning: true },
);

verificationResultSchema.index({ schemaId: 1, verifiedAt: -1 });

export const VerificationResult =
  mongoose.models.VerificationResult || mongoose.model('VerificationResult', verificationResultSchema);

export default VerificationResult;
