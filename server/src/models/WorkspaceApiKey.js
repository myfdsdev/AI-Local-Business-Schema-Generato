import mongoose from 'mongoose';

import { APP_ID } from '../config/constants.js';
import { PROVIDER_IDS } from '../services/ai/providers.js';

/**
 * A tenant's own AI provider key, encrypted at rest. One per workspace: the
 * workspace that owns it is the ONLY one that can read or spend it, and every
 * lookup in apiKeyService is filtered by { appId, workspaceId }.
 *
 * The plaintext key never leaves the server — the API returns only `last4`.
 */
const workspaceApiKeySchema = new mongoose.Schema(
  {
    appId: { type: String, default: APP_ID, index: true },
    workspaceId: { type: String, required: true, index: true },

    // Enum comes from the provider registry, so a new provider is supported the
    // moment it is registered — no schema edit needed.
    provider: { type: String, enum: PROVIDER_IDS, required: true },
    model: { type: String, default: '' },

    // AES-256-GCM payload — see utils/secretBox.js. `select: false` keeps these
    // out of every query that doesn't explicitly ask for them.
    ciphertext: { type: String, required: true, select: false },
    iv: { type: String, required: true, select: false },
    tag: { type: String, required: true, select: false },

    // Safe display fragment. Never widen this beyond the last 4 characters.
    last4: { type: String, default: '' },

    status: { type: String, enum: ['active', 'unverified', 'invalid'], default: 'unverified' },
    lastVerifiedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },

    addedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// One key per workspace, and the isolation boundary in index form.
workspaceApiKeySchema.index({ appId: 1, workspaceId: 1 }, { unique: true });

/**
 * Defence in depth: even if a document is accidentally serialised into a
 * response, the secret material is not in it.
 */
workspaceApiKeySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.ciphertext;
    delete ret.iv;
    delete ret.tag;
    return ret;
  },
});

export const WorkspaceApiKey =
  mongoose.models.WorkspaceApiKey || mongoose.model('WorkspaceApiKey', workspaceApiKeySchema);

export default WorkspaceApiKey;
