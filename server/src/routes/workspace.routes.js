import { Router } from 'express';

import { WORKSPACE_ROLES } from '../config/constants.js';
import * as workspaceController from '../controllers/workspaceController.js';
import { authenticate, resolveWorkspace, requireWorkspaceRole } from '../middleware/auth.js';

const router = Router();

// --- Public join flow (no session — this is how a user first gets in) -------
router.get('/join/:token', workspaceController.joinInfo);
router.post('/join/:token', workspaceController.acceptJoin);

// Any signed-in member can read their own workspace context.
router.get('/', authenticate, resolveWorkspace, workspaceController.context);

// --- Team management (owner/admin of the caller's workspace) -----------------
const adminOnly = [
  authenticate,
  resolveWorkspace,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN),
];

router.get('/members', ...adminOnly, workspaceController.members);
router.post('/invite', ...adminOnly, workspaceController.invite);
router.delete('/members/:userId', ...adminOnly, workspaceController.removeMember);

export default router;
