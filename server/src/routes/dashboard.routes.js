import { Router } from 'express';

import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate, resolveWorkspace } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, resolveWorkspace, dashboardController.overview);

export default router;
