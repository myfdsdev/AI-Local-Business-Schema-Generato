import { Router } from 'express';

import * as locationController from '../controllers/locationController.js';
import { authenticate, resolveWorkspace } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createLocationSchema, updateLocationSchema } from '../validators/location.validators.js';

const router = Router();

// Signed-in, workspace-scoped. Every query is filtered by req.workspaceId.
router.use(authenticate);
router.use(resolveWorkspace);

router.get('/', locationController.list);
router.post('/', validate({ body: createLocationSchema }), locationController.create);
router.patch('/:locationId', validate({ body: updateLocationSchema }), locationController.update);
router.delete('/:locationId', locationController.remove);

export default router;
