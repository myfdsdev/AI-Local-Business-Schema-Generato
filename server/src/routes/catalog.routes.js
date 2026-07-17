import { Router } from 'express';

import { Plan, SchemaType } from '../models/index.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Read-only reference data the client needs before sign-in (pricing page) and
 * inside the app (business type picker). Admin writes live under /admin.
 */
const router = Router();

router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await Plan.find({ active: true }).sort({ sortOrder: 1, price: 1 }).lean();
    return sendSuccess(res, { message: 'OK', data: { plans } });
  }),
);

router.get(
  '/schema-types',
  asyncHandler(async (req, res) => {
    const criteria = { active: true };
    if (req.query.category) criteria.category = String(req.query.category);

    const schemaTypes = await SchemaType.find(criteria)
      .select('name label parentType description category requiredProperties recommendedProperties sortOrder')
      .sort({ sortOrder: 1, label: 1 })
      .lean();

    return sendSuccess(res, { message: 'OK', data: { schemaTypes } });
  }),
);

export default router;
