import { Router } from 'express';

import { WORKSPACE_ROLES } from '../config/constants.js';
import * as workspaceController from '../controllers/workspaceController.js';
import { authenticate, resolveWorkspace, requireWorkspaceRole } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { saveApiKeySchema, updateWorkspaceSchema } from '../validators/workspace.validators.js';

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

router.patch('/', ...adminOnly, validate({ body: updateWorkspaceSchema }), workspaceController.update);
router.get('/stats', ...adminOnly, workspaceController.stats);

// Bring-your-own AI key. Owner/admin only — a plain member must not be able to
// read the masked key, replace it, or delete it. authLimiter throttles writes so
// the save endpoint can't be used to probe keys against the provider.
router.get('/api-key', ...adminOnly, workspaceController.getApiKey);
router.put('/api-key', ...adminOnly, authLimiter, validate({ body: saveApiKeySchema }), workspaceController.putApiKey);
router.post('/api-key/test', ...adminOnly, authLimiter, workspaceController.testApiKey);
router.delete('/api-key', ...adminOnly, workspaceController.deleteApiKey);
router.get('/members', ...adminOnly, workspaceController.members);
router.post('/invite', ...adminOnly, workspaceController.invite);
router.patch('/members/:userId', ...adminOnly, workspaceController.updateMember);
router.delete('/members/:userId', ...adminOnly, workspaceController.removeMember);

export default router;
