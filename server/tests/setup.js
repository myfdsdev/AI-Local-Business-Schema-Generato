/**
 * Test bootstrap. MUST be the first import in tests/index.test.js: config/env.js
 * reads process.env at module-load time, so NODE_ENV has to be set before
 * anything pulls it in.
 *
 * Marking the run as `test` is what keeps the suite offline — code that would
 * otherwise reach a third party (e.g. the AI provider probe in apiKeyService)
 * checks `isTest` and skips the network call.
 */
process.env.NODE_ENV = 'test';
