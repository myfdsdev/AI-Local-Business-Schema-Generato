/**
 * The supported business types from spec section 7, seeded into the SchemaType
 * collection so an admin can add or change types without a code change.
 *
 * `parentType` records the real schema.org hierarchy (Bakery -> FoodEstablishment
 * -> LocalBusiness), which the Phase 4 mapper walks to collect inherited
 * properties. Per-type entries below list only what that type *adds*.
 */

/** Every LocalBusiness carries these. */
const BASE_REQUIRED = ['name', 'url'];

const BASE_RECOMMENDED = [
  'description',
  'image',
  'logo',
  'telephone',
  'address',
  'geo',
  'openingHoursSpecification',
  'priceRange',
  'sameAs',
];

const BASE_ALLOWED = [
  ...BASE_REQUIRED,
  ...BASE_RECOMMENDED,
  '@id',
  'legalName',
  'email',
  'faxNumber',
  'foundingDate',
  'founder',
  'numberOfEmployees',
  'areaServed',
  'currenciesAccepted',
  'paymentAccepted',
  'hasMap',
  'isicV4',
  'slogan',
  'knowsLanguage',
  'employee',
  'department',
  'parentOrganization',
  'makesOffer',
  'hasOfferCatalog',
  'contactPoint',
  'potentialAction',
  'aggregateRating',
  'review',
];

/** Property help text shown as tooltips in the schema builder. */
const BASE_PROPERTY_DEFINITIONS = [
  { name: 'name', label: 'Business name', valueType: 'text', group: 'required', description: 'The name customers know this business by.', example: 'Bella Vista Trattoria' },
  { name: 'url', label: 'Website URL', valueType: 'url', group: 'required', description: 'The canonical homepage for this business.', example: 'https://example.com' },
  { name: 'description', label: 'Description', valueType: 'text', group: 'recommended', description: 'A concise summary of what the business does.' },
  { name: 'image', label: 'Primary image', valueType: 'url', group: 'recommended', description: 'A photo of the business. Google favours real, in-context images.', expectedSchemaType: 'ImageObject' },
  { name: 'logo', label: 'Logo', valueType: 'url', group: 'recommended', description: 'The business logo, used on the Organization entity.', expectedSchemaType: 'ImageObject' },
  { name: 'telephone', label: 'Phone number', valueType: 'telephone', group: 'recommended', description: 'Include the country code, e.g. +1-555-0100.' },
  { name: 'address', label: 'Address', valueType: 'object', group: 'recommended', description: 'The physical street address.', expectedSchemaType: 'PostalAddress' },
  { name: 'geo', label: 'Coordinates', valueType: 'object', group: 'recommended', description: 'Latitude and longitude of the business location.', expectedSchemaType: 'GeoCoordinates' },
  { name: 'openingHoursSpecification', label: 'Opening hours', valueType: 'array', group: 'recommended', description: 'Days and times the business is open.', expectedSchemaType: 'OpeningHoursSpecification' },
  { name: 'priceRange', label: 'Price range', valueType: 'text', group: 'recommended', description: 'A relative indicator such as $$ or a range.', example: '$$' },
  { name: 'sameAs', label: 'Social profiles', valueType: 'array', group: 'recommended', description: 'Official profile URLs that identify this same business.' },
  { name: 'email', label: 'Email', valueType: 'email', group: 'advanced', description: 'A public contact address for the business.' },
  { name: 'areaServed', label: 'Service area', valueType: 'array', group: 'advanced', description: 'Where the business serves customers. Use this for service-area businesses without a public storefront.' },
  { name: 'paymentAccepted', label: 'Payment methods', valueType: 'array', group: 'advanced', description: 'Payment types the business accepts.' },
];

/**
 * [name, label, parentType, category, extraRequired, extraRecommended]
 * Only the deltas over the inherited base are listed.
 */
const TYPE_TABLE = [
  ['LocalBusiness', 'Local business (generic)', 'Organization', 'general', [], []],
  ['Organization', 'Organization', null, 'general', ['name', 'url'], ['logo', 'sameAs', 'contactPoint']],

  // Food and drink
  ['FoodEstablishment', 'Food establishment', 'LocalBusiness', 'food', [], ['servesCuisine', 'menu', 'acceptsReservations']],
  ['Restaurant', 'Restaurant', 'FoodEstablishment', 'food', [], ['servesCuisine', 'menu', 'acceptsReservations', 'starRating']],
  ['Bakery', 'Bakery', 'FoodEstablishment', 'food', [], ['servesCuisine', 'menu']],
  ['CafeOrCoffeeShop', 'Cafe or coffee shop', 'FoodEstablishment', 'food', [], ['servesCuisine', 'menu']],
  ['BarOrPub', 'Bar or pub', 'FoodEstablishment', 'food', [], ['servesCuisine', 'menu']],
  ['FastFoodRestaurant', 'Fast food restaurant', 'FoodEstablishment', 'food', [], ['servesCuisine', 'menu', 'drivethrough']],

  // Health and medical
  ['MedicalClinic', 'Medical clinic', 'LocalBusiness', 'health', [], ['medicalSpecialty', 'availableService', 'isAcceptingNewPatients']],
  ['Dentist', 'Dentist', 'LocalBusiness', 'health', [], ['medicalSpecialty', 'availableService', 'isAcceptingNewPatients']],
  ['Physician', 'Physician', 'LocalBusiness', 'health', [], ['medicalSpecialty', 'availableService', 'isAcceptingNewPatients']],
  ['Pharmacy', 'Pharmacy', 'LocalBusiness', 'health', [], ['availableService']],
  ['Optician', 'Optician', 'LocalBusiness', 'health', [], ['availableService']],
  ['VeterinaryCare', 'Veterinary care', 'LocalBusiness', 'health', [], ['availableService']],

  // Fitness and beauty
  ['ExerciseGym', 'Gym', 'LocalBusiness', 'fitness', [], ['amenityFeature', 'makesOffer']],
  ['HealthClub', 'Health club', 'LocalBusiness', 'fitness', [], ['amenityFeature', 'makesOffer']],
  ['BeautySalon', 'Beauty salon', 'LocalBusiness', 'beauty', [], ['makesOffer', 'hasOfferCatalog']],
  ['HairSalon', 'Hair salon', 'LocalBusiness', 'beauty', [], ['makesOffer', 'hasOfferCatalog']],
  ['NailSalon', 'Nail salon', 'LocalBusiness', 'beauty', [], ['makesOffer', 'hasOfferCatalog']],
  ['DaySpa', 'Day spa', 'LocalBusiness', 'beauty', [], ['makesOffer', 'hasOfferCatalog']],

  // Professional services
  ['ProfessionalService', 'Professional service', 'LocalBusiness', 'professional', [], ['makesOffer', 'areaServed']],
  ['RealEstateAgent', 'Real estate agent', 'LocalBusiness', 'professional', [], ['areaServed', 'makesOffer']],
  ['LegalService', 'Legal service', 'LocalBusiness', 'professional', [], ['areaServed', 'makesOffer']],
  ['Attorney', 'Attorney', 'LegalService', 'professional', [], ['areaServed', 'knowsAbout']],
  ['AccountingService', 'Accounting service', 'LocalBusiness', 'professional', [], ['areaServed', 'makesOffer']],
  ['FinancialService', 'Financial service', 'LocalBusiness', 'professional', [], ['areaServed', 'feesAndCommissionsSpecification']],
  ['InsuranceAgency', 'Insurance agency', 'FinancialService', 'professional', [], ['areaServed', 'makesOffer']],
  ['TravelAgency', 'Travel agency', 'LocalBusiness', 'professional', [], ['areaServed', 'makesOffer']],

  // Automotive
  ['AutoRepair', 'Auto repair', 'LocalBusiness', 'automotive', [], ['areaServed', 'makesOffer']],
  ['AutoDealer', 'Auto dealer', 'LocalBusiness', 'automotive', [], ['brand', 'makesOffer']],
  ['AutoPartsStore', 'Auto parts store', 'Store', 'automotive', [], ['brand', 'makesOffer']],

  // Home and construction
  ['HomeAndConstructionBusiness', 'Home and construction business', 'LocalBusiness', 'home_services', [], ['areaServed', 'makesOffer']],
  ['Electrician', 'Electrician', 'HomeAndConstructionBusiness', 'home_services', [], ['areaServed', 'makesOffer']],
  ['Plumber', 'Plumber', 'HomeAndConstructionBusiness', 'home_services', [], ['areaServed', 'makesOffer']],
  ['RoofingContractor', 'Roofing contractor', 'HomeAndConstructionBusiness', 'home_services', [], ['areaServed', 'makesOffer']],
  ['HVACBusiness', 'HVAC business', 'HomeAndConstructionBusiness', 'home_services', [], ['areaServed', 'makesOffer']],
  ['Locksmith', 'Locksmith', 'HomeAndConstructionBusiness', 'home_services', [], ['areaServed', 'makesOffer']],

  // Retail
  ['Store', 'Store', 'LocalBusiness', 'retail', [], ['makesOffer', 'hasOfferCatalog', 'currenciesAccepted']],
  ['ClothingStore', 'Clothing store', 'Store', 'retail', [], ['makesOffer', 'brand']],
  ['ElectronicsStore', 'Electronics store', 'Store', 'retail', [], ['makesOffer', 'brand']],
  ['FurnitureStore', 'Furniture store', 'Store', 'retail', [], ['makesOffer', 'brand']],
  ['GroceryStore', 'Grocery store', 'Store', 'retail', [], ['makesOffer']],
  ['PetStore', 'Pet store', 'Store', 'retail', [], ['makesOffer']],

  // Lodging
  ['LodgingBusiness', 'Lodging business', 'LocalBusiness', 'lodging', [], ['checkinTime', 'checkoutTime', 'amenityFeature', 'numberOfRooms']],
  ['Hotel', 'Hotel', 'LodgingBusiness', 'lodging', [], ['checkinTime', 'checkoutTime', 'amenityFeature', 'starRating']],
  ['Motel', 'Motel', 'LodgingBusiness', 'lodging', [], ['checkinTime', 'checkoutTime', 'amenityFeature']],

  // Education and childcare
  ['EducationalOrganization', 'Educational organization', 'Organization', 'education', ['name', 'url'], ['address', 'telephone', 'alumni']],
  ['School', 'School', 'EducationalOrganization', 'education', [], ['address', 'telephone']],
  ['ChildCare', 'Child care', 'LocalBusiness', 'education', [], ['areaServed', 'makesOffer']],

  // Tourism
  ['TouristInformationCenter', 'Tourist information center', 'LocalBusiness', 'tourism', [], ['areaServed']],
];

/** Extra help text for properties that only some types use. */
const EXTRA_DEFINITIONS = {
  servesCuisine: { label: 'Cuisine', valueType: 'array', group: 'recommended', description: 'The cuisines served, e.g. Italian, Vegetarian.' },
  menu: { label: 'Menu URL', valueType: 'url', group: 'recommended', description: 'A link to the menu page.' },
  acceptsReservations: { label: 'Accepts reservations', valueType: 'boolean', group: 'recommended', description: 'Whether the business takes bookings.' },
  starRating: { label: 'Star rating', valueType: 'object', group: 'advanced', description: 'An official rating awarded by a recognised body — not a customer review score.' },
  medicalSpecialty: { label: 'Medical specialty', valueType: 'array', group: 'recommended', description: 'The specialties practised at this location.' },
  availableService: { label: 'Available services', valueType: 'array', group: 'recommended', description: 'Services offered to patients or clients.' },
  isAcceptingNewPatients: { label: 'Accepting new patients', valueType: 'boolean', group: 'advanced', description: 'Whether the practice is taking new patients.' },
  amenityFeature: { label: 'Amenities', valueType: 'array', group: 'recommended', description: 'Facilities available on site.' },
  makesOffer: { label: 'Services offered', valueType: 'array', group: 'recommended', description: 'Services or products the business offers.', expectedSchemaType: 'Offer' },
  hasOfferCatalog: { label: 'Service catalog', valueType: 'object', group: 'advanced', description: 'A structured catalog of services.', expectedSchemaType: 'OfferCatalog' },
  checkinTime: { label: 'Check-in time', valueType: 'time', group: 'recommended', description: 'Earliest check-in time.' },
  checkoutTime: { label: 'Check-out time', valueType: 'time', group: 'recommended', description: 'Latest check-out time.' },
  numberOfRooms: { label: 'Number of rooms', valueType: 'number', group: 'advanced', description: 'Total rooms available.' },
  brand: { label: 'Brands', valueType: 'array', group: 'advanced', description: 'Brands stocked or represented.' },
  drivethrough: { label: 'Drive-through', valueType: 'boolean', group: 'advanced', description: 'Whether a drive-through is available.' },
  knowsAbout: { label: 'Practice areas', valueType: 'array', group: 'advanced', description: 'Subjects or areas of expertise.' },
  currenciesAccepted: { label: 'Currencies accepted', valueType: 'array', group: 'advanced', description: 'Currencies the business accepts.' },
  contactPoint: { label: 'Contact points', valueType: 'array', group: 'advanced', description: 'Structured contact channels.', expectedSchemaType: 'ContactPoint' },
  alumni: { label: 'Alumni', valueType: 'array', group: 'advanced', description: 'Notable alumni.' },
  feesAndCommissionsSpecification: { label: 'Fees', valueType: 'text', group: 'advanced', description: 'A description of fees and commissions.' },
  areaServed: { label: 'Service area', valueType: 'array', group: 'recommended', description: 'Where the business serves customers.' },
};

function definitionsFor(extraRecommended) {
  const extras = extraRecommended
    .filter((property) => EXTRA_DEFINITIONS[property])
    .map((property) => ({ name: property, ...EXTRA_DEFINITIONS[property] }));

  // Later entries win, so a type-specific definition overrides the base one.
  const merged = new Map();
  for (const definition of [...BASE_PROPERTY_DEFINITIONS, ...extras]) {
    merged.set(definition.name, definition);
  }
  return [...merged.values()];
}

export const schemaTypes = TYPE_TABLE.map(
  ([name, label, parentType, category, extraRequired, extraRecommended], index) => ({
    name,
    label,
    parentType,
    category,
    description: `Schema.org ${name} — ${label}.`,
    requiredProperties: [...new Set([...BASE_REQUIRED, ...extraRequired])],
    recommendedProperties: [...new Set([...BASE_RECOMMENDED, ...extraRecommended])],
    allowedProperties: [...new Set([...BASE_ALLOWED, ...extraRequired, ...extraRecommended])],
    propertyDefinitions: definitionsFor(extraRecommended),
    active: true,
    sortOrder: index,
  }),
);

export default schemaTypes;
