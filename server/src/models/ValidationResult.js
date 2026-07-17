import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    path: { type: String, default: '' },
    // Which of the three validation levels produced this (spec section 11).
    level: { type: String, enum: ['json', 'schema_org', 'google_oriented'], default: 'json' },
  },
  { _id: false },
);

const validationResultSchema = new mongoose.Schema(
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

    jsonValid: { type: Boolean, default: false },
    schemaValid: { type: Boolean, default: false },

    errors: { type: [issueSchema], default: [] },
    warnings: { type: [issueSchema], default: [] },
    // Level 3 output is advisory only and must be presented as recommendations,
    // never as guaranteed Google outcomes.
    recommendations: { type: [issueSchema], default: [] },

    score: { type: Number, default: 0, min: 0, max: 100 },
    validatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

validationResultSchema.index({ schemaId: 1, validatedAt: -1 });

export const ValidationResult =
  mongoose.models.ValidationResult || mongoose.model('ValidationResult', validationResultSchema);

export default ValidationResult;
