# Merchant Management System

Backend CRM engine for merchant onboarding, KYB processing, merchant lifecycle management, and webhook notifications.

## Stack

- Node.js `>=20`
- Express `4.x`
- PostgreSQL
- JWT authentication
- Zod validation
- Jest and Supertest

## Features

- Operator login with access and refresh tokens
- Temporary lockout after repeated failed logins
- Merchant create, get, list, filter, update, delete
- Admin-only pricing-tier changes
- KYB document record, list, get, verify
- Enforced merchant status transitions
- Immutable merchant status and pricing-tier history
- Webhook subscriptions, signing, retry, and background delivery

## Merchant Rules

Statuses:

- `Pending KYB`
- `Active`
- `Suspended`

Allowed transitions:

- `Pending KYB -> Active`
- `Pending KYB -> Suspended`
- `Active -> Suspended`
- `Suspended -> Active`

Activation requires all of these documents to exist and be verified:

- `business_registration`
- `owner_identity_document`
- `bank_account_proof`

Admin-only actions:

- delete merchant
- change pricing tier

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local config:

```bash
cp .env.example .env
```

3. Ensure PostgreSQL is running and the configured database exists.

4. Apply migrations:

```bash
npm run db:migrate
```

5. Create an operator:

```bash
npm run operator:set -- --email admin@example.com --password StrongPass123 --role admin
```

6. Start the server:

```bash
npm run dev
```

Or run migrations and start together:

```bash
npm run start:dev
```

For memory-backed test mode instead of PostgreSQL:

```bash
AUTH_STORAGE=memory
```

## Environment Variables

Defined in `.env.example`:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `AUTH_STORAGE`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `WEBHOOK_SIGNING_SECRET`
- `LOGIN_MAX_ATTEMPTS`
- `LOGIN_LOCKOUT_MINUTES`

## Scripts

- `npm run dev` start the server in watch mode
- `npm run start:dev` run migrations, then start the server
- `npm run build` compile TypeScript
- `npm start` run the compiled server
- `npm run db:migrate` apply SQL migrations
- `npm run operator:set -- --email <email> --password <password> --role <role>` create or update an operator
- `npm test` run service-layer tests
- `npm run test:http` run HTTP suites
- `npm run ops -- <section:help>` show terminal helper commands by section

## Testing

Default suite:

```bash
npm test
```

HTTP suite:

```bash
npm run test:http
```

Notes:

- `npm test` runs the service-layer Jest tests.
- `npm run test:http` runs the Supertest route tests.
- In this sandbox, `test:http` cannot run because local socket binding is blocked and Supertest fails with `listen EPERM`.

## CLI Workflow

Show all commands:

```bash
npm run ops -- help
```

Section help:

```bash
npm run ops -- auth:help
npm run ops -- merchant:help
npm run ops -- kyb:help
npm run ops -- webhook:help
```

Auth:

```bash
npm run ops -- health
npm run ops -- auth:set-operator admin@example.com StrongPass123 admin
npm run ops -- auth:login admin@example.com StrongPass123
npm run ops -- auth:refresh
npm run ops -- auth:token access
npm run ops -- auth:header
```

Merchant:

```bash
npm run ops -- merchant:create "Atlas Pharmacy" Pharmacy Casablanca owner@atlas.ma
npm run ops -- merchant:list "Pending KYB"
npm run ops -- merchant:list pending
npm run ops -- merchant:list - Casablanca
npm run ops -- merchant:list active Casablanca
npm run ops -- merchant:list active Casablanca - premium
npm run ops -- merchant:list - - - - atlas
npm run ops -- merchant:get <merchantId>
npm run ops -- merchant:update <merchantId> - - Rabat -
npm run ops -- merchant:set-status <merchantId> active
npm run ops -- merchant:set-status <merchantId> "Pending KYB"
npm run ops -- merchant:delete <merchantId>
npm run ops -- merchant:set-pricing-tier <merchantId> premium
npm run ops -- merchant:history <merchantId>
```

KYB:

```bash
npm run ops -- kyb:add-doc <merchantId> business_registration business-reg.pdf
npm run ops -- kyb:add-doc <merchantId> owner_identity_document owner-id.pdf
npm run ops -- kyb:add-doc <merchantId> bank_account_proof bank-proof.pdf
npm run ops -- kyb:list-docs <merchantId>
npm run ops -- kyb:get-doc <merchantId> business_registration
npm run ops -- kyb:history <merchantId> business_registration
npm run ops -- kyb:verify-doc <merchantId> business_registration true
```

Webhooks:

```bash
npm run ops -- webhook:subscribe https://example.com/webhook shared-secret
```

Notes:

- login stores tokens in `.auth/tokens.json`
- refresh rotates the saved token pair automatically
- new merchants always start in `Pending KYB`
- allowed merchant statuses are `Pending KYB`, `Active`, and `Suspended`
- the CLI also accepts `pending`, `pending-kyb`, `pending_kyb`, `pkyb`, and `pk` for `Pending KYB`
- allowed pricing tiers are `standard`, `premium`, and `enterprise`
- merchant creation rejects manual `status` assignment
- use one of those exact status values, or the documented aliases, when filtering or updating status
- use `-` in `merchant:list` to skip earlier filter positions, for example `merchant:list - Casablanca`
- `merchant:list` arguments are ordered as `[status] [city] [category] [pricingTier] [q]`
- `q` is a free-text search query across merchant name, category, city, and contact email
- use `-` in `merchant:update` to skip unchanged fields
- `merchant:update` changes merchant details only; use `merchant:set-status` for lifecycle changes

## API Overview

Auth:

- `POST /auth/login`
- `POST /auth/refresh`

Merchants:

- `POST /merchants`
- `GET /merchants`
- `GET /merchants/:merchantId`
- `PATCH /merchants/:merchantId`
- `PATCH /merchants/:merchantId/status`
- `DELETE /merchants/:merchantId`
- `PATCH /merchants/:merchantId/pricing-tier`
- `GET /merchants/:merchantId/history`

KYB:

- `POST /merchants/:merchantId/documents`
- `GET /merchants/:merchantId/documents`
- `GET /merchants/:merchantId/documents/:documentType`
- `GET /merchants/:merchantId/documents/:documentType/history`
- `PATCH /merchants/:merchantId/documents/:documentType/verify`

Webhooks:

- `POST /webhooks/subscriptions`

All merchant and webhook endpoints require a bearer token.
`POST /merchants` does not accept `status`; merchants always start in `Pending KYB`.

## Project Structure

- `src/routes/` endpoints
- `src/controllers/` request handlers
- `src/services/` business logic
- `src/middleware/` auth and error middleware
- `src/db/` repositories
- `src/types/` shared types
- `migrations/` SQL migrations
- `tests/` automated tests
- `scripts/` operational helpers
