# Process Flow

## 1. Scheduled Expiry Job Flow

```
EventBridge Scheduler (time-based rule)
        │  triggers
        ▼
   Lambda (Python job)
        │
        │  1. GET /compliance-records?status=active,expiring   (NestJS API, over HTTP)
        ▼
   Evaluate each record's expiryDate vs today
        │
        │  2. Determine batches of {id, newStatus} for records that changed
        │     (skip any record where lastEvaluatedStatus already matches, idempotency check)
        ▼
   Split into batches (e.g. 500 records per batch)
        │
        │  3. PATCH /compliance-records/bulk-status   (per batch, with retry + backoff + timeout)
        ▼
   NestJS API applies the bulk update, sets lastEvaluatedStatus
        │
        │  4. Publish one summary event for the run
        │     e.g. { runId, expiringCount, expiredCount, timestamp }
        ▼
   AWS EventBridge  →  routes to  →  AWS SQS queue
        │
        ▼
   (future) consumer reads from SQS — notifications, audit logging, etc.
```

During local development: the job is run manually (`python src/main.py`), calling the NestJS API on `localhost`, and publishing to a LocalStack-emulated EventBridge/SQS instead of real AWS.

## 2. Manual CRUD Flow (via API or dashboard)

```
User (via SvelteKit dashboard, or direct API call)
        │
        ▼
   NestJS API  (JWT-authenticated)
        │
        ├── Create/update/list compliance records
        ├── Create/update/list employees
        └── Archive a record (soft delete) — manual only, never done by the expiry job
        │
        ▼
   MySQL (via TypeORM)
```

## 3. Dashboard Flow

```
SvelteKit frontend
        │  GET /dashboard/metrics
        │  GET /dashboard/expiring?days=30
        ▼
   NestJS API computes metrics live (no pre-aggregation table)
        ▼
   Returned to frontend, rendered as metric cards + filtered table
```

## 4. Deployment Topology (once deployed, not local-only)

```
AWS Elastic Beanstalk
  ├── NestJS API
  └── SvelteKit frontend (or served separately, e.g. static hosting)

AWS RDS (MySQL)  ← used by NestJS API only

AWS Lambda (Python job)  ← triggered by EventBridge Scheduler
  → calls NestJS API over HTTPS
  → publishes to EventBridge → SQS
```
