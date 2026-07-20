import { Router } from 'express';

import * as scanController from '../controllers/scanController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Polled by the client while a scan runs. Ownership is enforced in the
// controller by scoping the query to the signed-in user.
router.get('/:scanId', scanController.detail);

export default router;
