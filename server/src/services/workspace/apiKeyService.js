import { APP_ID } from '../../config/constants.js';
import { env, isTest } from '../../config/env.js';
import logger from '../../config/logger.js';
import { WorkspaceApiKey } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { openSecret, sealSecret } from '../../utils/secretBox.js';
import {
  detectProvider,
  getProvider,
  last4,
  providerLabel,
  transportFor,
} from '../ai/providers.js';

/**
 * Bring-your-own AI keys, one per workspace.
 *
 * ISOLATION: every read and write below is filtered by { appId, workspaceId }
 * taken from the authenticated session (req.workspaceId), never from a request
 * body or URL. There is no lookup-by-id path, so one workspace cannot name
 * another's key even if it guesses the document id. A workspace with no key of
 * its own transparently falls back to the platform key in env.
 */

/** The only shape this service ever hands back to a controller. */
function describe(doc) {
  if (!doc) return null;
  return {
    provider: doc.provider,
    providerLabel: providerLabel(doc.provider),
    model: doc.model || '',
    last4: doc.last4 || '',
    status: doc.status,
    lastVerifiedAt: doc.lastVerifiedAt,
    lastUsedAt: doc.lastUsedAt,
    updatedAt: doc.updatedAt,
  };
}

/** The caller's stored key, masked. Null when they are using the platform key. */
export async function getWorkspaceKey(workspaceId) {
  const doc = await WorkspaceApiKey.findOne({ appId: APP_ID, workspaceId }).lean();
  return describe(doc);
}

/**
 * Spends one cheap call against the provider to prove the key works before we
 * store it as active. A rejected key fails the save outright — the user finds
 * out now, not on their first generation.
 */
async function verifyKey({ provider, apiKey, model }) {
  // The suite has no outbound network; skip the probe and store as unverified.
  if (isTest) return { ok: false, reason: 'skipped' };

  const entry = getProvider(provider);
  if (!entry) return { ok: false, reason: 'unknown_provider' };

  const credential = { apiKey, model, ...transportFor(provider) };

  try {
    await entry.chatText({
      system: 'Reply with OK.',
      messages: [{ role: 'user', content: 'OK' }],
      maxTokens: 5,
      credential,
    });
    return { ok: true };
  } catch (error) {
    // Only a genuine rejection should block saving. Network blips, rate limits
    // and model quirks leave the key stored but flagged unverified.
    if (error.code === 'AI_AUTH_FAILED') {
      throw new ApiError(400, `${providerLabel(provider)} rejected that API key.`, {
        code: 'AI_KEY_REJECTED',
        errors: [{ field: 'apiKey', message: 'Check the key was copied in full and is still active.' }],
      });
    }
    logger.warn('Workspace API key stored without verification', {
      provider,
      reason: error.code ?? error.message,
    });
    return { ok: false, reason: error.code ?? 'unreachable' };
  }
}

/**
 * Stores (or replaces) the workspace's key. The provider is detected from the
 * key itself so the user only pastes one field.
 */
export async function saveWorkspaceKey({ workspaceId, userId, apiKey, model }) {
  const key = String(apiKey ?? '').trim();

  const detected = detectProvider(key);
  if (!detected) {
    throw new ApiError(400, 'That does not look like a supported API key.', {
      code: 'UNKNOWN_KEY_FORMAT',
      errors: [
        {
          field: 'apiKey',
          message:
            'Expected OpenAI "sk-…", Anthropic "sk-ant-…", OpenRouter "sk-or-…", Groq "gsk_…", or Google Gemini "AIza…".',
        },
      ],
    });
  }

  const chosenModel = String(model ?? '').trim() || detected.defaultModel;
  const verification = await verifyKey({ provider: detected.provider, apiKey: key, model: chosenModel });

  const sealed = sealSecret(key);

  await WorkspaceApiKey.findOneAndUpdate(
    { appId: APP_ID, workspaceId },
    {
      $set: {
        appId: APP_ID,
        workspaceId,
        provider: detected.provider,
        model: chosenModel,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        tag: sealed.tag,
        last4: last4(key),
        status: verification.ok ? 'active' : 'unverified',
        lastVerifiedAt: verification.ok ? new Date() : null,
        addedByUserId: userId,
      },
    },
    { upsert: true, new: true },
  );

  logger.info('Workspace AI key saved', { workspaceId, provider: detected.provider });
  return getWorkspaceKey(workspaceId);
}

export async function deleteWorkspaceKey(workspaceId) {
  await WorkspaceApiKey.deleteOne({ appId: APP_ID, workspaceId });
  logger.info('Workspace AI key removed', { workspaceId });
}

/** Re-runs the live probe against the stored key and updates its status. */
export async function testWorkspaceKey(workspaceId) {
  const doc = await WorkspaceApiKey.findOne({ appId: APP_ID, workspaceId }).select(
    '+ciphertext +iv +tag',
  );
  if (!doc) throw ApiError.notFound('No API key is stored for this workspace.');

  const apiKey = openSecret({ ciphertext: doc.ciphertext, iv: doc.iv, tag: doc.tag });
  const verification = await verifyKey({ provider: doc.provider, apiKey, model: doc.model });

  doc.status = verification.ok ? 'active' : 'unverified';
  doc.lastVerifiedAt = verification.ok ? new Date() : doc.lastVerifiedAt;
  await doc.save();

  return describe(doc.toObject());
}

/**
 * The credential an AI call should use for this workspace.
 *
 * Returns the workspace's own key when present, otherwise the platform key from
 * env. `source` lets callers tell the user whose quota is being spent. Never
 * throws on a missing workspace key — falling back is the normal path.
 */
export async function resolveCredential(workspaceId) {
  if (workspaceId) {
    const doc = await WorkspaceApiKey.findOne({ appId: APP_ID, workspaceId }).select(
      '+ciphertext +iv +tag',
    );

    if (doc) {
      try {
        const apiKey = openSecret({ ciphertext: doc.ciphertext, iv: doc.iv, tag: doc.tag });
        // Fire-and-forget usage stamp; a failure here must not fail the AI call.
        WorkspaceApiKey.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } }).catch(
          () => {},
        );
        return {
          provider: doc.provider,
          apiKey,
          model: doc.model,
          ...transportFor(doc.provider),
          source: 'workspace',
        };
      } catch (error) {
        // Undecryptable (ENCRYPTION_KEY rotated) — fall back rather than break
        // the tenant's app, and tell them to re-paste it.
        logger.error('Could not decrypt workspace API key; falling back to platform key', {
          workspaceId,
          message: error.message,
        });
      }
    }
  }

  const provider = env.AI_PROVIDER;
  const entry = getProvider(provider);
  return {
    provider,
    apiKey: entry?.platformKey(),
    model: entry?.defaultModel(),
    ...transportFor(provider),
    source: 'platform',
  };
}

export default {
  getWorkspaceKey,
  saveWorkspaceKey,
  deleteWorkspaceKey,
  testWorkspaceKey,
  resolveCredential,
};
