# Merchant Management System

Production-oriented backend CRM engine for merchant onboarding, KYB processing, merchant lifecycle management, and webhook notifications.

The project is implemented in TypeScript with:

- Node.js `>=20`
- Express `4.x`
- PostgreSQL
- JWT authentication
- Zod validation
- Jest and Supertest

## Implemented Features

- Operator login with email/password
- JWT access tokens with 15-minute expiry
- Refresh-token rotation
- Temporary lockout after repeated failed logins
- Merchant create, read, list, filter, update, and delete
- Merchant pricing tiers with admin-only updates
- KYB document record, read, list, and verify flows
- Merchant status transition enforcement
- Activation eligibility checks based on verified KYB documents
- Immutable merchant status and pricing-tier history
- Webhook subscriptions, signing, retries, and background delivery
- Jest service tests and Supertest HTTP test suites

## Domain Rules

### Merchant statuses

- `Pending KYB`
- `Active`
- `Suspended`

### Allowed status transitions

- `Pending KYB -> Active`
- `Pending KYB -> Suspended`
- `Active -> Suspended`
- `Suspended -> Active`

Invalid transitions are rejected with `INVALID_STATUS_TRANSITION`.

### Activation requirements

A merchant can only move to `Active` if all required documents are present and verified:

- `business_registration`
- `owner_identity_document`
- `bank_account_proof`

If not, the API returns `KYB_REQUIREMENTS_NOT_MET`.

### Admin-only actions

- delete merchant
- change merchant pricing tier

Unauthorized attempts return `ADMIN_REQUIRED`.

## Project Structure

- `src/routes/` endpoint definitions
- `src/controllers/` request handlers
- `src/services/` business logic
- `src/middleware/` auth and error middleware
- `src/db/` repository/database layer
- `src/types/` shared TypeScript types
- `migrations/` SQL schema migrations
- `tests/` Jest and Supertest test suites
- `scripts/` migration and CLI helper scripts

## Environment Variables

Copy the template first:

```bash
cp .env.example .env
```

Current required variables are:

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

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
cp .env.example .env
```

3. Ensure PostgreSQL is running and the configured database exists.

4. Run migrations:

```bash
npm run db:migrate
```

5. Create an operator:

```bash
npm run operator:set -- --email admin@example.com --password StrongPass123 --role admin
```

6. Start the development server:

```bash
npm run dev
```

Or run migrations and start together:

```bash
npm run start:dev
```

For memory-backed testing instead of PostgreSQL, set:

```bash
AUTH_STORAGE=memory
```

## Scripts

- `npm run dev` start the server in watch mode
- `npm run start:dev` run migrations, then start the server
- `npm run build` compile TypeScript to `dist/`
- `npm start` run the built server
- `npm run db:migrate` apply SQL migrations
- `npm run operator:set -- --email <email> --password <password> --role <role>` create or update an operator
- `npm test` run the default Jest suite
- `npm run test:http` run the Supertest HTTP suites
- `npm run ops -- help` list terminal helper commands

## Testing

Run the default test suite:

```bash
npm test
```

Run the route-level HTTP suites:

```bash
npm run test:http
```

Notes:

- `npm test` covers the service layer and skips HTTP suites by default.
- `npm run test:http` is intended for a normal local machine.
- In this sandboxed environment, HTTP suites cannot run because local socket binding is blocked and Supertest fails with `listen EPERM`.

## Operator Setup

Operators are internal users. Supported roles:

- `admin`
- `operator`

Create or update an operator:

```bash
npm run operator:set -- --email admin@example.com --password StrongPass123 --role admin
```

Requirements:

- email must be valid
- password must be at least 8 characters
- role must be `admin` or `operator`

Passwords are stored as hashes only.

## Terminal Workflow

The project includes a helper CLI:

```bash
npm run ops -- help
```

### Auth commands

```bash
npm run ops -- health
npm run ops -- login admin@example.com StrongPass123
npm run ops -- refresh
npm run ops -- token access
npm run ops -- token refresh
npm run ops -- auth-header
```

Behavior:

- login stores tokens in `.auth/tokens.json`
- refresh uses the saved refresh token by default
- saved tokens are rotated automatically on successful refresh

### Merchant commands

```bash
npm run ops -- merchant:create "Atlas Pharmacy" Pharmacy Casablanca owner@atlas.ma
npm run ops -- merchant:list
npm run ops -- merchant:list Active Casablanca
npm run ops -- merchant:get <merchantId>
npm run ops -- merchant:update <merchantId> - - Rabat - Active
npm run ops -- merchant:delete <merchantId>
npm run ops -- merchant:set-pricing-tier <merchantId> premium
npm run ops -- merchant:history <merchantId>
```

Notes:

- new merchants always start in `Pending KYB`
- use `-` in `merchant:update` to skip unchanged fields
- activation requires verified KYB documents
- merchant deletion and pricing-tier changes require an admin token

### KYB commands

```bash
npm run ops -- kyb:add-doc <merchantId> business_registration business-reg.pdf
npm run ops -- kyb:add-doc <merchantId> owner_identity_document owner-id.pdf
npm run ops -- kyb:add-doc <merchantId> bank_account_proof bank-proof.pdf
npm run ops -- kyb:list-docs <merchantId>
npm run ops -- kyb:get-doc <merchantId> business_registration
npm run ops -- kyb:verify-doc <merchantId> business_registration true
```

### Webhook command

```bash
npm run ops -- webhook:subscribe https://example.com/webhook shared-secret
```

## Example End-to-End Flow

1. Create an admin operator:

```bash
npm run operator:set -- --email admin@example.com --password StrongPass123 --role admin
```

2. Start the app:

```bash
npm run start:dev
```

3. Log in:

```bash
npm run ops -- login admin@example.com StrongPass123
```

4. Create a merchant:

```bash
npm run ops -- merchant:create "Atlas Pharmacy" Pharmacy Casablanca owner@atlas.ma
```

5. Add the 3 required KYB documents:

```bash
npm run ops -- kyb:add-doc <merchantId> business_registration business-reg.pdf
npm run ops -- kyb:add-doc <merchantId> owner_identity_document owner-id.pdf
npm run ops -- kyb:add-doc <merchantId> bank_account_proof bank-proof.pdf
```

6. Verify all 3 documents:

```bash
npm run ops -- kyb:verify-doc <merchantId> business_registration true
npm run ops -- kyb:verify-doc <merchantId> owner_identity_document true
npm run ops -- kyb:verify-doc <merchantId> bank_account_proof true
```

7. Activate the merchant:

```bash
npm run ops -- merchant:update <merchantId> - - - - Active
```

8. Review history:

```bash
npm run ops -- merchant:history <merchantId>
```

## API Overview

### Auth

- `POST /auth/login`
  - body: `{ "email": "admin@example.com", "password": "StrongPass123" }`
- `POST /auth/refresh`
  - body: `{ "refreshToken": "<token>" }`

### Merchants

- `POST /merchants`
  - requires bearer token
  - body: `{ "name": "...", "category": "...", "city": "...", "contactEmail": "...", "pricingTier": "standard|premium|enterprise" }`
- `GET /merchants`
  - requires bearer token
  - optional query params: `status`, `city`, `category`, `q`
- `GET /merchants/:merchantId`
  - requires bearer token
- `PATCH /merchants/:merchantId`
  - requires bearer token
  - body: any subset of:
    - `name`
    - `category`
    - `city`
    - `contactEmail`
    - `status`
- `DELETE /merchants/:merchantId`
  - requires bearer token
  - admin only
- `PATCH /merchants/:merchantId/pricing-tier`
  - requires bearer token
  - admin only
  - body: `{ "pricingTier": "standard|premium|enterprise" }`
- `GET /merchants/:merchantId/history`
  - requires bearer token

### KYB

- `POST /merchants/:merchantId/documents`
  - requires bearer token
  - body: `{ "type": "business_registration|owner_identity_document|bank_account_proof", "fileName": "..." }`
- `GET /merchants/:merchantId/documents`
  - requires bearer token
- `GET /merchants/:merchantId/documents/:documentType`
  - requires bearer token
- `PATCH /merchants/:merchantId/documents/:documentType/verify`
  - requires bearer token
  - body: `{ "verified": true }`

### Webhooks

- `POST /webhooks/subscriptions`
  - requires bearer token
  - body: `{ "url": "https://example.com/webhook", "secret": "shared-secret" }`

Webhook behavior:

- `Active` triggers `merchant.approved`
- `Suspended` triggers `merchant.suspended`
- payloads are signed with `X-Webhook-Signature`
- failed deliveries retry up to 3 times
- delivery runs asynchronously and does not block the original merchant update
