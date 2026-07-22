import { Router } from 'express';

import * as platformController from '../controllers/platformController.js';

const router = Router();

// Every route here is hub-to-app (server-to-server), gated by the shared secret.
router.use(platformController.requireHubSecret);

router.post('/provision', platformController.provision);
router.post('/suspend', platformController.suspend);
router.post('/reactivate', platformController.reactivate);

export default router;
