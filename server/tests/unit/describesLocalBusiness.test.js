import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describesLocalBusiness } from '../../src/services/ai/schemaGenerationService.js';

/**
 * Regression guard: uploading an npm package README once produced a confident
 * "valid" ProfessionalService graph. A name + url + description describes any
 * web page, so it must not be enough to count as a local business.
 */
describe('describesLocalBusiness', () => {
  it('rejects a code-library README graph (name + url + description only)', () => {
    const graph = {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'asynckit',
      url: 'https://www.npmjs.com/package/asynckit',
      description: 'Minimal async jobs utility library, with streams support.',
      sameAs: ['https://github.com/alexindigo/asynckit'],
    };

    assert.equal(describesLocalBusiness(graph), false);
  });

  it('accepts a business with a postal address', () => {
    const graph = {
      '@type': 'Restaurant',
      name: 'Bella Vista Trattoria',
      address: { '@type': 'PostalAddress', addressLocality: 'London', addressCountry: 'GB' },
    };

    assert.equal(describesLocalBusiness(graph), true);
  });

  it('accepts a business identified only by phone', () => {
    assert.equal(describesLocalBusiness({ '@type': 'Plumber', name: 'Acme', telephone: '+44 20 7946 0958' }), true);
  });

  it('accepts a business identified only by opening hours', () => {
    const graph = {
      '@type': 'CafeOrCoffeeShop',
      name: 'Corner Cafe',
      openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', opens: '08:00', closes: '17:00' }],
    };

    assert.equal(describesLocalBusiness(graph), true);
  });

  it('rejects an empty opening-hours array (present but carries no signal)', () => {
    assert.equal(describesLocalBusiness({ '@type': 'Store', name: 'Empty', openingHoursSpecification: [] }), false);
  });

  it('rejects an empty object, null, and a graph with no name', () => {
    assert.equal(describesLocalBusiness({}), false);
    assert.equal(describesLocalBusiness(null), false);
    assert.equal(describesLocalBusiness({ '@type': 'Restaurant', telephone: '+1 555 0142' }), false);
  });
});
