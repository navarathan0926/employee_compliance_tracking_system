# Security

This document records the security posture, controls, and conventions for the Employee Compliance Tracking System.

---

## 1. Authentication

- **Mechanism:** Username/password login issues a short-lived JWT (`accessToken`). No refresh token endpoint exists. When a token expires, the user must log in again.
- **Implementation:** [Passport.js](https://www.passportjs.org/) via NestJS:
  - `passport-local` + `LocalStrategy` — credential check on `POST /auth/login`
  - `passport-jwt` + `JwtStrategy` — Bearer token validation on protected routes
  - `@nestjs/jwt` — token signing and verification
  - Protected controllers use `JwtAuthGuard` (and `@UseGuards(JwtAuthGuard)`)
- **Why no refresh token:** A refresh token that can be exchanged for new access tokens effectively extends the compromise window. Short-lived tokens with forced re-login minimise the blast radius of a stolen token.
- **Token validation:** Every protected endpoint validates the JWT signature and expiry on each request. Expired or tampered tokens are rejected with `401 Unauthorized`.
- **Password storage:** Passwords are stored as bcrypt hashes (never plaintext). Work factor configured via `BCRYPT_ROUNDS` (default 12) in `.env.example`.

---

## 2. Authorization

- **Per-request checks:** Because integer primary keys are incrementally guessable, every endpoint that operates on a specific resource (`/employees/:id`, `/compliance-records/:id`) must verify that the requesting user is permitted to access that resource. No endpoint may rely on "ID is hard to guess" as a security control.
- **Current model:** Single-role (all authenticated users have the same access). If role-based access control is added later, this section must be updated and guards refactored.

---

## 3. Input Validation

- All incoming request bodies are validated via NestJS DTOs backed by `class-validator`. Requests that fail validation are rejected with `400 Bad Request` before reaching service or database layer.
- **Date ordering:** `expiryDate` must be strictly after `issuedDate`; this is validated at the DTO level.
- **Status recalculation:** When `issuedDate` or `expiryDate` is updated via PATCH, status is recalculated server-side; clients cannot set `status` directly.
- **Enum fields:** `type` and `status` fields only accept values from their defined enums; arbitrary strings are rejected.
- **Pagination bounds:** `limit` is capped at 200; requests above that are rejected with `400 Bad Request`. `offset` must be a non-negative integer.
- **Renewal target:** The `POST /compliance-records/:id/renew` endpoint validates that the source record is not already `renewed` or `archived` before proceeding.

---

## 4. SQL Injection Prevention

- TypeORM uses parameterized queries (prepared statements) for all database operations. Raw SQL strings with user-supplied input are prohibited.
- If raw query builder calls (`createQueryBuilder`) are used, bind parameters (`:param`) must be used — never string interpolation into the query template.

---

## 5. Secrets and Configuration

- No secrets, credentials, AWS account IDs, ARNs, or region values are committed to the repository.
- All required configuration is documented in `.env.example` with placeholder values only.
- The running application reads configuration from environment variables at startup. Hardcoded defaults for secrets (e.g. a fallback JWT secret) are prohibited.
- The JWT secret must be a randomly generated, high-entropy string; its minimum length and generation method should be documented in `.env.example` comments.

---

## 6. AWS Resource Security

- AWS resource names, ARNs, account IDs, and region values are never hardcoded in source code. They are injected via environment variables.
- IAM permissions for the Lambda (Python job) follow the principle of least privilege: only the permissions needed to call the NestJS API over HTTPS and to publish to the specific SQS queue / EventBridge bus.
- Free Tier usage must not require permissions that would grant the Lambda direct database access.

---

## 7. Soft Delete and Audit Trail

- Archived and renewed records (`deletedAt` non-null) are excluded from all default list queries and from the expiry job's evaluation scan. They remain in the database permanently for audit purposes.
- Archived and renewed records are still retrievable via `GET /compliance-records/:id` (single-record fetch) to support audit views.
- The renewal history chain (`renewedFromId`) is an append-only record: once a link is written, it is never modified. This makes the compliance timeline tamper-evident at the application level.
- Hard delete is not exposed via the API. Correcting genuine data-entry errors requires direct database access, which must be logged externally (e.g. RDS audit logs or a change-management ticket).

---

## 8. Transport Security

- All production traffic uses HTTPS. The NestJS API must not serve HTTP in production.
- The Python job communicates with the NestJS API over HTTPS only. No plaintext HTTP allowed in non-local environments.
- CORS: The NestJS API should configure an explicit `allowedOrigins` list (via environment variable) rather than allowing `*`. In local development `localhost` origins are permitted; in production only the deployed frontend origin is allowed.

---

## 9. Expiry Job Access

- The bulk-status update endpoint (`PATCH /compliance-records/bulk-status`) is a protected endpoint requiring a valid JWT, the same as all other API endpoints.
- The Python job obtains its JWT by calling `POST /auth/login` with a dedicated service-account username/password (not a human user's credentials). The service account credentials are stored in environment variables, never in source code.
- The job logs in **once** at run start and reuses the JWT for all requests. On `401 Unauthorized`, it re-logins and retries **that same request once**, then continues — it does not restart the run from page 0.
- **No permanent API token** and no unauthenticated bypass for the job. See Architecture Decision #19.
- `PATCH /compliance-records/bulk-status` enforces that `newStatus` can only be `active`, `expiring`, or `expired`, preventing the job from accidentally setting `renewed`, `archived`, or other states. `renewed`, `archived`, or missing record IDs in a batch are skipped without failing the entire batch.

---

## 10. Dependency and Vulnerability Management

- Pin dependency versions in `package.json` (backend, frontend) and `requirements.txt` (Python job). Avoid open ranges (`*`, `>=`) in production dependencies.
- Regularly audit dependencies: `npm audit` (Node), `pip-audit` or `safety` (Python). Address critical/high severity findings before deploying.
- Keep the Node.js and Python runtime versions pinned in deployment config (Elastic Beanstalk platform version, Lambda runtime) to avoid unexpected runtime upgrades.
