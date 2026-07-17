import mongoose from 'mongoose';

/**
 * Detailed server-side error records (spec section 26). Users only ever see the
 * sanitized API message; the stack and request context land here for admins to
 * read at /admin/system-logs.
 */
const systemLogSchema = new mongoose.Schema(
  {
    level: { type: String, enum: ['error', 'warn', 'info'], default: 'error', index: true },
    message: { type: String, required: true },
    code: { type: String, default: '' },
    stack: { type: String, default: '' },

    // Correlates a log entry with the `requestId` returned to the client.
    requestId: { type: String, default: '', index: true },
    method: { type: String, default: '' },
    path: { type: String, default: '' },
    statusCode: { type: Number, default: null },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

systemLogSchema.index({ createdAt: -1 });
// Logs are diagnostic, not records of value: expire after 30 days.
systemLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', systemLogSchema);

export default SystemLog;
