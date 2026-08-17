# Phase 4 — Deployment (no Docker)

**Goal:** Run system in AWS Free Tier (`ap-southeast-1`); same behavior as local.

**Done when:** API + DB live; Lambda job runs on schedule; events reach SQS; Amplify frontend reachable.

**Depends on:** Phases 1–3 working locally first.

---

## Target topology

```
RDS (MySQL, UTC) — private, EB SG only
  ↑
EB single instance (NestJS API, no ALB, HTTP :80)
  ↑
API Gateway HTTP API (HTTPS proxy) ← Amplify frontend + Lambda job

Amplify Hosting (SvelteKit static, branch: main)

Lambda (Python expiry job) — EventBridge Scheduler 01:00 Asia/Colombo
  → HTTPS → API Gateway → EB → API
  → EventBridge → SQS
```

**Not used:** ALB, VPC for Lambda (cost control — see Architecture Decision #24).

**CloudFront vs API Gateway:** CloudFront was the intended HTTPS front for EB. This AWS account blocks new CloudFront distributions until Support verifies the account. API Gateway HTTP API is the workaround (TLS proxy only — not auth or throttling). See [`infra/aws/api-gateway.md`](../../infra/aws/api-gateway.md) and [`infra/aws/cloudfront-api.md`](../../infra/aws/cloudfront-api.md).

---

## Environment variables

| File                         | Purpose                                              |
| ---------------------------- | ---------------------------------------------------- |
| `backend/.env.production`    | Checklist → paste into **EB Environment properties** |
| `frontend/.env.production`   | Checklist → paste into **Amplify build env**         |
| `expiry-job/.env.production` | Checklist → paste into **Lambda env config**         |

**Runtime source of truth:** AWS (EB, Lambda, Amplify). GitHub secrets hold deploy credentials only (`AWS_ROLE_ARN`, `EB_APP_NAME`, etc.).

See [`infra/aws/`](../../infra/aws/) for step-by-step AWS setup guides.

---

## Tasks

### 4.1 Database

- [ ] RDS MySQL Free Tier, UTC, `ap-southeast-1` — see [`infra/aws/rds.md`](../../infra/aws/rds.md)
- [ ] Run migrations + seed — `migrate.yml` workflow or manual
- [ ] SG: 3306 from EB instance SG only

### 4.2 Backend

- [ ] EB **single instance** (not load balanced) — [`infra/aws/elastic-beanstalk.md`](../../infra/aws/elastic-beanstalk.md)
- [ ] Env vars from `backend/.env.production`
- [ ] HTTPS in front of EB: API Gateway HTTP API (workaround) — [`infra/aws/api-gateway.md`](../../infra/aws/api-gateway.md). Intended: CloudFront — [`infra/aws/cloudfront-api.md`](../../infra/aws/cloudfront-api.md)
- [ ] Application-layer rate limiting via `@nestjs/throttler`

### 4.3 Frontend

- [ ] Amplify Hosting from `main`, app root `frontend/` — [`infra/aws/amplify-frontend.md`](../../infra/aws/amplify-frontend.md)
- [ ] `PUBLIC_API_BASE_URL` → API Gateway HTTPS URL (`https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/api`)
- [ ] Static adapter (`@sveltejs/adapter-static`), output `build/`

### 4.4 Expiry job

- [ ] Lambda zip via `expiry-job/scripts/build-lambda.sh` — [`infra/aws/lambda-scheduler.md`](../../infra/aws/lambda-scheduler.md)
- [ ] Handler: `lambda_handler.handler`
- [ ] Env from `expiry-job/.env.production`
- [ ] Scheduler: `cron(0 1 * * ? *)`, timezone `Asia/Colombo`
- [ ] IAM: `events:PutEvents` on `compliance-events` bus only

### 4.5 Messaging

- [ ] EventBridge bus + SQS rule — [`infra/aws/setup-messaging.sh`](../../infra/aws/setup-messaging.sh)
- [ ] Verify Decision #7 payload in SQS

### 4.6 Smoke test

- [ ] Follow [`phase-4-smoke-test.md`](./phase-4-smoke-test.md)

---

## CI/CD (GitHub Actions, branch: `main`)

| Workflow             | Trigger                         | Purpose                      |
| -------------------- | ------------------------------- | ---------------------------- |
| `ci.yml`             | PR + push to `main`             | lint + test all apps         |
| `deploy-backend.yml` | push to `main`, `backend/**`    | EB deploy                    |
| `deploy-lambda.yml`  | push to `main`, `expiry-job/**` | Lambda code update           |
| `migrate.yml`        | manual `workflow_dispatch`      | migrations (+ optional seed) |

Frontend: Amplify auto-builds on push to `main`.

**GitHub configuration required:**

- Secret: `AWS_ROLE_ARN` (OIDC trust to AWS)
- Vars: `EB_APP_NAME`, `EB_ENV_NAME`, `LAMBDA_FUNCTION_NAME`
- Migration secrets: `DATABASE_*`, `JWT_SECRET`, `SEED_*` (migrate workflow only)

---

## Lambda → API (no extra AWS integration)

Lambda calls NestJS over **public HTTPS** through API Gateway (CloudFront was blocked on this account):

1. `POST /auth/login` (service account) → JWT
2. Paginated `GET /compliance-records`
3. `PATCH /compliance-records/bulk-status`

CORS does not apply (server-side client, no Origin header). Lambda does not connect to RDS.

---

## Timezone reminder

- RDS + timestamps: **UTC**
- App + Lambda + Scheduler: **`COMPLIANCE_TIMEZONE=Asia/Colombo`**
- Do not rely on server OS timezone

---

## References

- Architecture Decision #24 (EB single instance + API Gateway HTTPS proxy; CloudFront intended)
- `docs/process-flow.md` §6
- Architecture decisions #7, #12, #20
- `.env.example`, `backend/.env.production`, `frontend/.env.production`, `expiry-job/.env.production`
