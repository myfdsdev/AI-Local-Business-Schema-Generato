# Portable Prompt — Workspace Multi-Tenancy + Bring-Your-Own LLM Keys

Paste this whole file as a prompt when building any app in the suite. It is
app-agnostic: replace the two placeholders and everything else stays identical
across all 18 apps.

| Placeholder | Meaning | Example |
|---|---|---|
| `<APP_ID>` | Short slug identifying THIS app | `localschema` |
| `<TENANT_MODELS>` | Every model holding customer data in this app | `Project`, `Location`, `Report` |

---

## PROMPT STARTS HERE

You are implementing two systems that must work identically in every app I own:
a **multi-tenant workspace layer** and a **per-workspace LLM API key layer**.
Both are security boundaries. Follow this spec exactly; do not simplify it.

Stack assumption: Node + Express + Mongoose on the server, React + React Query
on the client. Adapt idioms if the stack differs, but never weaken a rule below.

---

## PART A — WORKSPACE MULTI-TENANCY

### A1. The core idea

A **workspace** is one paying customer's isolated tenant. Every customer-owned
record carries a `workspaceId`, and every query is filtered by it. Users belong
to a workspace through a **membership** record — never through a field on the
user.

### A2. Constants

```js
export const APP_ID = '<APP_ID>';

export const WORKSPACE_ROLES  = { OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member' };
export const WORKSPACE_STATUS = { ACTIVE: 'active', SUSPENDED: 'suspended', CANCELLED: 'cancelled' };
export const MEMBER_STATUS    = { ACTIVE: 'active', INVITED: 'invited', REVOKED: 'revoked' };
export const INVITATION_STATUS = { PENDING: 'pending', ACCEPTED: 'accepted', EXPIRED: 'expired', REVOKED: 'revoked' };
```

Note two distinct role axes. Platform role (`admin` / `user`) is about running
the SaaS. Workspace role (`owner` / `admin` / `member`) is about one customer's
team. Never conflate them.

### A3. Models

**Workspace** — `appId`, `workspaceId` (unique, indexed), `name`,
`ownerUserId` (nullable until a provisioned owner activates), `ownerEmail`,
`status`.

**WorkspaceMember** — `appId`, `workspaceId`, `userId`, `role`, `status`.
Unique compound index on `(workspaceId, userId)`.

**Invitation** — `appId`, `workspaceId`, `email`, `role`, `tokenHash`,
`status`, `expiresAt`. **Store a SHA-256 hash of the token, never the raw
token.** A database leak must not yield usable invite links.

**Every model in `<TENANT_MODELS>`** gets:
```js
appId:       { type: String, default: APP_ID, index: true },
workspaceId: { type: String, required: true, index: true },
```
and every existing index becomes workspace-scoped. A uniqueness rule that was
global (e.g. unique domain) becomes unique *per workspace*.

### A4. Workspace ID generation

```js
`ws_${crypto.randomBytes(18).toString('base64url')}`
```
Random and unguessable. Never sequential, never derived from the customer name.

### A5. Middleware

`authenticate` — verifies the access token, attaches `req.user`.

`resolveWorkspace` — the heart of the system:
1. Look up the caller's **active membership**.
2. If none exists, lazily create a personal workspace with them as owner. This
   self-heals accounts that predate multi-tenancy — no backfill migration.
3. If the workspace is not `active`, return **403 `WORKSPACE_INACTIVE`**.
4. Attach `req.workspaceId` and `req.wsRole`.

`requireWorkspaceRole(...roles)` — guards owner/admin-only routes.

### A6. THE ISOLATION RULES (non-negotiable)

1. **`workspaceId` comes only from the session** (`req.workspaceId`, derived
   from membership). NEVER from a URL param, query string, request body, or
   header. A customer must not be able to name another customer's workspace.
2. **Every tenant query is filtered by `{ appId, workspaceId }`.** No exceptions.
   A bare `Model.findById(id)` on tenant data is a bug.
3. **Cross-tenant access returns 404, never 403.** A 403 confirms the record
   exists, letting an attacker enumerate IDs. Return "not found".
4. **Members see only their own records; owner/admin see the whole workspace.**
   Add `userId` to the filter for the `member` role.
5. **Background jobs take `workspaceId` from the stored record**, not from a
   request — a queued job has no session.
6. The workspace **owner's role can never be changed or removed** via the team
   API. Transferring ownership is a separate, explicit operation.

### A7. Routes

```
GET    /workspace              -> context: { workspaceId, role, name, status, ownerEmail }
PATCH  /workspace              -> rename                      (owner/admin)
GET    /workspace/stats        -> totals + time series        (owner/admin)
GET    /workspace/members      -> roster                      (owner/admin)
POST   /workspace/invite       -> create invite link          (owner/admin)
PATCH  /workspace/members/:id  -> change role (never owner)   (owner/admin)
DELETE /workspace/members/:id  -> remove member               (owner/admin)

GET    /workspace/join/:token  -> public: describe the invite
POST   /workspace/join/:token  -> public: accept, create user, sign in
POST   /workspace/activate     -> public: email + code activation (rate limited)
```

### A8. Hub provisioning (central store integration)

Guarded by an `x-platform-secret` header compared against `PLATFORM_SECRET`
using a **length-safe constant-time compare**. When `PLATFORM_SECRET` is unset,
these endpoints are disabled and the app runs standalone.

```
POST /platform/provision   -> create workspace + owner
POST /platform/suspend     -> status = suspended (blocks all access)
POST /platform/reactivate  -> status = active
```

`provision` supports three onboarding methods, in priority order:
1. `password` — hub generated it; the buyer just signs in normally. **Preferred.**
2. `activationCode` — buyer enters email + a 6–7 digit code to set a password.
3. Neither — returns a join link.

Re-provisioning an existing owner resets their password. That is what
"resend my login" means on the hub side.

**The buyer never types a workspace ID.** They log in with email + password;
the workspace is looked up from their membership.

---

## PART B — PER-WORKSPACE LLM API KEYS

Each workspace may paste its own LLM provider key so AI usage bills to their
own provider account. A workspace with no key falls back to the platform key.

### B1. The provider registry — ONE file, single source of truth

`services/ai/providers.js` holds every supported provider: detection regex,
client functions, default model, and platform env key. Adding a provider is one
entry here; the model enum, settings UI, encryption, and isolation follow
automatically.

```js
const PROVIDERS = [
  { id: 'anthropic',  label: 'Anthropic (Claude)', match: /^sk-ant-[A-Za-z0-9_-]{20,}$/, ... },
  { id: 'openrouter', label: 'OpenRouter',         match: /^sk-or-[A-Za-z0-9_-]{20,}$/,  baseUrl: 'https://openrouter.ai/api/v1/chat/completions', ... },
  { id: 'groq',       label: 'Groq',               match: /^gsk_[A-Za-z0-9]{20,}$/,       baseUrl: 'https://api.groq.com/openai/v1/chat/completions', ... },
  { id: 'gemini',     label: 'Google Gemini',      match: /^AIza[\w-]{30,}$/,             ... },
  { id: 'openai',     label: 'OpenAI',             match: /^sk-[A-Za-z0-9_-]{20,}$/,      ... },
];
```

> ⚠️ **ORDER IS LOAD-BEARING.** `sk-ant-…` and `sk-or-…` are *also* matched by
> OpenAI's broader `sk-…`. If OpenAI is checked first, every Claude key is
> silently sent to OpenAI and rejected. Specific prefixes MUST come first, and
> you MUST write a regression test for it.

Groq and OpenRouter speak the OpenAI wire format — reuse the OpenAI client with
a per-credential `baseUrl`. Anthropic needs its own client: `system` is a
top-level field, and since it has no JSON mode, force JSON by prefilling the
assistant turn with `{` and prepending the brace back onto the response.

### B2. Detect the provider server-side, from the key itself

The user pastes **one field**. The server determines the provider from the key's
shape. **Never accept a `provider` field from the client** — then a mismatch is
structurally impossible. The client may mirror the regexes for instant "Detected
Anthropic (Claude)" feedback, but the server is the authority.

### B3. Encryption at rest

AES-256-GCM. Random 12-byte IV per encryption; store `{ ciphertext, iv, tag }`
as base64. The auth tag means tampered ciphertext fails to decrypt rather than
yielding garbage.

Key material comes from `ENCRYPTION_KEY`. If unset, derive it via scrypt from
the refresh-token secret and **log a warning** — the feature then works out of
the box, but rotating that secret makes stored keys unreadable. Document this.

### B4. The WorkspaceApiKey model

`appId`, `workspaceId`, `provider` (enum from the registry), `model`,
`ciphertext`/`iv`/`tag` (all `select: false`), `last4`, `status`
(`active` | `unverified` | `invalid`), `lastVerifiedAt`, `lastUsedAt`,
`addedByUserId`. Unique index on `(appId, workspaceId)` — one key per workspace.

Add a `toJSON` transform deleting `ciphertext`/`iv`/`tag` as defence in depth:
even an accidental serialization cannot leak secret material.

**Only `last4` is ever returned by the API.** Never widen this.

### B5. Verify on save

Before storing, spend one tiny call against the provider:
- Provider **rejects the key** (auth error) → fail the save with a clear message.
  The user finds out now, not on their first real request.
- **Any other failure** (network, rate limit, odd model) → store it, mark
  `unverified`, and expose a **Test** button to re-check.

### B6. Credential resolution — the single chokepoint

```js
resolveCredential(workspaceId) -> { provider, apiKey, model, baseUrl?, source }
```
Returns the workspace's own decrypted key (`source: 'workspace'`), else the
platform key from env (`source: 'platform'`). It must **never throw** on a
missing workspace key — falling back is the normal path. If decryption fails
(rotated `ENCRYPTION_KEY`), log it, fall back, and prompt the tenant to re-paste
rather than breaking their app.

The AI client dispatches on **the resolved credential's provider**, not a global
setting: a workspace on Claude uses Claude even when the platform default is
Gemini.

Thread `workspaceId` through every AI call site. Routes that call AI need
`resolveWorkspace` in their middleware chain.

### B7. Routes (owner/admin only — a member gets 403 on all four)

```
GET    /workspace/api-key        -> { key: masked | null, providers: [...], platformFallback }
PUT    /workspace/api-key        -> save/replace (rate limited)
POST   /workspace/api-key/test   -> re-verify stored key
DELETE /workspace/api-key        -> remove, fall back to platform key
```

Return the supported-provider list from the server so the UI never hardcodes it.

---

## PART C — FRONTEND

- Settings page shows: workspace name (editable by owner/admin), workspace ID
  (copyable), and the **AI provider key panel**.
- Key panel: one password-style input with a reveal toggle, live provider
  detection as you paste, a badge row of supported providers, and Test / Remove
  actions on a stored key.
- Show the masked key as `••••••••1234` — never request or display the full key.
- Gate owner/admin UI on the **confirmed** role. For nav list items, defaulting
  to visible during load is fine. For a header button, wait for confirmation —
  a control that appears then vanishes shifts the whole layout.
- State the honest promise in the UI: *"Your key is encrypted before storage and
  never shown again — only the last 4 characters. It is used solely for this
  workspace's own requests."*

---

## PART D — TRAPS THAT HAVE ALREADY BITTEN (do not rediscover these)

1. **Split-domain deploys log users out on refresh.** If the API and client are
   on different domains, the refresh cookie must be
   `SameSite=None; Secure` in production. `SameSite=Strict` silently drops it.
2. **Feature flags read from env must be able to turn OFF, not just ON.**
   `env.X || process.env.X === 'true'` can only enable. Use an explicit
   `process.env.X !== 'false'` style check.
3. **Set `NODE_ENV=test` for the test suite**, via a setup module that is the
   **first import** in the test entry file — config modules read `process.env`
   at load time, so a later assignment is too late. Without this, tests that
   should skip network calls will hit real provider APIs.
4. **A 202/201 status is silently ignored** if your response helper takes
   `status` but the caller passes `statusCode` (or vice versa). Verify the
   actual status code in a test.
5. **Every outbound fetch needs a timeout, including DNS.** A hung DNS lookup
   with no timeout leaves jobs stuck forever. Add an overall deadline and a
   startup sweep that fails orphaned jobs and refunds any credits.
6. **Unique indexes must be workspace-scoped**, or customer B cannot create a
   record that customer A already has.
7. **Never log a key, even truncated in a way that could be reassembled.** Log
   the provider and the outcome, never the value.

---

## PART E — ACCEPTANCE TESTS (the build is not done until these pass)

Workspace isolation:
- [ ] Each new user gets their own workspace; their records live in it.
- [ ] Customer B's list does not contain customer A's records.
- [ ] B opening A's record ID returns **404, not 403**.
- [ ] B cannot update or delete A's record (404), and A's record is untouched.
- [ ] A suspended workspace is blocked from all tenant routes (403).
- [ ] A plain member cannot reach team management (403).
- [ ] The owner's role cannot be changed or removed.
- [ ] An invalid or expired join token is rejected.
- [ ] `/platform/*` without the correct secret returns 401.
- [ ] Hub provision with a password → the buyer logs in normally as owner.

API key isolation:
- [ ] The raw key appears **nowhere** in any API response (assert on the full
      serialized body, not just the field you expect).
- [ ] The stored document contains no plaintext key; the encryption envelope is
      present.
- [ ] Workspace B resolves to `source: 'platform'` and never reaches A's key.
- [ ] Saving B's key does not modify A's; each workspace holds exactly one key.
- [ ] Deleting a key falls that workspace back to the platform key.
- [ ] A plain member gets 403 on read, replace, AND delete.
- [ ] Every supported provider is detected from its key alone.
- [ ] `sk-ant-…` detects as Anthropic and `sk-or-…` as OpenRouter — **not**
      OpenAI (the prefix-ordering regression test).
- [ ] An OpenAI-compatible provider routes to its own base URL, not
      `api.openai.com`.

Run the whole suite and report the real pass/fail count. If something fails, say
so with the output — do not describe the build as complete.

## PROMPT ENDS HERE

---

## Reference implementation

This app (`<APP_ID>` = `localschema`) is the working reference. Key files:

| Concern | File |
|---|---|
| Provider registry | `server/src/services/ai/providers.js` |
| Key storage + resolution | `server/src/services/workspace/apiKeyService.js` |
| Encryption | `server/src/utils/secretBox.js` |
| Provider dispatch | `server/src/services/ai/aiClient.js` |
| Workspace resolution | `server/src/middleware/auth.js` |
| Tenant filtering | `server/src/middleware/ownership.js` |
| Hub endpoints | `server/src/controllers/platformController.js` |
| Settings UI | `client/src/components/workspace/ApiKeyPanel.jsx` |
| Isolation tests | `server/tests/api/workspace.test.js`, `server/tests/api/apiKeys.test.js` |
