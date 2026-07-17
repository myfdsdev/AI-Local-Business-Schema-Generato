import mongoose from 'mongoose';

const propertyDefinitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    label: { type: String, default: '' },
    // Maps to the editor control and to Level 1 JSON validation.
    valueType: {
      type: String,
      enum: ['text', 'url', 'email', 'telephone', 'number', 'date', 'time', 'boolean', 'array', 'object'],
      default: 'text',
    },
    description: { type: String, default: '' },
    expectedSchemaType: { type: String, default: '' },
    group: {
      type: String,
      enum: ['required', 'recommended', 'advanced'],
      default: 'advanced',
    },
    example: { type: String, default: '' },
  },
  { _id: false },
);

/**
 * Admin-managed registry of supported business types (spec section 7). The
 * frontend reads this rather than hardcoding a list, so an admin can add a
 * subtype without a code change.
 */
const schemaTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "Dentist"
    label: { type: String, required: true, trim: true }, // e.g. "Dentist"
    parentType: { type: String, default: 'LocalBusiness' },
    description: { type: String, default: '' },
    category: { type: String, default: 'general', index: true },

    requiredProperties: { type: [String], default: [] },
    recommendedProperties: { type: [String], default: [] },
    allowedProperties: { type: [String], default: [] },
    propertyDefinitions: { type: [propertyDefinitionSchema], default: [] },

    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/** Walks parentType up to LocalBusiness, e.g. Bakery -> FoodEstablishment -> LocalBusiness. */
schemaTypeSchema.methods.ancestry = async function ancestry() {
  const chain = [this.name];
  let current = this;
  const seen = new Set(chain);

  while (current?.parentType && !seen.has(current.parentType)) {
    chain.push(current.parentType);
    seen.add(current.parentType);
    current = await this.constructor.findOne({ name: current.parentType }).lean();
    if (!current) break;
  }

  return chain;
};

export const SchemaType = mongoose.models.SchemaType || mongoose.model('SchemaType', schemaTypeSchema);

export default SchemaType;
