import { Router } from 'express';

import * as platformController from '../controllers/platformController.js';

const router = Router();

// PUBLIC — must stay above the guard. The hub is given only a base URL and
// reads this to discover the endpoints; requiring the secret first would make
// discovery impossible before the secret is configured. It exposes no secrets
// and grants nothing.
router.get('/manifest', platformController.manifest);

// Everything below is hub-to-app (server-to-server), gated by the shared secret.
router.use(platformController.requireHubSecret);

router.post('/provision', platformController.provision);
router.post('/suspend', platformController.suspend);
router.post('/reactivate', platformController.reactivate);

export default router;
