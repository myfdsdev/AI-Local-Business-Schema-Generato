import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Structural validation for generated LocalBusiness JSON-LD.
 *
 * This is not a full schema.org type system — it is the deterministic gate that
 * stands between an LLM's output and the user, catching malformed shapes,
 * wrong value types, and (critically) fabricated-looking data such as a rating
 * with no review count. The generator never returns unvalidated JSON.
 */

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);

// Recognised LocalBusiness subtypes (spec section 7 plus the prompt's set). An
// unknown @type is a warning, not a hard failure — schema.org has hundreds.
const KNOWN_TYPES = new Set([
  'LocalBusiness',
  'Restaurant', 'FoodEstablishment', 'Bakery', 'CafeOrCoffeeShop', 'BarOrPub', 'FastFoodRestaurant',
  'Dentist', 'MedicalClinic', 'Physician', 'Pharmacy', 'Optician', 'VeterinaryCare',
  'ExerciseGym', 'HealthClub', 'Gym', 'SportsActivityLocation',
  'BeautySalon', 'HairSalon', 'NailSalon', 'DaySpa',
  'RealEstateAgent', 'LegalService', 'Attorney', 'AccountingService', 'FinancialService', 'InsuranceAgency', 'TravelAgency', 'ProfessionalService',
  'AutoRepair', 'AutoDealer', 'AutoPartsStore', 'GasStation',
  'Electrician', 'Plumber', 'RoofingContractor', 'Locksmith', 'HVACBusiness', 'HousePainter', 'HomeAndConstructionBusiness',
  'Store', 'ClothingStore', 'ElectronicsStore', 'FurnitureStore', 'GroceryStore', 'HardwareStore', 'JewelryStore', 'PetStore',
  'Hotel', 'Motel', 'LodgingBusiness', 'BedAndBreakfast',
  'ChildCare', 'School', 'EducationalOrganization', 'TouristInformationCenter',
]);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_PATTERN = '^([01]\\d|2[0-3]):[0-5]\\d$';

const jsonLdSchema = {
  type: 'object',
  required: ['@context', '@type'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { type: 'string', minLength: 1 },
    '@id': { type: 'string', format: 'uri' },
    name: { type: 'string', minLength: 1 },
    url: { type: 'string', format: 'uri' },
    telephone: { type: 'string' },
    priceRange: { type: 'string' },
    image: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    servesCuisine: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    sameAs: { type: 'array', items: { type: 'string', format: 'uri' } },
    address: {
      type: 'object',
      properties: {
        '@type': { const: 'PostalAddress' },
        streetAddress: { type: 'string' },
        addressLocality: { type: 'string' },
        addressRegion: { type: 'string' },
        postalCode: { type: 'string' },
        // ISO 3166-1 alpha-2.
        addressCountry: { type: 'string', pattern: '^[A-Z]{2}$' },
      },
      additionalProperties: true,
    },
    geo: {
      type: 'object',
      required: ['latitude', 'longitude'],
      properties: {
        '@type': { const: 'GeoCoordinates' },
        latitude: { type: 'number', minimum: -90, maximum: 90 },
        longitude: { type: 'number', minimum: -180, maximum: 180 },
      },
      additionalProperties: true,
    },
    openingHoursSpecification: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          '@type': { const: 'OpeningHoursSpecification' },
          dayOfWeek: {
            oneOf: [
              { type: 'string', enum: DAYS },
              { type: 'array', items: { type: 'string', enum: DAYS }, minItems: 1 },
            ],
          },
          opens: { type: 'string', pattern: TIME_PATTERN },
          closes: { type: 'string', pattern: TIME_PATTERN },
        },
        additionalProperties: true,
      },
    },
    aggregateRating: {
      type: 'object',
      required: ['ratingValue', 'reviewCount'],
      properties: {
        '@type': { const: 'AggregateRating' },
        ratingValue: { type: ['number', 'string'] },
        reviewCount: { type: ['number', 'string'] },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
};

const validateFn = ajv.compile(jsonLdSchema);

function formatAjvErrors(errors = []) {
  return errors.map((error) => ({
    code: 'JSONLD_INVALID',
    path: error.instancePath || '/',
    message: `${error.instancePath || 'root'} ${error.message}`.trim(),
  }));
}

/**
 * Advisory checks aligned with spec section 11 level 3. These never block
 * output; they surface honest, non-guaranteed recommendations.
 */
function buildRecommendations(graph) {
  const recommendations = [];
  const suggest = (message) => recommendations.push({ code: 'RECOMMENDATION', message });

  if (!graph.address) suggest('No address provided. A postal address strongly helps local search.');
  if (!graph.telephone) suggest('No phone number provided.');
  if (!graph.openingHoursSpecification) suggest('No opening hours provided.');
  if (!graph.geo) suggest('No geo coordinates provided.');
  if (!graph.image) suggest('No business image provided.');
  if (graph['@type'] === 'LocalBusiness') {
    suggest('Using the generic LocalBusiness type. A more specific subtype is usually better.');
  }
  if (graph['@type'] && !KNOWN_TYPES.has(graph['@type'])) {
    suggest(`"${graph['@type']}" is not a recognised LocalBusiness subtype. Double-check it exists on schema.org.`);
  }

  // A rating with no visible reviews is exactly the fabricated-review pattern
  // the spec warns about.
  if (graph.aggregateRating && !graph.review) {
    suggest('An aggregateRating is present without review content. Only publish ratings backed by real, visible reviews.');
  }

  return recommendations;
}

/**
 * Validates parsed JSON-LD. Returns { valid, errors, warnings, recommendations }.
 */
export function validateJsonLd(graph) {
  const warnings = [];

  if (graph == null || typeof graph !== 'object' || Array.isArray(graph)) {
    return {
      valid: false,
      errors: [{ code: 'JSONLD_INVALID', path: '/', message: 'Output is not a JSON object.' }],
      warnings,
      recommendations: [],
    };
  }

  const valid = validateFn(graph);
  const errors = valid ? [] : formatAjvErrors(validateFn.errors);

  // opens/closes should come as a pair.
  for (const [index, spec] of (graph.openingHoursSpecification ?? []).entries()) {
    if (spec && (Boolean(spec.opens) !== Boolean(spec.closes))) {
      warnings.push({
        code: 'HOURS_INCOMPLETE',
        path: `/openingHoursSpecification/${index}`,
        message: 'An opening-hours entry has only one of opens/closes.',
      });
    }
  }

  return { valid, errors, warnings, recommendations: buildRecommendations(graph) };
}

/**
 * Parses a raw model response defensively, then validates it. The prompt asks
 * for bare JSON, but a stray code fence or prose is stripped before parsing so
 * a minor formatting slip does not fail the whole request.
 */
export function parseAndValidate(rawText) {
  let cleaned = String(rawText ?? '').trim();

  // Strip ```json ... ``` fences if the model added them.
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) cleaned = fence[1].trim();

  // Fall back to the outermost {...} span if there is surrounding prose.
  if (!cleaned.startsWith('{')) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  }

  let graph;
  try {
    graph = JSON.parse(cleaned);
  } catch {
    return {
      graph: null,
      valid: false,
      errors: [{ code: 'JSONLD_UNPARSEABLE', path: '/', message: 'The generated output was not valid JSON.' }],
      warnings: [],
      recommendations: [],
    };
  }

  return { graph, ...validateJsonLd(graph) };
}

export default { validateJsonLd, parseAndValidate };
