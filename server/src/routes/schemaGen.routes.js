import { Router } from 'express';

import * as schemaGenController from '../controllers/schemaGenController.js';
import { authenticate } from '../middleware/auth.js';
import { scanLimiter } from '../middleware/rateLimit.js';
import { uploadDocuments } from '../middleware/upload.js';

const router = Router();

// Signed-in users only: document generation calls a paid AI backend.
router.use(authenticate);

router.get('/capabilities', schemaGenController.capabilities);

// scanLimiter keeps per-user AI calls (which cost money) bounded. `uploadDocuments`
// parses multipart form-data into req.files before the controller runs.
router.post('/generate', scanLimiter, uploadDocuments('files'), schemaGenController.generate);

export default router;
