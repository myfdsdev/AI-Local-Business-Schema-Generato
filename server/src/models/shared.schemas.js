import mongoose from 'mongoose';

import { CONFIDENCE_BANDS, EXTRACTION_METHODS, SCHEMA_FORMATS } from '../config/constants.js';

const { Schema } = mongoose;

/**
 * Sub-schemas shared by BusinessData and Location. Both describe the same
 * real-world business shape, so they must stay structurally identical — the
 * schema generator maps either one through the same code path.
 */

export const postalAddressSchema = new Schema(
  {
    streetAddress: { type: String, default: '', trim: true },
    addressLocality: { type: String, default: '', trim: true },
    addressRegion: { type: String, default: '', trim: true },
    postalCode: { type: String, default: '', trim: true },
    addressCountry: { type: String, default: '', trim: true, maxlength: 2, uppercase: true },
  },
  { _id: false },
);

export const geoCoordinatesSchema = new Schema(
  {
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
  },
  { _id: false },
);

/**
 * One row per day-range, mirroring schema.org OpeningHoursSpecification.
 * `closed` and `opensAllDay` are stored explicitly rather than inferred, so a
 * business that is genuinely closed is never confused with missing data.
 */
export const openingHoursSchema = new Schema(
  {
    dayOfWeek: {
      type: [String],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      default: [],
    },
    opens: { type: String, default: null }, // "09:00"
    closes: { type: String, default: null }, // "17:30"
    closed: { type: Boolean, default: false },
    opensAllDay: { type: Boolean, default: false },
    validFrom: { type: Date, default: null },
    validThrough: { type: Date, default: null },
    isSpecialHours: { type: Boolean, default: false },
  },
  { _id: false },
);

export const serviceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    url: { type: String, default: '' },
    price: { type: Number, default: null },
    priceCurrency: { type: String, default: '', uppercase: true, maxlength: 3 },
    priceRange: { type: String, default: '' },
    serviceArea: { type: [String], default: [] },
  },
  { _id: true },
);

export const socialProfilesSchema = new Schema(
  {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    youtube: { type: String, default: '' },
    x: { type: String, default: '' },
    pinterest: { type: String, default: '' },
    tiktok: { type: String, default: '' },
    googleBusinessProfile: { type: String, default: '' },
  },
  { _id: false },
);

export const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    caption: { type: String, default: '' },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    role: { type: String, enum: ['logo', 'primary', 'gallery'], default: 'gallery' },
  },
  { _id: true },
);

export const staffSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    jobTitle: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    url: { type: String, default: '' },
    sameAs: { type: [String], default: [] },
  },
  { _id: true },
);

/**
 * Provenance wrapper required by spec section 5: every extracted value must
 * carry where it came from, how confident we are, and whether a human has
 * confirmed it. Nothing reaches the schema generator without this envelope.
 */
export const extractedFieldSchema = new Schema(
  {
    field: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: null },
    sourceUrl: { type: String, default: '' },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
    method: { type: String, enum: EXTRACTION_METHODS, default: 'website_text' },
    confirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
    missing: { type: Boolean, default: false },
  },
  { _id: false },
);

/** Confidence percentage -> band shown in the editor (spec section 9). */
export function confidenceBand(confidence, method) {
  if (method === 'manual_entry') return CONFIDENCE_BANDS.MANUAL;
  if (confidence >= 80) return CONFIDENCE_BANDS.HIGH;
  if (confidence >= 50) return CONFIDENCE_BANDS.MEDIUM;
  return CONFIDENCE_BANDS.LOW;
}

/** A structured-data block found on the user's existing site (spec section 12). */
export const detectedSchemaSchema = new Schema(
  {
    pageUrl: { type: String, required: true },
    format: { type: String, enum: SCHEMA_FORMATS, required: true },
    schemaTypes: { type: [String], default: [] },
    rawMarkup: { type: String, default: '' },
    generator: {
      type: String,
      enum: ['yoast', 'rankmath', 'shopify', 'wix', 'squarespace', 'custom', 'unknown'],
      default: 'unknown',
    },
    validationErrors: { type: [String], default: [] },
    conflictingProperties: { type: [String], default: [] },
    duplicateEntities: { type: [String], default: [] },
  },
  { _id: true },
);
