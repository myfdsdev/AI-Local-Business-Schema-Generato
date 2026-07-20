import { Router } from 'express';

import * as projectController from '../controllers/projectController.js';
import * as scanController from '../controllers/scanController.js';
import { authenticate } from '../middleware/auth.js';
import { loadProject, requireProjectOwner } from '../middleware/ownership.js';
import { scanLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  createProjectSchema,
  listProjectsSchema,
  projectIdSchema,
  updateProjectSchema,
} from '../validators/project.validators.js';

const router = Router();

// Every project route requires a signed-in user.
router.use(authenticate);

router.get('/', validate({ query: listProjectsSchema }), projectController.list);

// Creating a project is the first step that consumes resources, so it is gated
// on a verified email address.
router.post('/', validate({ body: createProjectSchema }), projectController.create);

// `loadProject` resolves :projectId and enforces ownership for everything below.
router.get('/:projectId', validate({ params: projectIdSchema }), loadProject, projectController.detail);
router.put(
  '/:projectId',
  validate({ params: projectIdSchema, body: updateProjectSchema }),
  loadProject,
  requireProjectOwner,
  projectController.update,
);
router.delete(
  '/:projectId',
  validate({ params: projectIdSchema }),
  loadProject,
  requireProjectOwner,
  projectController.remove,
);
router.post(
  '/:projectId/archive',
  validate({ params: projectIdSchema }),
  loadProject,
  requireProjectOwner,
  projectController.archive,
);
router.post(
  '/:projectId/restore',
  validate({ params: projectIdSchema }),
  loadProject,
  requireProjectOwner,
  projectController.restore,
);

// --- Website scanning -------------------------------------------------------
router.post(
  '/:projectId/scan',
  scanLimiter,
  validate({ params: projectIdSchema }),
  loadProject,
  requireProjectOwner,
  scanController.start,
);
router.get(
  '/:projectId/scans',
  validate({ params: projectIdSchema }),
  loadProject,
  scanController.listForProject,
);

export default router;
