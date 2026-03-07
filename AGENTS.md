# AGENTS.md

## Mission
Build a production-ready backend CRM engine for merchant onboarding and KYB lifecycle management.

## Required Stack (Do Not Substitute)
- Node.js `>=20`
- Express `4.x`
- PostgreSQL `>=15`
- JWT for authentication
- Joi or Zod for input validation
- Jest + Supertest for testing

## Domain Rules
### Merchant statuses
- `Pending KYB`
- `Active`
- `Suspended`

### Status transitions
- Only valid lifecycle transitions are allowed.
- Invalid transitions must be rejected with clear error messages.
- Transition to `Active` is only allowed if all required KYB documents are present and verified:
  - Proof of business registration
  - Owner identity document
  - Bank account proof

## Functional Requirements
### Authentication and session security
- Support operator login via email and password.
- Issue secure access token on login.
- Access token expiry must be 15 minutes.
- Provide refresh-token flow without re-login.
- Apply temporary lockout after repeated failed login attempts.

### Merchant management
- Create merchant records (name, category, city, contact email, etc.).
- Get full details of a single merchant.
- List merchants with filtering/search (for example status and city).
- Update merchant details.

### KYB workflow
- Record uploaded documents per merchant.
- Mark individual documents as verified.
- Enforce status-transition and KYB eligibility logic.
- Return clear business-rule/validation errors.

### Immutable status history
- Persist every status change with:
  - previous status
  - new status
  - operator id/user
  - timestamp
- History must be immutable (no update/delete operations).
- Expose endpoint to retrieve full history by merchant.

### Webhooks
- Allow external systems to register webhook URLs.
- Notify all subscribers when status changes to `Active` or `Suspended`.
- Sign webhook payloads with a shared secret signature.
- Retry failed deliveries up to 3 times.
- Deliver webhooks asynchronously (must not block primary request path).

## Security Requirements
- Store passwords as secure hashes only.
- Validate all incoming data before processing.
- Keep sensitive config in environment variables only.
- Restrict merchant deletion and pricing-tier changes to admin operators only.

## Required Project Structure
- `src/routes/` for endpoint definitions
- `src/controllers/` for request handlers
- `src/services/` for business logic (KYB and webhooks)
- `src/middleware/` for auth/error middleware
- `src/db/` for database access layer
- `migrations/` for SQL migrations
- `tests/` for automated tests
- `.env.example` listing all required env vars with dummy values
- `README.md` with setup and run instructions

## Non-Functional Constraints
- Code should be production-oriented and maintainable.
- Error handling must be explicit and clear.
- Do not integrate real payment systems or live external services.

## Delivery Expectations
- Keep meaningful commit history.
- Ensure README setup/run instructions are complete.
- Ensure `.env.example` includes all required settings.
