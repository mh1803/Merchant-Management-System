# Merchant Management System

Backend CRM engine for merchant onboarding and KYB lifecycle management.

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

## Scripts
- `npm run dev` - run server with watch mode
- `npm start` - run server
- `npm run db:migrate` - apply SQL migrations
- `npm test` - run tests
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
