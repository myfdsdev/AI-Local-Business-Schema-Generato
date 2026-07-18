import { LOCATION_MODES } from '../../config/constants.js';

/**
 * Demo projects (spec section 29). These describe fictional businesses with
 * placeholder .example domains — no real business data, phone numbers or
 * addresses are invented. They exist so a fresh install has something to look
 * at; the values are intentionally sparse and clearly sample data.
 */
export const demoProjects = [
  {
    key: 'restaurant',
    projectName: 'Bella Vista Trattoria',
    websiteUrl: 'https://bella-vista.example',
    businessName: 'Bella Vista Trattoria',
    businessType: 'Restaurant',
    country: 'US',
    language: 'en',
    cms: 'wordpress',
    locationMode: LOCATION_MODES.SINGLE,
  },
  {
    key: 'dental',
    projectName: 'Brightsmile Dental',
    websiteUrl: 'https://brightsmile-dental.example',
    businessName: 'Brightsmile Dental Clinic',
    businessType: 'Dentist',
    country: 'US',
    language: 'en',
    cms: 'squarespace',
    locationMode: LOCATION_MODES.SINGLE,
  },
  {
    key: 'multi',
    projectName: 'CityFit Gyms',
    websiteUrl: 'https://cityfit.example',
    businessName: 'CityFit Gyms',
    businessType: 'ExerciseGym',
    country: 'GB',
    language: 'en',
    cms: 'nextjs',
    locationMode: LOCATION_MODES.MULTI,
  },
];

/** Sample locations for the multi-location demo project. */
export const demoLocations = {
  multi: [
    {
      name: 'CityFit Downtown',
      slug: 'downtown',
      pageUrl: 'https://cityfit.example/locations/downtown',
      businessType: 'ExerciseGym',
    },
    {
      name: 'CityFit Riverside',
      slug: 'riverside',
      pageUrl: 'https://cityfit.example/locations/riverside',
      businessType: 'ExerciseGym',
    },
  ],
};

export default { demoProjects, demoLocations };
