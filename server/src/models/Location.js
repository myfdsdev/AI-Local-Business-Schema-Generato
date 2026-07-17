import mongoose from 'mongoose';

import {
  geoCoordinatesSchema,
  imageSchema,
  openingHoursSchema,
  postalAddressSchema,
  serviceSchema,
  socialProfilesSchema,
} from './shared.schemas.js';

const locationSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProject',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    // Each physical location needs its own public page: that URL is what makes
    // its @id unique, so two locations can never collide in the graph.
    pageUrl: { type: String, required: true, trim: true },

    businessType: { type: String, default: 'LocalBusiness' },

    address: { type: postalAddressSchema, default: () => ({}) },
    geo: { type: geoCoordinatesSchema, default: () => ({}) },
    telephone: { type: String, default: '' },
    email: { type: String, default: '' },

    openingHours: { type: [openingHoursSchema], default: [] },
    services: { type: [serviceSchema], default: [] },
    serviceAreas: { type: [String], default: [] },
    socialProfiles: { type: socialProfilesSchema, default: () => ({}) },
    images: { type: [imageSchema], default: [] },

    locationManager: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      telephone: { type: String, default: '' },
    },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

locationSchema.index({ projectId: 1, slug: 1 }, { unique: true });
locationSchema.index({ projectId: 1, createdAt: -1 });

export const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);

export default Location;
