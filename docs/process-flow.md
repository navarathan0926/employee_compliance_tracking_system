# Process Flow

## 1. Scheduled Expiry Job Flow

```
EventBridge Scheduler (daily 01:00 Asia/Colombo)
        │  triggers
        ▼
   Lambda (Python job)
        │
        │  0. POST /auth/login  →  JWT (service account; re-login on 401 only)
        │
        │  1. GET /compliance-records?status=active,expiring&limit=200&offset=0
        │     (paginated fetches until all pages loaded — no PATCH until fetch complete)
        ▼
   In-memory snapshot (dedupe by id)
        │
        │  Evaluate each record's expiryDate vs TODAY (Sri Lanka calendar date,
        │  Asia/Colombo, captured once at run start)
        │
        │     Expiry rule (explicit):
        │       expiryDate < today (SL date)                    → expired
        │       expiryDate within buffer days of today (SL date) → expiring
        │       otherwise                                         → active
        │
        │     Buffer default: 30 days (COMPLIANCE_EXPIRING_BUFFER_DAYS)
        │
        │  2. Build {id, newStatus} only where computed status ≠ current status
        │     (skip any record where lastEvaluatedStatus already matches, idempotency)
        ▼
   Split into PATCH batches (e.g. up to 200 records per batch; configurable in Python job)
        │
        │  3. PATCH /compliance-records/bulk-status   (per batch, exponential backoff retry + timeout)
        │     newStatus may be active, expiring, or expired
        │     Failed batches: log and skip; next scheduled run repairs missed records
        ▼
   NestJS API applies the bulk update, sets lastEvaluatedStatus
        │
        │  4. Publish one summary lifecycle event for the run
        │     { runId, evaluationDate, expiringCount, expiredCount, changedRecords[], timestamp }
        ▼
   AWS EventBridge  →  routes to  →  AWS SQS queue
        │
        ▼
   (future) consumer reads from SQS — notifications, audit logging, etc.
        │     Consumer dedupes by runId to prevent duplicate alerts
```

**Note:** The job does **not** fetch `expired` records. Date corrections that heal an `expired` record are handled by the API on `PATCH` (status recalculated in the same transaction). See Architecture Decision #21.

During local development: the job is run manually (`python src/main.py`), calling the NestJS API on `localhost`, and publishing to a LocalStack-emulated EventBridge/SQS instead of real AWS.

---

## 2. Renewal Flow (Manual, via API or Dashboard)

```
User (via dashboard or API call)
        │
        │  POST /compliance-records/:id/renew
        │  Body: { issuedDate, expiryDate, notes? }
        ▼
   NestJS API — single transaction:
        │
        ├── 1. Validate: source record exists and is not already renewed/archived
        ├── 2. Create new ComplianceRecord
        │        employeeId:     same as source record
        │        type:           same as source record
        │        issuedDate:     from request body
        │        expiryDate:     from request body
        │        status:         computed from dates (active/expiring/expired)
        │        renewedFromId:  id of source record  ← links the history chain
        │
        └── 3. Mark source record as renewed
                 status:     renewed
                 deletedAt:  now (UTC)
        │
        ▼
   Returns: new ComplianceRecord (with renewedFromId set)
```

The `renewedFromId` field on the new record points to the record it replaced. Walking `renewedFromId` backwards reconstructs the full renewal history for a compliance item.

`PATCH /compliance-records/:id` is for field corrections (typos, data-entry errors) only. Renewals must go through `POST /compliance-records/:id/renew`. When `issuedDate` or `expiryDate` is corrected via PATCH, status is recalculated in the same transaction.

---

## 3. Manual CRUD Flow (Employees and Records)

```
User (via SvelteKit dashboard, or direct API call)
        │
        ▼
   NestJS API  (JWT-authenticated, short-lived token, no refresh)
        │
        ├── Create/list/retrieve compliance records
        ├── Create/list/retrieve employees
        ├── Correct a record's fields (PATCH /compliance-records/:id)
        │      → recalculates status if dates change
        ├── Renew a record (POST /compliance-records/:id/renew)
        ├── Archive a single record (DELETE /compliance-records/:id)
        └── Archive an employee (DELETE /employees/:id)
               → cascades: all employee's ComplianceRecord rows are also archived
               → runs in a single transaction
        │
        ▼
   MySQL (via TypeORM)
```

---

## 4. Employee Archive Cascade

```
DELETE /employees/:id
        │
        ▼
   NestJS — single transaction:
        ├── SET Employee.deletedAt = NOW(), WHERE id = :id
        └── SET ComplianceRecord.deletedAt = NOW(),
                ComplianceRecord.status = 'archived'
            WHERE employeeId = :id AND deletedAt IS NULL
        │
        ▼
   Returns: 204 No Content
```

Neither the employee row nor the compliance records are hard-deleted. `renewed` and `archived` records are excluded from all default list queries and from the expiry job's evaluation scan.

---

## 5. Dashboard Flow

```
SvelteKit frontend
        │  GET /dashboard/metrics
        │  GET /dashboard/expiring?days=30
        ▼
   NestJS API computes metrics live (no pre-aggregation table)
   Uses Sri Lanka calendar date (Asia/Colombo) for "today" and date ranges
   renewed and archived records excluded from all metric counts
        ▼
   Returned to frontend, rendered as metric cards + filtered table
```

---

## 6. Deployment Topology (once deployed, not local-only)

```
AWS Elastic Beanstalk
  ├── NestJS API
  └── SvelteKit frontend (or served separately, e.g. static hosting)

AWS RDS (MySQL, UTC timezone for timestamps)  ← used by NestJS API only

AWS Lambda (Python job)  ← triggered by EventBridge Scheduler (01:00 Asia/Colombo daily)
  → calls NestJS API over HTTPS
  → publishes to EventBridge → SQS
```
