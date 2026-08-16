# Phase 1 — Backend API



**Goal:** Complete NestJS API per `docs/api-doc.md` and `docs/db-schema.md`.



**Done when:** All endpoints work via Postman/e2e tests; seed creates admin + service account; migrations applied.



---



## Prerequisites



- Node.js LTS, MySQL installed locally

- Create DB: `compliance_tracking` (or name from `.env`)

- Create e2e DB: `compliance_tracking_e2e` (or `E2E_DATABASE_NAME` from `.env`; created automatically on first `npm run test:e2e` if MySQL user can create databases)

- `backend/.env` from `.env.example` (DB, JWT, seed creds, `COMPLIANCE_TIMEZONE=Asia/Colombo`)



---



## Tasks



### 1.1 Scaffold



- [x] `nest new backend` (or manual scaffold) under `backend/`

- [x] TypeORM + MySQL; `timezone: 'Z'`; **migrations** (avoid `synchronize` in shared/prod)

- [x] Global prefix `/api`; config module reading env



### 1.2 Entities & migrations



- [x] `Employee`, `ComplianceRecord`, `User` per `docs/db-schema.md`

- [x] Indexes from `docs/performance.md`

- [x] Shared **status helper**: `Asia/Colombo` today + `COMPLIANCE_EXPIRING_BUFFER_DAYS`



### 1.3 Seed



- [x] `npm run seed` — admin user + expiry-job service account (env creds, bcrypt)



### 1.4 Auth (Passport)



- [x] `LocalStrategy` + `JwtStrategy`; `POST /auth/login`

- [x] `JwtAuthGuard` on all routes except login



### 1.5 Employees



- [x] CRUD + soft delete with cascade to compliance records (`archived`)



### 1.6 Compliance records



- [x] CRUD, filters, pagination (max 200), multi-status `?status=active,expiring`

- [x] POST/PATCH recalculate `status` on date changes

- [x] `POST /compliance-records/:id/renew` (old → `renewed`, new + `renewedFromId`)

- [x] `PATCH /compliance-records/bulk-status` (job: `active`|`expiring`|`expired`, idempotent)



### 1.7 Dashboard endpoints (same phase — small)



- [x] `GET /dashboard/metrics` (+ optional breakdown flags)

- [x] `GET /dashboard/expiring` (`days` or `from`/`to`)



### 1.8 Tests



- [x] Validation, status transitions, renewal, cascade, bulk-status idempotency, dashboard counts

- [x] E2e uses isolated `E2E_DATABASE_NAME` (not dev DB); migrations + seed run before suite



### 1.9 Logging



- [x] HTTP request logging to console (`method`, `url`, `status`, duration)

- [x] Bootstrap logs API base URL and Swagger URL (non-production)



---



## Commands (expected)



```bash

cd backend

npm install

npm run migration:run   # or project-specific migration command

npm run seed

npm run start:dev

npm run test

npm run test:e2e

```



---



## References



- `docs/api-doc.md`, `docs/db-schema.md`, `docs/security.md`

- Architecture decisions #6, #14, #15, #17, #21

