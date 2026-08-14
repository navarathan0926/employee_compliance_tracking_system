# Phase 4 — Deployment (no Docker)

**Goal:** Run system in AWS Free Tier; same behavior as local.

**Done when:** API + DB live; Lambda job runs on schedule; events reach SQS; frontend reachable.

**Depends on:** Phases 1–3 working locally first.

---

## Target topology

```
RDS (MySQL, UTC)
  ↑
Elastic Beanstalk (or simple host) — NestJS API
  ↑
SvelteKit static / same host — frontend

Lambda (Python expiry job) — EventBridge Scheduler 01:00 Asia/Colombo
  → HTTPS → API
  → EventBridge → SQS
```

No Docker: EB Node platform, Lambda **zip** deploy, managed RDS.

---

## Tasks

### 4.1 Database

- [ ] RDS MySQL (Free Tier); UTC parameter group
- [ ] Run migrations; run seed (or one-time setup)
- [ ] Security group: API host only → 3306

### 4.2 Backend

- [ ] Deploy NestJS to EB (or EC2 / Railway if EB is slow to set up)
- [ ] Env vars from `backend/.env` template (no secrets in repo)
- [ ] HTTPS enabled

### 4.3 Frontend

- [ ] `npm run build`; static adapter → S3 + CloudFront, or serve from EB
- [ ] `PUBLIC_API_BASE_URL` → production API URL

### 4.4 Expiry job

- [ ] Lambda deployment package (Python)
- [ ] Env: `API_BASE_URL`, service creds, AWS region, EventBridge names
- [ ] EventBridge Scheduler: `cron(0 1 * * ? *)` timezone `Asia/Colombo`
- [ ] IAM: publish to EventBridge only (least privilege)

### 4.5 Messaging

- [ ] EventBridge custom bus (or default) + rule → SQS queue
- [ ] Verify message matches payload schema (Decision #7)

### 4.6 Smoke test

- [ ] Login via production frontend
- [ ] Trigger Lambda manually once; confirm API updates + SQS message

---

## Time savers (if blocked)

1. Deploy **Lambda + RDS + EventBridge + SQS** first (core assignment pieces)
2. Keep frontend on localhost pointing at deployed API temporarily
3. Skip EB → single small EC2 or PaaS for API

---

## Timezone reminder

- RDS + timestamps: **UTC**
- App + Lambda + Scheduler: **`COMPLIANCE_TIMEZONE=Asia/Colombo`** in env
- Do not rely on server OS timezone

---

## References

- `docs/process-flow.md` §6
- Architecture decisions #12, #20
- `.env.example`
