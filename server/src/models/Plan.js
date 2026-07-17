import mongoose from 'mongoose';

import { BILLING_INTERVALS, PLAN_SLUG_VALUES } from '../config/constants.js';

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, enum: PLAN_SLUG_VALUES, index: true },
    description: { type: String, default: '' },

    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    billingInterval: { type: String, enum: BILLING_INTERVALS, default: 'month' },

    // -1 means unlimited.
    projectLimit: { type: Number, default: 1 },
    locationLimit: { type: Number, default: 1 },
    monthlyScanLimit: { type: Number, default: 5 },
    pageScanLimit: { type: Number, default: 5 },
    reportLimit: { type: Number, default: 1 },
    teamMemberLimit: { type: Number, default: 0 },

    whiteLabelEnabled: { type: Boolean, default: false },
    monitoringEnabled: { type: Boolean, default: false },

    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    features: { type: [String], default: [] },
  },
  { timestamps: true },
);

planSchema.statics.isUnlimited = (value) => value === -1;

export const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

export default Plan;
