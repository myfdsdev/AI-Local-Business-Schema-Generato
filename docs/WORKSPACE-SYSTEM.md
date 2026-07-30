# The Workspace System — Reference for Every App You Build

This is the shared foundation across your whole app suite. Build it once, copy it
into each new app, change two placeholders. Everything here is running and
verified in LocalSchema AI — it is not a proposal.

| Placeholder | Meaning | This app |
|---|---|---|
| `<APP_ID>` | Short slug for THIS app | `localschema` |
| `<TENANT_MODELS>` | Models holding customer data | `BusinessProject`, `Location`, `WebsiteScan` |

---

## The four pillars

1. **Workspaces** — one paying customer = one isolated tenant
2. **Store bridge** — your Base44 store creates accounts automatically on purchase
3. **BYO LLM keys** — each customer can supply their own AI provider key
4. **Roles** — owner / admin / member inside each workspace

---

## 1. WORKSPACES

### The idea

A **workspace** is one customer's isolated world. Every customer-owned record
carries a `workspaceId`, and every query filters by it. Users join a workspace
through a **membership record** — never a field on the user.

### Constants

```js
export const APP_ID = '<APP_ID>';

export const WORKSPACE_ROLES   = { OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member' };
export const WORKSPACE_STATUS  = { ACTIVE: 'active', SUSPENDED: 'suspended', CANCELLED: 'cancelled' };
export const MEMBER_STATUS     = { ACTIVE: 'active', INVITED: 'invited', REVOKED: 'revoked' };
export const INVITATION_STATUS = { PENDING: 'pending', ACCEPTED: 'accepted', EXPIRED: 'expired', REVOKED: 'revoked' };
```

Two separate role axes — never mix them:
- **Platform role** (`admin` / `user`) — running the SaaS
- **Workspace role** (`owner` / `admin` / `member`) — one customer's team

### Models

**Workspace** — `appId`, `workspaceId` (unique, indexed), `name`, `ownerUserId`
(nullable until activation), `ownerEmail`, `status`

**WorkspaceMember** — `appId`, `workspaceId`, `userId`, `role`, `status`
· unique compound index `(workspaceId, userId)`

**Invitation** — `appId`, `workspaceId`, `email`, `role`, `tokenHash`, `status`,
`expiresAt`
· **Store a SHA-256 hash, never the raw token.** A DB leak must not yield working
invite links.

**Every model in `<TENANT_MODELS>`** gets:

```js
appId:       { type: String, default: APP_ID, index: true },
workspaceId: { type: String, required: true, index: true },
```

…and every index becomes workspace-scoped. A global uniqueness rule (e.g. unique
domain) becomes unique **per workspace** — otherwise customer B can't create a
record customer A already has.

### Workspace ID

```js
`ws_${crypto.randomBytes(18).toString('base64url')}`
```

Random, unguessable, never sequential.

### THE ISOLATION RULES — non-negotiable

1. **`workspaceId` comes only from the session.** Never from a URL, body, query,
   or header. A customer must never be able to *name* another's workspace.
2. **Every tenant query filters `{ appId, workspaceId }`.** A bare
   `Model.findById(id)` on tenant data is a bug.
3. **Cross-tenant access returns 404, never 403.** A 403 confirms the record
   exists and lets an attacker enumerate IDs.
4. **Members see only their own records; owner/admin see all.** Add `userId` to
   the filter for the `member` role.
5. **Background jobs read `workspaceId` from the stored record** — a queued job
   has no session.
6. **The owner's role can never be changed or removed** through the team API.

### Middleware

- `authenticate` — verify access token → `req.user`
- `resolveWorkspace` — find active membership; **lazily create a personal
  workspace if none** (self-heals pre-multi-tenancy accounts, no migration);
  block non-active workspaces with **403 `WORKSPACE_INACTIVE`**; attach
  `req.workspaceId` + `req.wsRole`
- `requireWorkspaceRole(...roles)` — guard owner/admin routes

### Routes

```
GET    /workspace              context { workspaceId, role, name, status, ownerEmail }
PATCH  /workspace              rename                        (owner/admin)
GET    /workspace/stats        totals + time series          (owner/admin)
GET    /workspace/members      roster                        (owner/admin)
POST   /workspace/invite       create invite link            (owner/admin)
PATCH  /workspace/members/:id  change role (never owner)     (owner/admin)
DELETE /workspace/members/:id  remove member                 (owner/admin)

GET    /workspace/join/:token  public — describe the invite
POST   /workspace/join/:token  public — accept, create user, sign in
POST   /workspace/activate     public — email + code (rate limited)
```

---

## 2. THE STORE BRIDGE (verified working)

Your Base44 store calls the app directly when someone buys. Three endpoints,
one shared secret, one base URL.

```
POST /api/v1/platform/provision    ← on purchase
POST /api/v1/platform/suspend      ← on refund / chargeback
POST /api/v1/platform/reactivate   ← if the refund reverses
```

### The guard

```js
const configured = env.PLATFORM_SECRET || process.env.PLATFORM_SECRET;
const provided = req.get('x-platform-secret') ?? '';
if (!configured || !safeEqual(provided, configured)) {
  return next(ApiError.unauthorized('Not authorized.', { code: 'PLATFORM_UNAUTHORIZED' }));
}
```

**Fails closed.** No secret configured → everything rejected. The alternative
(no secret = no auth) would let anyone who finds your URL mint free accounts or
suspend your paying customers.

Use a **length-safe constant-time compare**. `a === b` leaks length and prefix
through timing.

### What provision does

One call creates **all three**:
1. Workspace
2. User account (with the password you send)
3. Owner membership linking them

The buyer logs in immediately — no activation step, no workspace ID to type.

### Store-side call

```ts
const password = generateSecurePassword();  // generate in the store, never log it

const res = await fetch(`${Deno.env.get("APP_URL")}/api/v1/platform/provision`, {
  method: "POST",
  signal: AbortSignal.timeout(60000),        // see cold-start trap below
  headers: {
    "Content-Type": "application/json",
    "x-platform-secret": Deno.env.get("APP_PLATFORM_SECRET"),
  },
  body: JSON.stringify({
    workspaceId: `ws_order_${order.id}`,      // STABLE — see idempotency trap
    ownerEmail: customerEmail,
    ownerName: customerName,
    password,
  }),
});
```

**Verified response:**

```json
{ "success": true,
  "message": "Workspace provisioned.",
  "data": { "workspaceId": "ws_test_1",
            "method": "password",
            "loginUrl": "https://your-frontend.onrender.com/login" } }
```

Save `loginUrl` + email + password into the order's delivery instructions so the
buyer gets them in their confirmation email.

### Three provisioning methods (priority order)

1. **`password`** — store generated it; buyer signs in normally. **Preferred.**
2. **`activationCode`** — buyer enters email + 6–7 digit code to set a password
3. **Neither** — returns a one-time join link

Re-provisioning an existing owner **resets their password** — that's how
"resend my login" works.

### Secrets per app

| Where | Name | Value |
|---|---|---|
| App backend (Render) | `PLATFORM_SECRET` | the token |
| Base44 store | `<APP>_PLATFORM_SECRET` | same token |
| Base44 store | `<APP>_URL` | backend base URL |

**Use a different secret per app.** One leak then costs you one app, not all 44.

---

## 3. BRING-YOUR-OWN LLM KEYS

Each workspace can paste its own AI provider key, so usage bills to their own
account. No key → falls back to the platform key.

### One registry file

`services/ai/providers.js` is the single source of truth: detection regex,
client functions, default model, platform env key. Adding a provider is **one
entry** — the model enum, Settings UI, encryption and isolation all follow.

```js
const PROVIDERS = [
  { id: 'anthropic',  label: 'Anthropic (Claude)', match: /^sk-ant-[A-Za-z0-9_-]{20,}$/ },
  { id: 'openrouter', label: 'OpenRouter',         match: /^sk-or-[A-Za-z0-9_-]{20,}$/,
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions' },
  { id: 'groq',       label: 'Groq',               match: /^gsk_[A-Za-z0-9]{20,}$/,
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions' },
  { id: 'gemini',     label: 'Google Gemini',      match: /^AIza[\w-]{30,}$/ },
  { id: 'openai',     label: 'OpenAI',             match: /^sk-[A-Za-z0-9_-]{20,}$/ },
];
```

> ⚠️ **ORDER IS LOAD-BEARING.** `sk-ant-…` and `sk-or-…` also match OpenAI's
> broader `sk-…`. Check OpenAI first and every Claude key is silently sent to
> OpenAI and rejected. Specific prefixes first — **and write a regression test.**

Groq and OpenRouter speak the OpenAI wire format: reuse the OpenAI client with a
per-credential `baseUrl`. Anthropic needs its own client (`system` is top-level,
and with no JSON mode you force JSON by prefilling the assistant turn with `{`).

### Detect server-side, from the key itself

The user pastes **one field**. The server determines the provider from the key's
shape. **Never accept a `provider` field from the client** — a mismatch then
becomes structurally impossible.

### Storage

- **AES-256-GCM**, random 12-byte IV per encryption, store `{ciphertext, iv, tag}`
- Secret fields `select: false` **and** a `toJSON` that strips them
- **Only `last4` is ever returned by the API.** Never widen this.
- Unique index `(appId, workspaceId)` — one key per workspace
- Key from `ENCRYPTION_KEY`; if unset derive via scrypt from the refresh secret
  **and log a warning** (rotating that secret then invalidates stored keys)

### Verify on save

- Provider **rejects the key** → fail the save with a clear message
- **Any other failure** (network, rate limit) → store it, mark `unverified`,
  expose a **Test** button

### One chokepoint

```js
resolveCredential(workspaceId) -> { provider, apiKey, model, baseUrl?, source }
```

Returns the workspace's own key (`source: 'workspace'`) else the platform key
(`source: 'platform'`). **Never throws** on a missing key — falling back is
normal. If decryption fails, log, fall back, prompt the tenant to re-paste.

Dispatch on **the credential's provider**, not a global setting: a workspace on
Claude uses Claude even when the platform default is Gemini.

### Routes (owner/admin only)

```
GET    /workspace/api-key       { key: masked | null, providers: [...], platformFallback }
PUT    /workspace/api-key       save/replace (rate limited)
POST   /workspace/api-key/test  re-verify
DELETE /workspace/api-key       remove, fall back to platform
```

---

## 4. ENV VARS

```bash
# Core
NODE_ENV=production
PORT=5000
MONGODB_URI=
CLIENT_URL=https://your-frontend.com        # NO trailing slash — builds buyer login links
CORS_ORIGINS=https://your-frontend.com

# Secrets — generate unique per app, never reuse
JWT_ACCESS_SECRET=      # 48+ chars
JWT_REFRESH_SECRET=     # 48+ chars
COOKIE_SECRET=          # 16+ chars
ENCRYPTION_KEY=         # base64, 32 bytes — encrypts tenant AI keys
PLATFORM_SECRET=        # store bridge; unset = bridge disabled

# AI platform fallback (workspaces may use any provider regardless)
AI_PROVIDER=gemini
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

ALLOW_PUBLIC_SIGNUP=true    # false = store-only accounts
```

---

## 5. DEPLOY CHECKLIST (Render)

- Backend = **Web Service**, start command **`npm start`** (not `npm run dev`)
- Build command `npm install` (add a no-op `build` script if Render insists)
- Frontend = **Static Site**; `VITE_API_URL` must **include `/api/v1`**
- MongoDB Atlas as an external service
- **Env changes need a redeploy** — Render does not hot-reload them

Verify after deploy:

```bash
curl https://your-backend.onrender.com/api/v1/health
```

JSON = backend. HTML = you grabbed the frontend URL by mistake.

---

## 6. TRAPS ALREADY PAID FOR — do not rediscover these

1. **Cold start loses sales.** Render free tier sleeps after ~15 min idle;
   first request took **32.6 s** (vs 0.37 s warm). A purchase is exactly the
   traffic that hits a cold service. Set a **60 s timeout** store-side, retry
   once, and pay for a tier that doesn't sleep if you're taking real money.
2. **Idempotency.** `workspaceId` defaults to a random value if you omit it, so
   a retried payment webhook creates a **second workspace** and the membership
   lookup becomes ambiguous. Always send a stable `ws_order_<id>`.
3. **Split-domain logout.** API and client on different domains → the refresh
   cookie needs `SameSite=None; Secure` in production. `Strict` silently drops it
   and users get logged out on refresh.
4. **Flags that can't turn off.** `env.X || process.env.X === 'true'` can only
   enable. Use `process.env.X !== 'false'`.
5. **`NODE_ENV=test` must be set by the FIRST import** in the test entry file —
   config modules read `process.env` at load time. Without it, tests that should
   skip network calls hit real provider APIs.
6. **Status-code param mismatch.** A helper taking `status` but called with
   `statusCode` silently returns 200. Assert real status codes in tests.
7. **Every fetch needs a timeout, including DNS.** A hung DNS lookup with no
   timeout leaves jobs stuck forever. Add an overall deadline plus a startup
   sweep that fails orphans and refunds credits.
8. **Don't let a stuck job disable its own escape hatch.** If the UI disables
   "Retry" whenever status is `running`, a stuck record locks the user out
   permanently. Treat anything older than the server deadline as stale and
   re-enable the button.
9. **Never log a key**, even partially. Log provider and outcome only.
10. **PowerShell aliases `curl` to `Invoke-WebRequest`** — `-X/-H/-d` fail. Use
    `curl.exe` when giving Windows users commands.

---

## 7. ACCEPTANCE TESTS — not done until these pass

**Workspace isolation**
- [ ] Each new user gets their own workspace
- [ ] B's list never contains A's records
- [ ] B opening A's record ID → **404, not 403**
- [ ] B cannot update/delete A's record; A's record is untouched
- [ ] Suspended workspace blocked from all tenant routes (403)
- [ ] A member cannot reach team management (403)
- [ ] Owner's role cannot be changed or removed
- [ ] Invalid/expired join token rejected

**Store bridge**
- [ ] `/platform/*` without the secret → 401
- [ ] Provision with a password → buyer logs in normally as owner
- [ ] Re-provisioning the same `workspaceId` does not duplicate
- [ ] Suspend blocks access; reactivate restores it

**API keys**
- [ ] Raw key appears **nowhere** in any response (assert the whole body)
- [ ] Stored document has no plaintext; encryption envelope present
- [ ] B resolves to `source: 'platform'` and never reaches A's key
- [ ] Saving B's key doesn't touch A's; one key per workspace
- [ ] Member gets 403 on read, replace, AND delete
- [ ] Every provider detected from its key alone
- [ ] `sk-ant-…` → Anthropic, **not** OpenAI (prefix-ordering regression)
- [ ] OpenAI-compatible providers hit their own base URL

Run the suite and report the **real** pass/fail count. If something fails, say so
with the output — never describe the build as complete.

---

## Reference implementation

| Concern | File |
|---|---|
| Provider registry | `server/src/services/ai/providers.js` |
| Key storage + resolution | `server/src/services/workspace/apiKeyService.js` |
| Encryption | `server/src/utils/secretBox.js` |
| Provider dispatch | `server/src/services/ai/aiClient.js` |
| Workspace resolution | `server/src/middleware/auth.js` |
| Tenant filtering | `server/src/middleware/ownership.js` |
| Store bridge | `server/src/controllers/platformController.js` |
| Membership + invites | `server/src/services/workspace/membershipService.js` |
| Settings UI | `client/src/components/workspace/ApiKeyPanel.jsx` |
| Isolation tests | `server/tests/api/workspace.test.js`, `apiKeys.test.js` |
