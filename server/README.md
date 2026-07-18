# LocalSchema AI — Server

Backend API for LocalSchema AI: an AI-powered local business Schema.org generator.

> Helps search engines understand your local business and improve local search
> visibility with accurate structured data. It does not promise guaranteed
> Google rankings or rich results.

## Stack

Node.js · Express · MongoDB/Mongoose · JWT auth · bcryptjs · Zod · Helmet ·
CORS · Express Rate Limit. (Phase 2+ adds Cheerio/Playwright crawling, OpenAI
extraction, and AJV schema validation.)

## Requirements

- Node.js 20+
- A MongoDB connection string (local `mongod` or MongoDB Atlas)

## Setup

```bash
cd server
npm install
cp .env.example .env      # then fill in the "Required" block
```

At minimum set `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and
`COOKIE_SECRET`. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Email is disabled by default (`EMAIL_ENABLED=false`); verification and reset
links are logged to the server console instead of being sent, so no SMTP server
is needed for local development.

## Run

```bash
npm run dev      # watch mode
npm start        # production mode
npm run seed     # seed plans, schema types, and demo accounts (needs a DB)
```

Seed accounts are created only when their credentials are present in `.env`
(`ADMIN_EMAIL`/`ADMIN_PASSWORD`, `DEMO_USER_*`, `DEMO_AGENCY_*`). Passwords are
never hardcoded.

## Tests

```bash
npm test
```

Tests boot a real in-memory MongoDB (`mongodb-memory-server`) and exercise the
genuine Express stack — the same code path that runs against Atlas in
production. The first run downloads a `mongod` binary (~65 MB) and caches it.

## API

All routes are versioned under `/api/v1`. Health check: `GET /api/v1/health`.
Auth issues a short-lived JWT access token (returned in the body) and a
long-lived refresh token (set as a signed, HTTP-only cookie).

Implemented in Phase 1: auth, projects, dashboard, catalog (plans + schema
types), and admin. Phase 2+ routers (scans, business data, schemas, locations,
reports) mount into the same `/api/v1` router as each phase lands.
