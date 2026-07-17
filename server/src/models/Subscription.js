import mongoose from 'mongoose';

import { SUBSCRIPTION_STATUS, SUBSCRIPTION_STATUS_VALUES } from '../config/constants.js';

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },

    status: {
      type: String,
      enum: SUBSCRIPTION_STATUS_VALUES,
      default: SUBSCRIPTION_STATUS.ACTIVE,
      index: true,
    },

    // 'none' until a real billing provider is wired up in Phase 7.
    billingProvider: { type: String, enum: ['none', 'stripe'], default: 'none' },
    externalCustomerId: { type: String, default: null },
    externalSubscriptionId: { type: String, default: null },

    currentPeriodStart: { type: Date, default: () => new Date() },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1, status: 1 });

export const Subscription =
  mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
