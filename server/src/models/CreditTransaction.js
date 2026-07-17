import mongoose from 'mongoose';

import { CREDIT_TRANSACTION_TYPE_VALUES } from '../config/constants.js';

/**
 * Append-only ledger for scan credits (spec section 24). Every movement is
 * recorded with the balance either side, so a user's current balance can always
 * be reconciled against its history.
 */
const creditTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Negative for reserve/consume, positive for grant/refund.
    amount: { type: Number, required: true },
    type: { type: String, enum: CREDIT_TRANSACTION_TYPE_VALUES, required: true, index: true },
    reason: { type: String, default: '' },

    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProject', default: null },
    scanId: { type: mongoose.Schema.Types.ObjectId, ref: 'WebsiteScan', default: null, index: true },

    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

creditTransactionSchema.index({ userId: 1, createdAt: -1 });

export const CreditTransaction =
  mongoose.models.CreditTransaction || mongoose.model('CreditTransaction', creditTransactionSchema);

export default CreditTransaction;
