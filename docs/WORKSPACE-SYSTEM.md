# Portable Prompt — Workspaces, Store Bridge, Email & BYO LLM Keys

Paste this whole file as a prompt when building any app in the suite. Replace two
placeholders; everything else is identical across every app.

Every behaviour here is **running in production** in LocalSchema AI and covered
by 119 passing tests. It is not a proposal.

| Placeholder | Meaning | Example |
|---|---|---|
| `<APP_ID>` | Short slug for THIS app | `localschema` |
| `<TENANT_MODELS>` | Models holding customer data | `Project`, `Location` |

---

## PROMPT STARTS HERE

Implement four systems that must behave **identically in every app I own**:
workspace multi-tenancy, a server-to-server store bridge, transactional email,
and per-workspace LLM keys. These are security boundaries — follow the spec, do
not simplify it.

Stack: Node + Express + Mongoose, React + React Query. Adapt idioms if the stack
differs; never weaken a rule.

---

# PART A — WORKSPACES

A **workspace** is one paying customer's isolated tenant. Every customer-owned
record carries `workspaceId`; every query filters by it. Users join through a
**membership record**, never a field on the user.

## Constants

```js
export const APP_ID = '<APP_ID>';
export const WORKSPACE_ROLES   = { OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member' };
export const WORKSPACE_STATUS  = { ACTIVE: 'active', SUSPENDED: 'suspended', CANCELLED: 'cancelled' };
export const MEMBER_STATUS     = { ACTIVE: 'active', INVITED: 'invited', REVOKED: 'revoked' };
```

Two role axes — never conflate: **platform role** (`admin`/`user`, running the
SaaS) vs **workspace role** (`owner`/`admin`/`member`, one customer's team).

## Models

- **Workspace** — `appId`, `workspaceId` (unique, indexed), `name`,
  `ownerUserId` (nullable), `ownerEmail` (indexed — used for idempotency),
  `status`
- **WorkspaceMember** — `appId`, `workspaceId`, `userId`, `role`, `status`;
  unique index `(workspaceId, userId)`
- **Invitation** — `tokenHash` (SHA-256, **never the raw token**), `expiresAt`,
  `status`
- **Every `<TENANT_MODELS>`** gains `appId` + `workspaceId` (required, indexed),
  and every existing index becomes workspace-scoped. Global uniqueness rules
  become unique **per workspace**.

Workspace id: `` `ws_${crypto.randomBytes(18).toString('base64url')}` `` —
random, never sequential.

## Middleware

- `authenticate` → `req.user`
- `resolveWorkspace` → finds active membership; **lazily creates a personal
  workspace if none** (self-heals old accounts, no migration); returns **403
  `WORKSPACE_INACTIVE`** for non-active workspaces; attaches `req.workspaceId`
  and `req.wsRole`
- `requireWorkspaceRole(...roles)` for owner/admin routes

## THE ISOLATION RULES — non-negotiable

1. **`workspaceId` comes only from the session.** Never from URL, body, query, or
   header. A customer must never be able to *name* another's workspace.
2. **Every tenant query filters `{ appId, workspaceId }`.** A bare
   `Model.findById(id)` on tenant data is a bug.
3. **Cross-tenant access returns 404, never 403.** A 403 confirms existence and
   allows ID enumeration.
4. **Members see only their own records; owner/admin see all.**
5. **Background jobs read `workspaceId` from the stored record** — no session.
6. **The owner's role can never be changed or removed** via the team API.

---

# PART B — THE STORE BRIDGE (server-to-server)

Your store calls the app directly when someone buys. Four endpoints, one shared
secret, one base URL.

```
GET  /api/v1/platform/manifest      ← discovery, PUBLIC
POST /api/v1/platform/provision     ← on purchase
POST /api/v1/platform/suspend       ← on refund
POST /api/v1/platform/reactivate    ← on reversal
```

## The guard

```js
const configured = env.PLATFORM_SECRET || process.env.PLATFORM_SECRET;
const provided = req.get('x-platform-secret') ?? '';
if (!configured || !safeEqual(provided, configured)) {
  return next(ApiError.unauthorized('Not authorized.', { code: 'PLATFORM_UNAUTHORIZED' }));
}
```

**Fails closed** — no secret configured means everything is rejected. The
alternative would let anyone who finds the URL mint free accounts or suspend
paying customers. Use a **length-safe constant-time compare**; `a === b` leaks
length and prefix through timing.

## The manifest (public, no secret)

The store is given only a base URL and fetches this to learn the rest. Keep the
shape identical in every app so one store-side reader works for all of them.

```json
{ "appId": "<APP_ID>", "name": "...", "apiVersion": "v1", "workspaceSystem": "1.0",
  "auth": { "type": "shared-secret", "header": "x-platform-secret" },
  "endpoints": { "provision": "...", "suspend": "...", "reactivate": "..." },
  "defaults": { "method": "password", "generatesPassword": true, "sendsWelcomeEmail": true },
  "loginUrl": "https://.../login",
  "ready": true }
```

`ready` is false when `PLATFORM_SECRET` is unset — it surfaces the commonest
setup mistake before a customer hits it. Contains no secrets and grants nothing.

## Provision — the contract

**The store sends two fields. Everything else is automatic.**

```json
{ "ownerName": "Jane Smith", "ownerEmail": "customer@example.com" }
```

```json
{ "workspaceId": "ws_...", "method": "password",
  "loginUrl": "https://.../login",
  "temporaryPassword": "7Kp$mRt2vXqB9wZa", "emailed": true }
```

One call creates **workspace + user + owner membership**, generates the password,
and emails the credentials. The buyer signs in immediately.

### Required behaviour

**Default to a live owner account, never a join link.** A workspace with
`ownerUserId: null` waiting on a click is the opposite of what a paying customer
wants. The join-link flow is opt-in only via `method: "link"`.

**Generate the password when none is supplied.** Many stores cannot generate one.
Return it **once** as `temporaryPassword`; only a bcrypt hash is stored, so it can
never be read back. Exclude ambiguous characters (`0/O`, `1/l/I`) — a human
retypes it from an email.

**Send the welcome email by default**, opt out with `sendWelcomeEmail: false`:

```js
const shouldEmail = req.body.sendWelcomeEmail !== false;
```

Use `!== false`, never `if (flag)` — a flag that can only ever be enabled is a
trap.

**A mail failure must NOT fail provisioning.** The account already exists and the
customer has paid. Return `emailed: false` and let the store deliver the password
as a fallback.

**Be idempotent two ways.** Payment webhooks retry.
1. A supplied `workspaceId` that already exists → reactivate and reuse
2. **No `workspaceId` → look up an existing workspace by `ownerEmail` and reuse
   it.** Without this, every retry mints a second workspace for the same buyer
   and their membership lookup becomes ambiguous.

Re-provisioning an existing owner resets their password — that is your
"resend my login" with no extra endpoint.

**The buyer never types a workspace ID.** They log in with email + password.

## Suspend / reactivate

```json
{ "workspaceId": "ws_..." }   →   { "workspaceId": "ws_...", "status": "suspended" }
```

**Validate and confirm a match.** A missing or misspelled id must return 400/404,
never a cheerful 200. A refund webhook that reports success while changing
nothing leaves the customer with full access and you never find out.

## Store-side call

```ts
const res = await fetch(`${app.baseUrl}/api/v1/platform/provision`, {
  method: "POST",
  signal: AbortSignal.timeout(60000),      // cold starts — see traps
  headers: { "Content-Type": "application/json", "x-platform-secret": app.secret },
  body: JSON.stringify({ ownerName, ownerEmail }),
});
const { data } = await res.json();
order.workspaceId = data.workspaceId;      // REQUIRED for refunds later
if (!data.emailed) { /* deliver data.temporaryPassword yourself */ }
```

**Use a different secret per app.** One leak then costs one app, not all of them.

---

# PART C — TRANSACTIONAL EMAIL

## Provider registry

Mirror the LLM registry so both read alike. Resend is HTTP — no SDK, no SMTP
ports (which some hosts block). SMTP would need `nodemailer`; don't add it until
something needs it.

```
services/email/
  providers.js     ← resend (+ others), isConfigured(), send()
  emailClient.js   ← sendEmail({ to, subject, html, text, replyTo })
  templates.js     ← passwordReset, welcomeCredentials, teamInvite
```

## Rules

**Degrade, never throw.** A missing key must not break password reset for
everyone. Return `{ sent: false }`, log the link in development, and let callers
carry on.

**Never surface `sent` to the user.** "No email was sent" reveals whether an
account exists.

**Never log the body.** Reset links and passwords are credentials. Log recipient,
subject, provider id — nothing else.

**Templates need inline styles and a text part.** Mail clients strip `<style>`
blocks; HTML-only mail scores worse with spam filters.

**Distinguish provider errors properly.** Resend returns **403 for both a bad key
and an unverified domain**. Blaming the key sends people regenerating perfectly
good credentials — match on the message and raise
`EMAIL_DOMAIN_UNVERIFIED` separately.

## Password reset

```
POST /api/v1/auth/forgot-password   { email }
POST /api/v1/auth/reset-password    { token, password }
```

- **Identical response for known and unknown addresses** — same status, same
  message. Any difference enumerates your customers.
- **Store SHA-256 of the token**, never the raw value. Index it, TTL it.
- **Single use** (`usedAt`) and short expiry (1 hour).
- **A new request invalidates outstanding tokens**, or a forwarded email stays
  live.
- **Bump `tokenVersion` on reset** so every existing refresh token dies — that is
  the point of a reset.
- **Rate limit both endpoints.** Otherwise the first is an email bomber and the
  second is brute-forceable.
- Expired, spent, and fabricated tokens all return the **same** message.

---

# PART D — PER-WORKSPACE LLM KEYS

Each workspace may paste its own provider key; usage then bills to their account.
No key → falls back to the platform key.

## One registry file

`services/ai/providers.js` holds detection regex, client fns, default model, and
platform env key per provider.

```js
[ { id:'anthropic',  match:/^sk-ant-[A-Za-z0-9_-]{20,}$/ },
  { id:'openrouter', match:/^sk-or-[A-Za-z0-9_-]{20,}$/,  baseUrl:'https://openrouter.ai/api/v1/chat/completions' },
  { id:'groq',       match:/^gsk_[A-Za-z0-9]{20,}$/,      baseUrl:'https://api.groq.com/openai/v1/chat/completions' },
  { id:'gemini',     match:/^AIza[\w-]{30,}$/ },
  { id:'openai',     match:/^sk-[A-Za-z0-9_-]{20,}$/ } ]
```

> ⚠️ **ORDER IS LOAD-BEARING.** `sk-ant-` and `sk-or-` also match OpenAI's
> broader `sk-`. Check OpenAI first and every Claude key is silently sent to
> OpenAI and rejected. Specific prefixes first — **write a regression test.**

## Rules

- **Detect the provider server-side from the key.** Never accept a `provider`
  field from the client; a mismatch then becomes impossible.
- **AES-256-GCM at rest**, random IV, store `{ciphertext, iv, tag}`. Secret fields
  `select:false` **plus** a `toJSON` that strips them.
- **Only `last4` is ever returned.** Never widen this.
- **Verify on save** with one cheap call: a rejected key fails the save; any other
  failure stores it as `unverified` with a Test button.
- **`resolveCredential(workspaceId)`** is the single chokepoint → workspace key,
  else platform key. **Never throws** on a missing key. Dispatch on the
  credential's provider, not a global setting.

---

# PART E — ENVIRONMENT

```bash
NODE_ENV=production
MONGODB_URI=
CLIENT_URL=https://your-frontend.com        # NO trailing slash — builds buyer login links
CORS_ORIGINS=https://your-frontend.com

JWT_ACCESS_SECRET=      # 48+ chars
JWT_REFRESH_SECRET=     # 48+ chars
COOKIE_SECRET=          # 16+ chars
ENCRYPTION_KEY=         # base64 32 bytes — encrypts tenant AI keys
PLATFORM_SECRET=        # store bridge; unset = bridge disabled

APP_NAME=Your App
EMAIL_PROVIDER=resend   # 'none' disables sending
RESEND_API_KEY=
EMAIL_FROM=Your App <no-reply@VERIFIED-domain.com>
EMAIL_REPLY_TO=         # a mailbox that can actually RECEIVE

AI_PROVIDER=gemini
GEMINI_API_KEY=
```

---

# PART F — TRAPS ALREADY PAID FOR

1. **Cold starts lose sales.** Free-tier hosts sleep after ~15 min; first request
   took **32.6 s** vs 0.37 s warm. A purchase is exactly the traffic that hits a
   cold service. 60 s timeout store-side, retry once, and pay for a tier that
   doesn't sleep once real money is involved.
2. **Provision must be idempotent by email**, not just by supplied id — see B.
3. **Split-domain logout.** API and client on different domains → refresh cookie
   needs `SameSite=None; Secure`. `Strict` silently drops it.
4. **Flags that can't turn off.** `env.X || process.env.X === 'true'` can only
   enable. Use `!== false`.
5. **`NODE_ENV=test` must be set by the FIRST import** in the test entry file —
   config reads `process.env` at load. Without it, tests that should skip network
   calls hit real provider APIs.
6. **Sending ≠ receiving.** A domain verified for sending has no inbox. Check MX
   before pointing `EMAIL_REPLY_TO` at it, or replies bounce silently.
7. **Verify the exact sending domain.** A subdomain verified
   (`reply.example.com`) does not authorise the root (`example.com`).
8. **Every fetch needs a timeout, including DNS.** A hung lookup leaves jobs stuck
   forever. Add a deadline plus a startup sweep that fails orphans and refunds.
9. **Don't let a stuck job disable its own escape hatch.** If the UI disables
   "Retry" whenever status is `running`, a stuck record locks the user out
   permanently. Treat anything past the server deadline as stale.
10. **Never log a key or password**, even partially.
11. **PowerShell aliases `curl` to `Invoke-WebRequest`** — `-X/-H/-d` fail. Tell
    Windows users to use `curl.exe` or `Invoke-RestMethod`.
12. **JSON keys are case-sensitive.** `owneremail` is not `ownerEmail`; the
    request fails with a confusing "required field" error.

---

# PART G — ACCEPTANCE TESTS

**Workspace isolation**
- [ ] B's list never contains A's records
- [ ] B opening A's record ID → **404, not 403**
- [ ] B cannot update/delete A's record; A's is untouched
- [ ] Suspended workspace blocked from all tenant routes (403)
- [ ] A member cannot reach team management (403)
- [ ] Owner's role cannot be changed or removed

**Store bridge**
- [ ] `/platform/*` without the secret → 401; manifest still readable
- [ ] A bare `{ ownerEmail }` creates a **real owner account** with
      `ownerUserId` populated, and that password logs in
- [ ] Calling twice with no `workspaceId` reuses the same workspace (one row)
- [ ] Welcome email is attempted by default and can be disabled
- [ ] Suspending an unknown/missing `workspaceId` → 404/400, never 200
- [ ] Suspend blocks access; reactivate restores it

**Email / password reset**
- [ ] Known and unknown addresses return identical status AND message
- [ ] Stored token is a 64-char SHA-256 digest, not the raw value
- [ ] A spent token cannot be reused
- [ ] An expired token is rejected
- [ ] Requesting a new link invalidates the previous one
- [ ] Password policy enforced on reset

**API keys**
- [ ] Raw key appears **nowhere** in any response (assert the whole body)
- [ ] Stored document has no plaintext; encryption envelope present
- [ ] B resolves to `source: 'platform'` and never reaches A's key
- [ ] Member gets 403 on read, replace, AND delete
- [ ] `sk-ant-…` detects as Anthropic, **not** OpenAI

Run the suite and report the **real** pass/fail count. If something fails, say so
with the output — never describe the build as complete.

## PROMPT ENDS HERE

---

## Reference implementation

| Concern | File |
|---|---|
| Store bridge | `server/src/controllers/platformController.js` |
| Workspace resolution | `server/src/middleware/auth.js` |
| Tenant filtering | `server/src/middleware/ownership.js` |
| Email providers | `server/src/services/email/providers.js` |
| Email templates | `server/src/services/email/templates.js` |
| Password reset | `server/src/services/auth/passwordResetService.js` |
| LLM registry | `server/src/services/ai/providers.js` |
| Key storage | `server/src/services/workspace/apiKeyService.js` |
| Encryption | `server/src/utils/secretBox.js` |
| Tests | `server/tests/api/{workspace,apiKeys,passwordReset}.test.js` |
