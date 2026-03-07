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

## Project Structure
- `src/routes` - endpoints
- `src/controllers` - request handlers
- `src/services` - business logic
- `src/middleware` - middleware
- `src/db` - database layer
- `migrations` - SQL migrations
- `tests` - automated tests
