import mongoose from 'mongoose';

import {
  extractedFieldSchema,
  geoCoordinatesSchema,
  imageSchema,
  openingHoursSchema,
  postalAddressSchema,
  serviceSchema,
  socialProfilesSchema,
  staffSchema,
} from './shared.schemas.js';

/**
 * The confirmed source of truth for a project's business facts.
 *
 * `extractedFields` holds the provenance envelope for every value the scanner
 * proposed (value + source + confidence + method). The typed groups below hold
 * the current working values the user edits. Schema generation reads the typed
 * groups, but only after the required fields appear in `confirmedFields`.
 */
const businessDataSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProject',
      required: true,
      unique: true,
      index: true,
    },

    identity: {
      businessName: { type: String, default: '' },
      legalName: { type: String, default: '' },
      description: { type: String, default: '' },
      businessType: { type: String, default: 'LocalBusiness' },
      logo: { type: String, default: '' },
      primaryImage: { type: String, default: '' },
      websiteUrl: { type: String, default: '' },
      foundingDate: { type: String, default: '' },
    },

    contact: {
      telephone: { type: String, default: '' },
      email: { type: String, default: '' },
      contactPageUrl: { type: String, default: '' },
      bookingUrl: { type: String, default: '' },
      appointmentUrl: { type: String, default: '' },
      orderUrl: { type: String, default: '' },
    },

    address: { type: postalAddressSchema, default: () => ({}) },
    geo: { type: geoCoordinatesSchema, default: () => ({}) },
    openingHours: { type: [openingHoursSchema], default: [] },
    services: { type: [serviceSchema], default: [] },
    socialProfiles: { type: socialProfilesSchema, default: () => ({}) },
    images: { type: [imageSchema], default: [] },
    staff: { type: [staffSchema], default: [] },

    serviceAreas: { type: [String], default: [] },
    paymentMethods: { type: [String], default: [] },
    priceRange: { type: String, default: '' },
    currenciesAccepted: { type: [String], default: [] },
    languages: { type: [String], default: [] },

    // Category-specific extras (spec section 5, "Additional Data").
    cuisine: { type: [String], default: [] },
    menuUrl: { type: String, default: '' },
    amenities: { type: [String], default: [] },

    extractedFields: { type: [extractedFieldSchema], default: [] },
    confirmedFields: { type: [String], default: [] },

    lastExtractedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/** Dotted field paths that must be confirmed before schema generation. */
businessDataSchema.statics.REQUIRED_FIELDS = Object.freeze([
  'identity.businessName',
  'identity.businessType',
  'identity.websiteUrl',
]);

businessDataSchema.methods.isFieldConfirmed = function isFieldConfirmed(field) {
  return this.confirmedFields.includes(field);
};

/** Required fields still awaiting user confirmation (spec section 9). */
businessDataSchema.methods.unconfirmedRequiredFields = function unconfirmedRequiredFields() {
  return this.constructor.REQUIRED_FIELDS.filter((field) => !this.confirmedFields.includes(field));
};

export const BusinessData =
  mongoose.models.BusinessData || mongoose.model('BusinessData', businessDataSchema);

export default BusinessData;
