import { Router } from 'express';

import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import catalogRoutes from './catalog.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import projectRoutes from './project.routes.js';
import schemaGenRoutes from './schemaGen.routes.js';
import seoRoutes from './seo.routes.js';

/**
 * API v1 (spec section 19). Phase 2+ routers — scans, business data, schemas,
 * locations, reports — mount here as each phase lands.
 */
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK', data: { status: 'ok', version: 'v1', time: new Date().toISOString() } });
});

router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/projects', projectRoutes);
router.use('/schema-generator', schemaGenRoutes);
router.use('/seo', seoRoutes);
router.use('/admin', adminRoutes);

export default router;
