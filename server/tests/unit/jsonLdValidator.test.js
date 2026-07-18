import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseAndValidate, validateJsonLd } from '../../src/services/validation/jsonLdValidator.js';

// The validator is the deterministic gate on AI output — the core anti-fabrication
// guarantee — so it is tested independently of any live model.

const VALID_EXAMPLE = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: "Sharma's Kitchen",
  url: 'https://sharmaskitchen.in',
  '@id': 'https://sharmaskitchen.in/#business',
  telephone: '+91-9876543210',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '12 MG Road',
    addressLocality: 'Jodhpur',
    addressRegion: 'Rajasthan',
    postalCode: '342001',
    addressCountry: 'IN',
  },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday'], opens: '11:00', closes: '23:00' },
  ],
};

describe('JSON-LD validator', () => {
  it('accepts the reference example', () => {
    const result = validateJsonLd(VALID_EXAMPLE);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('requires @context to be https://schema.org', () => {
    const result = validateJsonLd({ '@type': 'LocalBusiness', name: 'X' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.message.includes('@context')));
  });

  it('rejects a non-ISO country code', () => {
    const result = validateJsonLd({
      ...VALID_EXAMPLE,
      address: { '@type': 'PostalAddress', addressCountry: 'India' },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.path.includes('addressCountry')));
  });

  it('rejects an out-of-range latitude', () => {
    const result = validateJsonLd({
      ...VALID_EXAMPLE,
      geo: { '@type': 'GeoCoordinates', latitude: 200, longitude: 10 },
    });
    assert.equal(result.valid, false);
  });

  it('rejects a malformed opening-hours time', () => {
    const result = validateJsonLd({
      ...VALID_EXAMPLE,
      openingHoursSpecification: [
        { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday'], opens: '9am', closes: '23:00' },
      ],
    });
    assert.equal(result.valid, false);
  });

  it('flags an aggregateRating with no visible reviews as a recommendation', () => {
    const result = validateJsonLd({
      ...VALID_EXAMPLE,
      aggregateRating: { '@type': 'AggregateRating', ratingValue: 5, reviewCount: 100 },
    });
    assert.ok(result.recommendations.some((rec) => rec.message.toLowerCase().includes('rating')));
  });

  it('recommends a specific subtype when the generic LocalBusiness is used', () => {
    const result = validateJsonLd({ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'X' });
    assert.ok(result.recommendations.some((rec) => rec.message.includes('LocalBusiness')));
  });

  describe('parseAndValidate', () => {
    it('strips markdown code fences before parsing', () => {
      const raw = '```json\n{"@context":"https://schema.org","@type":"Bakery","name":"Y"}\n```';
      const result = parseAndValidate(raw);
      assert.equal(result.valid, true);
      assert.equal(result.graph['@type'], 'Bakery');
    });

    it('extracts the JSON object from surrounding prose', () => {
      const raw = 'Here is your schema: {"@context":"https://schema.org","@type":"Store","name":"Z"} Enjoy!';
      const result = parseAndValidate(raw);
      assert.equal(result.graph['@type'], 'Store');
    });

    it('reports unparseable output instead of throwing', () => {
      const result = parseAndValidate('not json at all');
      assert.equal(result.valid, false);
      assert.equal(result.graph, null);
      assert.ok(result.errors[0].code.includes('UNPARSEABLE'));
    });
  });
});
