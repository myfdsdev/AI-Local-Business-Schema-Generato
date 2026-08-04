import { APP_ID, WORKSPACE_STATUS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import { User, Workspace } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { clientUrl } from '../../utils/clientUrl.js';
import { generatePassword } from '../../utils/password.js';
import { DURATIONS, safeEqual } from '../../utils/tokens.js';
import { sendEmail } from '../email/emailClient.js';
import {
  accessGrantedEmail,
  adminAccessEmail,
  welcomeCredentialsEmail,
} from '../email/templates.js';
import { acceptInvite, createOwnerInvite, getUsableInvite } from './membershipService.js';
import {
  createOwnerWithPassword,
  findActiveMembership,
  generateWorkspaceId,
} from './workspaceService.js';

/**
 * Self-service workspace ownership.
 *
 * Someone who has the secret link requests access with their name and email; we
 * email them a one-time link, and CLICKING IT is what creates everything. The
 * click is the approval step — it proves they control the address, so nobody can
 * grant access to an inbox that isn't theirs.
 */

const CLAIM_TTL_MS = 3 * DURATIONS.DAY;
const EXPIRES_IN_HOURS = CLAIM_TTL_MS / DURATIONS.HOUR;


/**
 * Optional gate on the join-admin page.
 *
 * When ADMIN_ACCESS_CODE is set it is REQUIRED, and only a matching ?code= gets
 * through. When unset the page is open to anyone who finds it — equivalent to
 * the open signup this app had before, so no worse, but it does mean the path
 * itself is the only barrier. Setting the env var locks it immediately without
 * a code change; rotating it invalidates every link already shared.
 */
function assertAccessCode(code) {
  const configured = env.ADMIN_ACCESS_CODE || process.env.ADMIN_ACCESS_CODE;
  if (!configured) return; // open

  if (!safeEqual(code ?? '', configured)) {
    throw ApiError.forbidden('This link is not valid.', { code: 'ACCESS_CODE_INVALID' });
  }
}

/**
 * Step 1 — request. Creates the workspace shell (no owner yet) and emails a
 * claim link.
 *
 * ONE WORKSPACE PER OWNER is enforced here: an email that already owns one gets
 * a link to that same workspace rather than a second one. The response is
 * identical either way, so this cannot be used to discover who already has an
 * account.
 */
export async function requestAdminAccess({ name, email, code }) {
  assertAccessCode(code);

  const ownerEmail = String(email).toLowerCase().trim();
  const ownerName = String(name ?? '').trim();

  // Reuse an existing workspace for this owner — never create a second.
  let workspace = await Workspace.findOne({ appId: APP_ID, ownerEmail });

  // Also catch the case where they already belong to a workspace under a
  // different ownerEmail (e.g. accepted a team invite, or were provisioned).
  if (!workspace) {
    const user = await User.findOne({ email: ownerEmail }).select('_id').lean();
    const membership = user ? await findActiveMembership(user._id) : null;
    if (membership) {
      logger.info('Admin access requested by a user who already has a workspace', { ownerEmail });
      // Deliberately identical response — see the doc comment above.
      return { requested: true };
    }
  }

  if (!workspace) {
    workspace = await Workspace.create({
      appId: APP_ID,
      workspaceId: generateWorkspaceId(),
      name: ownerName,
      ownerEmail,
      status: WORKSPACE_STATUS.ACTIVE,
    });
  }

  const { token } = await createOwnerInvite({
    workspaceId: workspace.workspaceId,
    email: ownerEmail,
    ttlMs: CLAIM_TTL_MS,
  });

  const message = adminAccessEmail({
    name: ownerName,
    claimUrl: `${clientUrl()}/claim-access?token=${token}`,
    expiresInHours: EXPIRES_IN_HOURS,
  });

  await sendEmail({ to: ownerEmail, replyTo: env.EMAIL_REPLY_TO, ...message });

  logger.info('Admin access link sent', { workspaceId: workspace.workspaceId });
  return { requested: true };
}

/**
 * Direct signup: name + email + password creates the account, the workspace and
 * the owner membership in one step, with no email round trip.
 *
 * SECURITY: an email that already has an account is REFUSED. Accepting a new
 * password for an existing address would let anyone take over that account
 * simply by typing its email here.
 */
export async function registerWorkspaceOwner({ name, email, password, code }) {
  assertAccessCode(code);

  const ownerEmail = String(email).toLowerCase().trim();
  const ownerName = String(name ?? '').trim();

  const existingUser = await User.findOne({ email: ownerEmail }).select('_id').lean();
  if (existingUser) {
    throw ApiError.conflict('An account with that email already exists. Sign in instead.', {
      code: 'EMAIL_IN_USE',
    });
  }

  // ONE WORKSPACE PER OWNER — reuse the shell if a previous request created one.
  let workspace = await Workspace.findOne({ appId: APP_ID, ownerEmail });
  if (!workspace) {
    workspace = await Workspace.create({
      appId: APP_ID,
      workspaceId: generateWorkspaceId(),
      name: ownerName,
      ownerEmail,
      status: WORKSPACE_STATUS.ACTIVE,
    });
  }

  // Reuses the same path the store uses, so the account comes out identical
  // however it was created.
  const user = await createOwnerWithPassword({
    workspaceId: workspace.workspaceId,
    ownerEmail,
    ownerName,
    password,
  });

  logger.info('Workspace owner registered directly', { workspaceId: workspace.workspaceId });
  return { user, workspaceId: workspace.workspaceId };
}

/**
 * Step 2 — claim. Clicking the emailed link creates the account (with a
 * generated password), the owner membership, and hands back a session.
 */
export async function claimAdminAccess({ token }) {
  const invite = await getUsableInvite(token);
  if (!invite) {
    throw ApiError.badRequest('This link is invalid or has expired. Request a new one.', {
      code: 'INVALID_TOKEN',
    });
  }

  // Whether the account already exists decides which email we send: an existing
  // user keeps their password, so sending them a generated one would be a
  // password that does not work.
  const existingUser = await User.findOne({ email: invite.email }).select('_id').lean();
  const isNewUser = !existingUser;

  const workspace = await Workspace.findOne({ workspaceId: invite.workspaceId })
    .select('name')
    .lean();

  const temporaryPassword = generatePassword();
  const { user, workspaceId } = await acceptInvite({
    rawToken: token,
    // materializeInvite only uses these when creating a new account.
    name: workspace?.name || invite.email,
    password: temporaryPassword,
  });

  const loginUrl = `${clientUrl()}/login`;
  const message = isNewUser
    ? welcomeCredentialsEmail({
        name: user.name,
        email: user.email,
        password: temporaryPassword,
        loginUrl,
      })
    : accessGrantedEmail({ name: user.name, loginUrl });

  // A mail failure must not undo the workspace — it already exists and the user
  // is about to be signed in anyway.
  try {
    await sendEmail({ to: user.email, replyTo: env.EMAIL_REPLY_TO, ...message });
  } catch (error) {
    logger.error('Access claimed but the confirmation email failed', {
      workspaceId,
      message: error.message,
    });
  }

  logger.info('Admin access claimed', { workspaceId, isNewUser });
  return { user, workspaceId, isNewUser };
}

export default { requestAdminAccess, claimAdminAccess, registerWorkspaceOwner };
