# Phase 2 — Expiry Job (Python)

**Goal:** Scheduled job calls NestJS API, updates statuses, publishes lifecycle event.

**Done when:** `python src/main.py` completes against local API; tests pass; event JSON matches Decision #7.

**Depends on:** Phase 1 (`bulk-status`, service account seed, API running).

---

## Prerequisites

- Phase 1 API running on `API_BASE_URL`
- `expiry-job/.env` from `.env.example`
- Optional: LocalStack for EventBridge (or `SKIP_EVENT_PUBLISH=true` initially)

---

## Tasks

### 2.1 Scaffold

- [ ] `expiry-job/` with `src/`, `tests/`, `requirements.txt`
- [ ] Config module (env only; no secrets in code)

### 2.2 Job flow

- [ ] Login once → JWT (service account)
- [ ] Snapshot GET: `?status=active,expiring&limit=200` until all pages loaded
- [ ] Evaluate with `ZoneInfo("Asia/Colombo").date()` + buffer days
- [ ] PATCH batches only where computed status ≠ current
- [ ] Skip when computed status matches current `status` (client-side filter)

### 2.3 Reliability

- [ ] Exponential backoff + timeout on GET/PATCH/publish
- [ ] Failed PATCH batches logged; job continues
- [ ] Re-login on 401, retry that request once

### 2.4 Event publish

- [ ] One summary event per run: `runId`, `evaluationDate`, `changedRecords[]`, counts
- [ ] EventBridge publish (LocalStack locally, real AWS later)
- [ ] `SKIP_EVENT_PUBLISH=true` for core-logic-only testing

### 2.5 Tests

- [ ] Status transitions, SL date boundaries, idempotent rerun, empty/changed batches
- [ ] Mock HTTP; no live AWS in unit tests

---

## Commands

```bash
cd expiry-job
pip install -r requirements.txt
python -m pytest
python src/main.py
```

---

## Local EventBridge / SQS

| Option | Use |
|---|---|
| `SKIP_EVENT_PUBLISH=true` | Test expiry logic only |
| **LocalStack** | `AWS_ENDPOINT_URL=http://localhost:4566` — create bus + rule → SQS |
| Log to stdout | Quick dev fallback |

See `.env.example` and `docs/process-flow.md` §1.

---

## References

- Architecture decisions #7, #11, #18, #19, #20
- `docs/process-flow.md`
