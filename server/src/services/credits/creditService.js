import { CREDIT_TRANSACTION_TYPES, ERROR_CODES } from '../../config/constants.js';
import { CreditTransaction, User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';

/**
 * Scan credit ledger (spec section 24).
 *
 * Balance changes go through `applyDelta`, which uses a conditional atomic
 * update rather than read-modify-write. Two concurrent scans can otherwise both
 * read the same balance and each deduct from it, letting a user overspend. The
 * `$gte` guard makes the debit itself the concurrency check: if the balance
 * moved underneath us, the update matches nothing and we fail loudly.
 */
async function applyDelta({ userId, amount, type, reason, projectId, scanId, createdBy }) {
  const filter = { _id: userId };
  // For debits, only match if the balance can still cover them.
  if (amount < 0) filter.scanCredits = { $gte: Math.abs(amount) };

  const updated = await User.findOneAndUpdate(
    filter,
    { $inc: { scanCredits: amount } },
    { new: true, projection: { scanCredits: 1 } },
  );

  if (!updated) {
    const user = await User.findById(userId).select('scanCredits').lean();
    if (!user) throw ApiError.notFound('User not found.');

    throw new ApiError(402, 'You do not have enough scan credits for this action.', {
      code: ERROR_CODES.INSUFFICIENT_CREDITS,
      errors: [{ field: 'scanCredits', available: user.scanCredits, required: Math.abs(amount) }],
    });
  }

  const balanceAfter = updated.scanCredits;
  const balanceBefore = balanceAfter - amount;

  await CreditTransaction.create({
    userId,
    amount,
    type,
    reason: reason ?? '',
    projectId: projectId ?? null,
    scanId: scanId ?? null,
    balanceBefore,
    balanceAfter,
    createdBy: createdBy ?? null,
  });

  return { balanceBefore, balanceAfter };
}

export function grantCredits({ userId, amount, reason, createdBy }) {
  if (amount <= 0) throw ApiError.badRequest('Granted credit amount must be positive.');
  return applyDelta({
    userId,
    amount,
    type: CREDIT_TRANSACTION_TYPES.GRANT,
    reason,
    createdBy,
  });
}

/** Held up front so a scan cannot start without the credits to finish it. */
export function reserveCredits({ userId, amount, reason, projectId, scanId }) {
  if (amount <= 0) throw ApiError.badRequest('Reserved credit amount must be positive.');
  return applyDelta({
    userId,
    amount: -amount,
    type: CREDIT_TRANSACTION_TYPES.RESERVE,
    reason,
    projectId,
    scanId,
  });
}

/**
 * Returns unused credits from a reservation — on cancellation, or when fewer
 * pages were scanned than reserved. Internal retries reuse the existing
 * reservation and so never double-charge.
 */
export function refundCredits({ userId, amount, reason, projectId, scanId }) {
  if (amount <= 0) throw ApiError.badRequest('Refunded credit amount must be positive.');
  return applyDelta({
    userId,
    amount,
    type: CREDIT_TRANSACTION_TYPES.REFUND,
    reason,
    projectId,
    scanId,
  });
}

export function adminAdjustCredits({ userId, amount, reason, createdBy }) {
  if (amount === 0) throw ApiError.badRequest('Adjustment amount cannot be zero.');
  return applyDelta({
    userId,
    amount,
    type: CREDIT_TRANSACTION_TYPES.ADMIN_ADJUSTMENT,
    reason,
    createdBy,
  });
}

export async function getBalance(userId) {
  const user = await User.findById(userId).select('scanCredits').lean();
  if (!user) throw ApiError.notFound('User not found.');
  return user.scanCredits;
}

export async function listTransactions({ userId, limit = 20, skip = 0 }) {
  const [items, total] = await Promise.all([
    CreditTransaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    CreditTransaction.countDocuments({ userId }),
  ]);
  return { items, total };
}

export default {
  grantCredits,
  reserveCredits,
  refundCredits,
  adminAdjustCredits,
  getBalance,
  listTransactions,
};
