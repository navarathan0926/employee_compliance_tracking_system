# Implementation Phases

Tight-timeline plan (no Docker). Local MySQL; deploy later without containers.

| Phase | Doc | Deliverable |
|---|---|---|
| **1** | [phase-1-backend-api.md](./phase-1-backend-api.md) | NestJS API: auth, CRUD, renewal, bulk-status, dashboard endpoints |
| **2** | [phase-2-expiry-job.md](./phase-2-expiry-job.md) | Python job: evaluate → PATCH → EventBridge event |
| **3** | [phase-3-dashboard-frontend.md](./phase-3-dashboard-frontend.md) | SvelteKit login + dashboard UI |
| **4** | [phase-4-deployment.md](./phase-4-deployment.md) | AWS: RDS, Lambda, EventBridge, SQS, API + frontend host |

**Order:** 1 → 2 → 3 → 4 (each phase testable before the next).

**Before Phase 1:**
- Copy `.env.example` → `backend/.env` (and later `expiry-job/.env`, `frontend/.env`)
- MySQL running locally (UTC for timestamps; business dates use `Asia/Colombo` in app code)
- Read `docs/architecture-decisions.md` if anything is unclear

**Out of scope for now:** Docker, S3 attachments, notification consumer, RBAC.
