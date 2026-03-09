# Merchant Management System

Backend CRM engine for merchant onboarding and KYB lifecycle management.

The codebase is implemented in TypeScript.

## Initial Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Run database migrations:
```bash
npm run db:migrate
```

4. Start development server:
```bash
npm run dev
```

For test/simulated mode without PostgreSQL, set `AUTH_STORAGE=memory`.
For a one-command local start that runs migrations first, use `npm run start:dev`.

## Scripts
- `npm run dev` - run server with watch mode
- `npm run start:dev` - run migrations, then start the dev server
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run server
- `npm run db:migrate` - apply SQL migrations
- `npm test` - run tests
- `npm run test:http` - run HTTP endpoint tests with `supertest`
- `npm run ops -- help` - list quick operations commands

## Quick Terminal Commands
- Health check:
```bash
npm run ops -- health
```

- Create/update operator:
```bash
npm run ops -- set-operator admin@example.com StrongPass123 admin
```

- Login:
```bash
npm run ops -- login admin@example.com StrongPass123
```
This saves the latest tokens to `.auth/tokens.json` with restricted local file permissions.

- Refresh:
```bash
npm run ops -- refresh
```
This uses the saved refresh token automatically and replaces both saved tokens on success.

- Print the current saved access token:
```bash
npm run ops -- token access
```

- Print an Authorization header using the saved access token:
```bash
npm run ops -- auth-header
```

- Create a merchant:
```bash
npm run ops -- merchant:create "Atlas Pharmacy" Pharmacy Casablanca owner@atlas.ma
```
You must be logged in first.

- List merchants with optional filters:
```bash
npm run ops -- merchant:list Active Casablanca
```
You must be logged in first.

- Get a merchant by id:
```bash
npm run ops -- merchant:get <merchantId>
```
You must be logged in first.

- Update a merchant:
```bash
npm run ops -- merchant:update <merchantId> - - Rabat - Active
```
Use `-` to skip fields you do not want to change.
You must be logged in first.

- View merchant status history:
```bash
npm run ops -- merchant:history <merchantId>
```
You must be logged in first.

- Record a KYB document:
```bash
npm run ops -- kyb:add-doc <merchantId> business_registration business-reg.pdf
```
You must be logged in first.

- List KYB documents:
```bash
npm run ops -- kyb:list-docs <merchantId>
```
You must be logged in first.

- Get one KYB document:
```bash
npm run ops -- kyb:get-doc <merchantId> business_registration
```
You must be logged in first.

- Verify a KYB document:
```bash
npm run ops -- kyb:verify-doc <merchantId> business_registration true
```
You must be logged in first.

- Register a webhook subscription:
```bash
npm run ops -- webhook:subscribe https://example.com/webhook shared-secret
```
You must be logged in first.

- Optional: change API base URL when needed:
```bash
API_URL=http://localhost:3000 npm run ops -- health
```

## Auth Endpoints
- `POST /auth/login`
  - body: `{ "email": "admin@example.com", "password": "StrongPass123" }`
- `POST /auth/refresh`
  - body: `{ "refreshToken": "<token>" }`
  - terminal CLI can use the saved refresh token automatically

## Merchant Endpoints
- `POST /merchants`
  - requires bearer token
  - body: `{ "name": "...", "category": "...", "city": "...", "contactEmail": "...", "status": "Pending KYB|Active|Suspended" }`
- `GET /merchants`
  - requires bearer token
  - optional query params: `status`, `city`, `category`, `q`
- `GET /merchants/:merchantId`
  - requires bearer token
- `PATCH /merchants/:merchantId`
  - requires bearer token
  - body: any subset of merchant fields to update
- `GET /merchants/:merchantId/history`
  - requires bearer token
  - returns immutable merchant status change history

## Webhook Endpoints
- `POST /webhooks/subscriptions`
  - requires bearer token
  - body: `{ "url": "https://example.com/webhook", "secret": "shared-secret" }`
  - registers or updates a subscription

Webhook behavior:
- merchant status changes to `Active` emit `merchant.approved`
- merchant status changes to `Suspended` emit `merchant.suspended`
- payloads are signed with `X-Webhook-Signature`
- failed deliveries retry up to 3 times
- deliveries run in the background and do not block the original merchant update request

## Operator Setup
Use the CLI to create or update operators in the configured auth backend (`AUTH_STORAGE`, default `postgres`):

```bash
npm run operator:set -- --email admin@example.com --password StrongPass123 --role admin
```

- Passwords are stored as hashes, never plaintext.
- Operator creation requirements:
  - Email must be valid format
  - Password must be at least 8 characters
  - Role must be `admin` or `operator`

## Project Structure
- `src/routes` - endpoints
- `src/controllers` - request handlers
- `src/services` - business logic
- `src/middleware` - middleware
- `src/db` - database layer
- `migrations` - SQL migrations
- `tests` - automated tests
