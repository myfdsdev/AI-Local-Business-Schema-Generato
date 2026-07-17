import { Router } from 'express';

import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, dashboardController.overview);

export default router;
