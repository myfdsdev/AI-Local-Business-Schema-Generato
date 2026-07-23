import { Router } from 'express';

import { WORKSPACE_ROLES } from '../config/constants.js';
import * as workspaceController from '../controllers/workspaceController.js';
import { authenticate, resolveWorkspace, requireWorkspaceRole } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

// --- Public join flow (no session — this is how a user first gets in) -------
router.get('/join/:token', workspaceController.joinInfo);
router.post('/join/:token', workspaceController.acceptJoin);

// Owner activation with a short email+code. Rate limited so the code can't be
// brute-forced.
router.post('/activate', authLimiter, workspaceController.activate);

// Any signed-in member can read their own workspace context.
router.get('/', authenticate, resolveWorkspace, workspaceController.context);

// --- Team management (owner/admin of the caller's workspace) -----------------
const adminOnly = [
  authenticate,
  resolveWorkspace,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN),
];

router.get('/stats', ...adminOnly, workspaceController.stats);
router.get('/members', ...adminOnly, workspaceController.members);
router.post('/invite', ...adminOnly, workspaceController.invite);
router.delete('/members/:userId', ...adminOnly, workspaceController.removeMember);

export default router;
