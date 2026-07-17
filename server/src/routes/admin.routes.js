import { Router } from 'express';

import * as adminController from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  adjustCreditsSchema,
  auditLogQuerySchema,
  createSchemaTypeSchema,
  listProjectsSchema,
  listUsersSchema,
  paginationSchema,
  schemaTypeIdSchema,
  suspendUserSchema,
  updateSchemaTypeSchema,
  updateUserSchema,
  userIdSchema,
} from '../validators/admin.validators.js';

const router = Router();

// Every route below is admin-only. Applied at the router level so a new route
// cannot be added here without inheriting the gate.
router.use(authenticate, requireAdmin);

router.get('/dashboard', adminController.dashboard);

router.get('/users', validate({ query: listUsersSchema }), adminController.listUsers);
router.get('/users/:userId', validate({ params: userIdSchema }), adminController.getUser);
router.put(
  '/users/:userId',
  validate({ params: userIdSchema, body: updateUserSchema }),
  adminController.updateUser,
);
router.post(
  '/users/:userId/suspend',
  validate({ params: userIdSchema, body: suspendUserSchema }),
  adminController.suspendUser,
);
router.post('/users/:userId/activate', validate({ params: userIdSchema }), adminController.activateUser);
router.post(
  '/users/:userId/credits',
  validate({ params: userIdSchema, body: adjustCreditsSchema }),
  adminController.adjustCredits,
);

router.get('/projects', validate({ query: listProjectsSchema }), adminController.listProjects);
router.get('/scans', validate({ query: paginationSchema }), adminController.listScans);
router.get('/errors', validate({ query: paginationSchema }), adminController.listErrors);
router.get('/audit-logs', validate({ query: auditLogQuerySchema }), adminController.listAuditLogs);

router.get('/schema-types', adminController.listSchemaTypes);
router.post('/schema-types', validate({ body: createSchemaTypeSchema }), adminController.createSchemaType);
router.put(
  '/schema-types/:schemaTypeId',
  validate({ params: schemaTypeIdSchema, body: updateSchemaTypeSchema }),
  adminController.updateSchemaType,
);
router.delete(
  '/schema-types/:schemaTypeId',
  validate({ params: schemaTypeIdSchema }),
  adminController.deleteSchemaType,
);

export default router;
