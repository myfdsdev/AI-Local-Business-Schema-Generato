import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import {
  ACCOUNT_TYPE_VALUES,
  INITIAL_SCAN_CREDITS,
  ONBOARDING_BUSINESS_CATEGORIES,
  ONBOARDING_EXPERIENCE_LEVELS,
  ONBOARDING_GOAL_VALUES,
  ONBOARDING_LOCATION_BANDS,
  PLAN_SLUGS,
  PLAN_SLUG_VALUES,
  ROLES,
  ROLE_VALUES,
  USER_STATUS,
  USER_STATUS_VALUES,
} from '../config/constants.js';

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // `select: false` keeps the hash out of every query result by default; it
    // must be explicitly selected by the one place that verifies passwords.
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: ROLE_VALUES, default: ROLES.USER, index: true },
    accountType: { type: String, enum: ACCOUNT_TYPE_VALUES, default: null },
    companyName: { type: String, trim: true, maxlength: 160, default: '' },
    profileImage: { type: String, default: '' },

    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null, select: false },
    verificationTokenExpires: { type: Date, default: null, select: false },

    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },

    plan: { type: String, enum: PLAN_SLUG_VALUES, default: PLAN_SLUGS.FREE },
    scanCredits: { type: Number, default: INITIAL_SCAN_CREDITS, min: 0 },

    status: { type: String, enum: USER_STATUS_VALUES, default: USER_STATUS.ACTIVE, index: true },

    // Answers to the post-login onboarding questionnaire (spec section 4).
    onboarding: {
      completed: { type: Boolean, default: false },
      goal: { type: String, enum: ONBOARDING_GOAL_VALUES, default: null },
      businessCategory: { type: String, enum: ONBOARDING_BUSINESS_CATEGORIES, default: null },
      locationCount: { type: String, enum: ONBOARDING_LOCATION_BANDS, default: null },
      experienceLevel: { type: String, enum: ONBOARDING_EXPERIENCE_LEVELS, default: null },
      completedAt: { type: Date, default: null },
    },

    // Bumped on password change and account deletion so refresh tokens minted
    // before that moment stop validating (spec section 3, session expiration).
    tokenVersion: { type: Number, default: 0 },

    lastLoginAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.verificationToken;
        delete ret.verificationTokenExpires;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ resetPasswordToken: 1 }, { sparse: true });
userSchema.index({ verificationToken: 1 }, { sparse: true });

userSchema.virtual('isAdmin').get(function isAdmin() {
  return this.role === ROLES.ADMIN;
});

userSchema.virtual('isAgency').get(function isAgency() {
  return this.role === ROLES.AGENCY;
});

/**
 * Assigning to `user.password` is the only supported way to set a password;
 * the pre-save hook hashes it and the plaintext never reaches the document.
 */
userSchema
  .virtual('password')
  .set(function setPassword(value) {
    this._plainPassword = value;
  })
  .get(function getPassword() {
    return this._plainPassword;
  });

// Hashing runs on `pre('validate')`, not `pre('save')`: Mongoose validates
// before its save hooks, so hashing any later would let the `required`
// constraint on `passwordHash` fail while a password was in fact supplied.
userSchema.pre('validate', async function hashPassword(next) {
  if (!this._plainPassword) return next();

  try {
    this.passwordHash = await bcrypt.hash(this._plainPassword, BCRYPT_ROUNDS);
    this._plainPassword = undefined;
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.verifyPassword = function verifyPassword(candidate) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.isActive = function isActive() {
  return this.status === USER_STATUS.ACTIVE;
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
