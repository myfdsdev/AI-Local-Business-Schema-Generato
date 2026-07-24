/**
 * Single entry point that imports every suite so the whole test run executes in
 * ONE process. This is deliberate: on Windows, mongodb-memory-server crashes
 * mongod with an `fassert` when the test runner spawns a separate process per
 * file and each starts its own mongod. Running in one process lets all DB
 * suites share a single mongod (see tests/helpers/testServer.js).
 *
 * Individual files can still be run directly, e.g. `node --test tests/unit/url.test.js`.
 */
import { after } from 'node:test';

import { stopSharedServer } from './helpers/testServer.js';

import './unit/url.test.js';
import './unit/documentParser.test.js';
import './unit/jsonLdValidator.test.js';
import './unit/describesLocalBusiness.test.js';
import './unit/scanSafety.test.js';
import './api/auth.test.js';
import './api/projects.test.js';
import './api/workspace.test.js';
import './api/scanRecovery.test.js';

// Stop the shared in-memory mongod once every suite has finished.
after(stopSharedServer);
