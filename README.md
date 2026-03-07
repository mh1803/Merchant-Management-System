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

3. Start development server:
```bash
npm run dev
```

## Scripts
- `npm run dev` - run server with watch mode
- `npm start` - run server
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
After creating/updating an operator, restart the server so the new operator is loaded.

- Login:
```bash
npm run ops -- login admin@example.com StrongPass123
```

- Refresh:
```bash
npm run ops -- refresh <refreshToken>
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

## Operator Setup (File-Based)
Use the CLI to create or update operators in `data/operators.json`:

```bash
npm run operator:set -- --email admin@example.com --password StrongPass123 --role admin
```

- Passwords are stored as hashes, never plaintext.
- On server start, operators are loaded from `OPERATORS_FILE` (`data/operators.json` by default).
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
