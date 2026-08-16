# Phase 2 — Expiry Job (Python)



**Goal:** Scheduled job calls NestJS API, updates statuses, publishes lifecycle event.



**Done when:** `python src/main.py` completes against local API; tests pass; event JSON matches Decision #7.



**Depends on:** Phase 1 (`bulk-status`, service account seed, API running).



**Status:** Complete for local development (Lambda/real AWS deployment is Phase 4).



---



## Prerequisites



- Phase 1 API running on `API_BASE_URL`

- `expiry-job/.env` from `expiry-job/.env.example`

- Optional: LocalStack for EventBridge (or `SKIP_EVENT_PUBLISH=true` initially)



---



## Tasks



### 2.1 Scaffold



- [x] `expiry-job/` with `src/`, `tests/`, `requirements.txt`

- [x] Config module (env only; no secrets in code)



### 2.2 Job flow



- [x] Login once → JWT (service account)

- [x] Snapshot GET: `?status=active,expiring&limit=200` until all pages loaded

- [x] Evaluate with `ZoneInfo("Asia/Colombo").date()` + buffer days

- [x] PATCH batches only where computed status ≠ current

- [x] Skip when computed status matches current `status` (client-side filter)



### 2.3 Reliability



- [x] Exponential backoff + timeout on GET/PATCH/publish

- [x] Failed PATCH batches logged; job continues

- [x] Re-login on 401, retry that request once



### 2.4 Event publish



- [x] One summary event per run: `runId`, `evaluationDate`, `changedRecords[]`, counts

- [x] EventBridge publish (LocalStack locally, real AWS later)

- [x] `SKIP_EVENT_PUBLISH=true` for core-logic-only testing



### 2.5 Tests



- [x] Status transitions, SL date boundaries, idempotent rerun, empty/changed batches

- [x] Mock HTTP; no live AWS in unit tests



### 2.6 Local infra bootstrap



- [x] `scripts/bootstrap_localstack.py` — idempotent bus/queue/rule setup

- [x] `LOCAL-AWS-TESTING.md` — step-by-step LocalStack guide



---



## Commands



```bash

cd expiry-job

pip install -r requirements.txt

python -m pytest

python scripts/bootstrap_localstack.py   # after LocalStack is up

python src/main.py

```



---



## Local EventBridge / SQS



| Option | Use |

|---|---|

| `SKIP_EVENT_PUBLISH=true` | Test expiry logic only |

| **LocalStack** | `AWS_ENDPOINT_URL=http://localhost:4566` — run bootstrap script or manual CLI |

| Log to stdout | Quick dev fallback |



Step-by-step local setup and verification: **`expiry-job/LOCAL-AWS-TESTING.md`**



See also `expiry-job/.env.example` and `docs/process-flow.md` §1.



---



## References



- Architecture decisions #7, #11, #18, #19, #20

- `docs/process-flow.md`

