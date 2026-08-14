# Phase 1 — Backend API

**Goal:** Complete NestJS API per `docs/api-doc.md` and `docs/db-schema.md`.

**Done when:** All endpoints work via Postman/e2e tests; seed creates admin + service account; migrations applied.

---

## Prerequisites

- Node.js LTS, MySQL installed locally
- Create DB: `compliance_tracking` (or name from `.env`)
- `backend/.env` from `.env.example` (DB, JWT, seed creds, `COMPLIANCE_TIMEZONE=Asia/Colombo`)

---

## Tasks

### 1.1 Scaffold

- [ ] `nest new backend` (or manual scaffold) under `backend/`
- [ ] TypeORM + MySQL; `timezone: 'Z'`; **migrations** (avoid `synchronize` in shared/prod)
- [ ] Global prefix `/api`; config module reading env

### 1.2 Entities & migrations

- [ ] `Employee`, `ComplianceRecord`, `User` per `docs/db-schema.md`
- [ ] Indexes from `docs/performance.md`
- [ ] Shared **status helper**: `Asia/Colombo` today + `COMPLIANCE_EXPIRING_BUFFER_DAYS`

### 1.3 Seed

- [ ] `npm run seed` — admin user + expiry-job service account (env creds, bcrypt)

### 1.4 Auth (Passport)

- [ ] `LocalStrategy` + `JwtStrategy`; `POST /auth/login`
- [ ] `JwtAuthGuard` on all routes except login

### 1.5 Employees

- [ ] CRUD + soft delete with cascade to compliance records (`archived`)

### 1.6 Compliance records

- [ ] CRUD, filters, pagination (max 200), multi-status `?status=active,expiring`
- [ ] POST/PATCH recalculate `status` + `lastEvaluatedStatus` on date changes
- [ ] `POST /compliance-records/:id/renew` (old → `renewed`, new + `renewedFromId`)
- [ ] `PATCH /compliance-records/bulk-status` (job: `active`|`expiring`|`expired`, idempotent)

### 1.7 Dashboard endpoints (same phase — small)

- [ ] `GET /dashboard/metrics` (+ optional breakdown flags)
- [ ] `GET /dashboard/expiring` (`days` or `from`/`to`)

### 1.8 Tests

- [ ] Validation, status transitions, renewal, cascade, bulk-status idempotency, dashboard counts

---

## Commands (expected)

```bash
cd backend
npm install
npm run migration:run   # or project-specific migration command
npm run seed
npm run start:dev
npm run test
```

---

## References

- `docs/api-doc.md`, `docs/db-schema.md`, `docs/security.md`
- Architecture decisions #6, #14, #15, #17, #21
