# Architecture Decisions

This document records the key architecture decisions for the Employee Compliance Tracking System, along with the reasoning behind each.

## 1. Record ID Strategy: Incremental Integer

**Decision:** Auto-incrementing integer primary keys for `ComplianceRecord`, `Employee`, and `User`.

**Reasoning:** The NestJS API is the single writer (multiple replicas share one database, still one logical writer), so UUID's original justification (avoiding ID collisions across independent writers) doesn't apply. The leak-resistance concern (guessable IDs) is mitigated by proper per-request authorization checks, which are required regardless of ID scheme. Given that, incremental IDs are the simpler, faster choice (smaller index size, faster joins) with no real downside at this scale. UUIDs would only become worthwhile if a second service gained direct write access to the database, or the system became distributed/sharded.

## 2. Database: MySQL on AWS RDS Free Tier

**Decision:** MySQL, hosted on AWS RDS Free Tier.

**Reasoning:** RDS Free Tier supports MySQL directly. EventBridge and SQS are independent of the database engine, so there's no compatibility concern with the messaging services used elsewhere.

## 3. ORM: TypeORM

**Decision:** TypeORM for the NestJS backend.

**Reasoning:** First-class NestJS support, decorator-based entities matching Nest's style, integrates cleanly with MySQL.

## 4. Python Job: Deployment Strategy

**Decision:** The Python expiry job calls the NestJS API over HTTP rather than connecting to MySQL directly. It runs locally as a script during development, and is deployed later as an AWS Lambda triggered by EventBridge Scheduler.

**Reasoning:**
- Keeps the NestJS API as the single writer to the database, avoiding validation logic drifting out of sync across two codebases.
- Avoids Lambda-to-RDS VPC networking complexity.
- The job's core logic is deployment-agnostic, the same code runs as a local script or a Lambda invocation.

## 5. Employee Data Model

**Decision:** `Employee` is a separate entity from `ComplianceRecord`, sharing a NestJS module with separate services and files per entity.

**Reasoning:** Employees have their own identity and attributes independent of any single compliance record; one employee has many records. Sharing a module keeps the codebase simple at the current scope while separate services keep the two domains' logic distinct.

## 6. Authentication

**Decision:** Username/password login issuing a short-lived JWT, implemented with **Passport.js** via NestJS integrations:
- **`@nestjs/passport` + `passport-local`** — validates credentials on `POST /auth/login` (LocalStrategy).
- **`@nestjs/jwt` + `passport-jwt`** — validates the Bearer token on protected routes (JwtStrategy); exposed as a NestJS `JwtAuthGuard` on controllers.

No refresh token mechanism: when a token expires, the client logs in again. No broader user-management system (no roles, registration, or multi-tenant flows). No permanent API tokens — all clients, including the Python expiry job, use the same login → JWT flow (see Decision #19 for job-specific behaviour).

**Initial admin user:** The first (default admin) login user is created via a seed script (`npm run seed` or equivalent), not a manual DB insert. A separate **service account** user (for the expiry job) is also seeded. Credentials come from environment variables documented in `.env.example`.

**Reasoning:** Passport is the standard NestJS auth stack — well-documented, strategy-based, and easy to extend later (e.g. add a role guard) without changing the login flow. A short-lived JWT with no refresh token is the simplest safe default: a compromised token has a bounded lifetime. Re-login on expiry is acceptable for an internal dashboard and a short scheduled job.

## 7. Messaging: AWS EventBridge + SQS

**Decision:** After each scheduled run, the expiry job publishes **one summary lifecycle event** (not one event per record) to EventBridge, which routes it to SQS. A notification consumer (email, Slack, etc.) is **out of scope** for the initial deliverable — publishing to the queue satisfies the requirement to "dispatch lifecycle events."

**Why summary, not per-record:** Fewer messages, simpler Free Tier usage, and one run-level audit entry. The summary includes the IDs that actually changed so a future consumer can still act per record without re-querying the API.

**Event payload schema:**
```json
{
  "eventType": "compliance.expiry-evaluation.completed",
  "runId": "uuid-v4",
  "evaluationDate": "2026-08-14",
  "timezone": "Asia/Colombo",
  "expiringCount": 3,
  "expiredCount": 2,
  "changedRecords": [
    { "id": 101, "previousStatus": "active", "newStatus": "expiring" },
    { "id": 205, "previousStatus": "expiring", "newStatus": "expired" }
  ],
  "timestamp": "2026-08-14T01:00:05+05:30"
}
```

- `runId`: unique per job execution (UUID v4).
- `evaluationDate`: the Sri Lanka calendar date used for all expiry comparisons in that run.
- `changedRecords`: only records whose status actually changed in this run (empty array if nothing changed).
- Publish **once per successful run**, after all PATCH batches complete.
- **Publish failure after PATCH:** the job writes the payload to a pending file (`PENDING_EVENT_PATH`, or a temp-dir default) and exits non-zero. The next run republishes that payload with the **same `runId`** before starting a new evaluation, then deletes the file. Consumers already ignore a duplicate `runId`.

**Alert idempotency (consumer-side):** Record-level idempotency is handled by skip-if-unchanged logic in the API and expiry job (computed status vs current `status`). For duplicate alerts within the same evaluation window, the consumer deduplicates using `runId` (ignore a second message with the same `runId`) or by tracking `(evaluationDate, recordId, newStatus)` pairs already notified.

**Reasoning:** Decouples "detecting expiries" from "reacting to them." The job's responsibility is detection and status update; anything that needs to react can consume from the queue independently.

**Testing approach:** Tested locally first (e.g. via LocalStack) before wiring up the real AWS SQS queue and EventBridge rule.

## 8. Status Lifecycle: No Auto-Archive on Expiry

**Decision:** The expiry job only ever changes a record's `status` field (active → expiring → expired). It never archives or soft-deletes records. Archiving/soft-delete is a separate, manual action available only through the CRUD API (e.g. when an employee leaves, or a record was entered in error).

**Reasoning:** "Expired" and "archived" are different concerns — expired means the compliance item has lapsed and needs attention, archived means the record itself is no longer relevant to track. Conflating the two would hide expired-but-still-relevant records from normal views.

## 9. Soft Delete vs Hard Delete

**Decision:** Soft delete (`deletedAt` timestamp / `status: archived`) as the default for manual archiving. Hard delete reserved only for correcting genuine data-entry errors, performed directly in the database, not exposed via the API.

**Reasoning:** Compliance records may need to be referenced later for audits or legal purposes even after they're no longer active.

## 10. Dashboard Reporting Strategy: Live-Computed

**Decision:** Dashboard metrics are computed live on each request rather than pre-aggregated into a separate table.

**Reasoning:** At the current data volume, live queries are simple and always consistent. A pre-aggregated table would reduce query-time cost but adds staleness risk and sync complexity not justified at this scale.

## 11. Bulk Processing, Batching, Retries, Idempotency

**Decision:**
- The expiry job **fetches** all non-archived `active`/`expiring` records via paginated `GET /compliance-records` calls, then **updates** via `PATCH /compliance-records/bulk-status` — not one record at a time.
- **Fetch phase:** paginate with `limit=200` (the API maximum; configurable constant in the Python job, must not exceed 200) and increment `offset` until all pages are loaded into an in-memory snapshot. **No PATCH calls during the fetch loop** — all reads complete before any write (see Decision #18).
- **Write phase:** split status updates into PATCH batches (e.g. up to 200 records per request; configurable constant in the Python job) rather than a single unbounded request.
- **Evaluation date:** capture `today` as the current **Sri Lanka calendar date** (`Asia/Colombo`) once at the start of the run and use it for every record evaluation (see Decision #17).
- Each external call (GET, PATCH, EventBridge publish) is wrapped with **exponential backoff retry** (e.g. 1s, 2s, 4s) and a **request timeout**. Failed PATCH batches are logged and skipped rather than aborting the entire job; the next scheduled run repairs missed records.
- **Idempotency (record level):** before sending a PATCH batch, skip records where the computed `newStatus` already matches the record's current `status`. The API also skips records whose current `status` already matches `newStatus`. Reruns and retried requests do not double-update.
- **Idempotency (event level):** one summary event per run with a unique `runId`; consumer deduplicates by `runId` or `(evaluationDate, recordId, newStatus)` (see Decision #7).

**Reasoning:** Bulk PATCH reduces API round trips. Snapshot-first fetch avoids the offset-pagination skip bug that occurs when status updates happen between paginated GETs. Exponential backoff handles transient network/timeout issues without a separate background worker. Idempotency makes reruns and partial failures safe.

## 12. Deployment Targets

**Decision:** NestJS API and SvelteKit frontend deployed on AWS Elastic Beanstalk. Python job deployed as an AWS Lambda, triggered by EventBridge Scheduler on a time-based rule (not a request-driven trigger).

**Reasoning:** Elastic Beanstalk handles deployment, scaling, and server management for the always-on API/frontend, avoiding manual EC2 management. Lambda is the natural serverless fit for a short scheduled task — no server to maintain, fits Free Tier well, and pairs directly with EventBridge Scheduler.

## 13. File Attachments (S3)

**Decision:** Not implemented for now. A `notes` text field satisfies the "supporting documentation or notes" need. S3 file upload is deferred, to be revisited later if time allows.

## 14. Renewal Flow: New Record + Mark Old as Renewed

**Decision:** When a compliance item is renewed, a **new** `ComplianceRecord` is created with the updated `issuedDate` and `expiryDate`. The old record is marked **`renewed`** (soft delete: `deletedAt` set, `status` set to `renewed`). The new record carries a `renewedFromId` field (nullable integer FK → `ComplianceRecord.id`) pointing to the record it replaced. Initial status on the new record is computed from its dates (see Decision #21).

**Requirement mapping:** The assignment lists `renewed` as a status value. Using `renewed` on the superseded record (not `archived`) preserves that semantics. `archived` is reserved for manual soft-delete and employee cascade only.

**Reasoning:**
- Updating a record in place destroys the historical timeline — you lose what the original expiry date was before renewal.
- A new-record approach preserves a full, traceable audit chain: you can walk `renewedFromId` links to reconstruct the entire compliance history for an item.
- Separating `renewed` from `archived` makes audit queries clearer (superseded vs manually removed).

**API surface:** A dedicated `POST /compliance-records/:id/renew` endpoint handles this atomically — it creates the new record, marks the old one as `renewed`, and returns the new record. `PATCH /compliance-records/:id` is reserved for correcting fields on a record (e.g. fixing a typo), not for performing renewals.

## 15. Employee Soft-Delete Cascade

**Decision:** When an `Employee` is soft-deleted (archived), all of that employee's associated `ComplianceRecord` rows are also soft-deleted in the same operation (`deletedAt` set, `status` set to `archived`). Neither the employee nor their records are hard-deleted.

**Reasoning:**
- Compliance records for a departed employee remain relevant for audits; hard-deleting them would violate the audit trail principle.
- Soft-deleting records independently of their employee would leave orphaned "active" records in the system, distorting metrics and expiry reports.
- Cascading at the service layer (rather than a DB cascade) keeps the logic explicit, testable, and visible — it's a deliberate business action, not an implicit side effect.

**Implementation note:** The cascade is performed in a single transaction: archive the employee row, then bulk-archive all their compliance records. If the transaction fails, neither change persists.

## 16. Pagination Strategy: Limit/Offset

**Decision:** All list endpoints (`GET /employees`, `GET /compliance-records`) support limit/offset pagination via `?limit=` and `?offset=` query parameters. Default limit: 50. Maximum enforced limit: 200.

**Reasoning:**
- TypeORM's `skip`/`take` options map directly to SQL `LIMIT`/`OFFSET`, so limit/offset pagination requires no extra infrastructure.
- Cursor-based pagination is more resilient to insertions mid-page, but requires a stable, unique sort cursor and adds implementation complexity that isn't justified at this scale or use case (compliance dashboards are not infinite-scroll UIs).
- Enforcing a maximum limit prevents accidental full-table scans from unbounded API calls.

**Response envelope:** Paginated list responses include `{ data: [...], total: number, limit: number, offset: number }` so the client can compute page counts without a separate count call.

**Client usage:**
- **Dashboard UI:** uses limit/offset for interactive paging (page numbers, `total` count).
- **Python expiry job:** uses the same limit/offset API but with a **snapshot-first** pattern — paginate until all pages are loaded, then evaluate and PATCH (see Decision #18). The job does not PATCH between GET pages.

## 17. Timezone and Date Column Strategy

**Decision:**
- All timestamp columns (`createdAt`, `updatedAt`, `deletedAt`) are stored in **UTC**.
- `issuedDate` and `expiryDate` are stored as plain **DATE** columns (no time component), because they represent calendar dates, not moments in time.
- **Business timezone:** Sri Lanka (`Asia/Colombo`, UTC+5:30). The expiry job, dashboard date filters, and status computation all use the current **Sri Lanka calendar date** as `today`.
- Expiring-soon buffer: default **30 days**, configurable via `COMPLIANCE_EXPIRING_BUFFER_DAYS`.

**Reasoning:**
- Storing timestamps in UTC is the standard baseline; the application layer converts to the user's local timezone for display if needed.
- Using DATE (not DATETIME/TIMESTAMP) for `issuedDate`/`expiryDate` avoids spurious timezone-conversion errors — a visa that expires on "2026-12-31" expires on that calendar date regardless of server timezone.
- The organization operates in Sri Lanka; using `Asia/Colombo` for expiry evaluation aligns "today" with business expectations. The job runs daily at 01:00 `Asia/Colombo` so the evaluation date matches the start of the business day.

## 18. Expiry Job Fetch Strategy: Snapshot-First

**Decision:**
- The Python job loads a complete in-memory snapshot of all non-archived `active`/`expiring` records before performing any status updates.
- Paginate with `GET /compliance-records?status=active,expiring&limit=200&offset=N` until `offset >= total`. Do **not** call `PATCH /compliance-records/bulk-status` between GET pages.
- After all pages are loaded, deduplicate records by `id` (defensive guard against rare concurrent UI writes during the fetch loop).
- Evaluate every record in the snapshot against a single Sri Lanka `today` (captured once at run start), build `{id, newStatus}` updates only for records whose computed status **differs from current status**, then submit PATCH batches.
- The job fetches only `active` and `expiring` records — not `expired`. Date corrections on `expired` records are healed by the API on `PATCH` (see Decision #21). The job can downgrade `expiring` → `active` when computed status changes (e.g. buffer config change).
- **Not used now:** cursor-based pagination (`id > lastSeenId`) or process-each-page-then-PATCH. These are future options only if record count grows large enough to make a full snapshot impractical for Lambda memory or timeout.

**Edge cases and handling:**
- **Offset skip during fetch:** avoided by completing all GETs before any PATCH. If the job PATCHed between GET pages, rows leaving the `active`/`expiring` filter would shift pagination and cause records to be skipped.
- **Concurrent UI writes during GET loop:** a create, renew, or archive between pages may cause a record to be missed or duplicated in the snapshot. Deduplicate by `id`; any missed record is picked up on the next scheduled run.
- **Record archived/renewed after fetch, before PATCH:** the `bulk-status` endpoint skips `renewed`, `archived`, or missing IDs without failing the entire batch.

**Reasoning:** Snapshot-first is correct and simple at current data volumes (hundreds to low thousands of records). It requires no job-specific pagination API beyond the standard list endpoint.

## 19. Expiry Job Authentication

**Decision:**
- The Python job authenticates via `POST /auth/login` using a dedicated **service account** (seeded user; credentials in environment variables, never in source code).
- Login **once** at job start; reuse the JWT for all GET, PATCH, and EventBridge calls within the run.
- On `401 Unauthorized` (token expired mid-run): re-login and **retry that same request once**, then continue — do not restart the entire run from page 0.
- **No permanent API token** and no unauthenticated bypass for `PATCH /compliance-records/bulk-status`. The job uses the same JWT auth path as the dashboard.

**Reasoning:** One login per short scheduled run is sufficient. Mid-run re-login on 401 is a safety net, not the normal path — JWT lifetime should be configured long enough to cover a typical run (e.g. 15–60 minutes). A never-expiring API token would be a second auth system with a larger compromise window and no benefit for a job that runs and exits.

## 20. Expiry Job Schedule

**Decision:** The Python expiry job runs **once daily at 01:00 `Asia/Colombo`** (Sri Lanka time), triggered by EventBridge Scheduler → Lambda in production. During local development, run manually via `python src/main.py` or a local cron equivalent.

**Reasoning:** Daily evaluation is sufficient for compliance expiry tracking. Running at 01:00 SL ensures the Sri Lanka calendar date has rolled over and the job evaluates against the correct business day before working hours.

**EventBridge Scheduler config:** Use timezone `Asia/Colombo`, cron `cron(0 1 * * ? *)` (01:00 daily). Do not hardcode UTC offsets in application code.

## 21. Status Recalculation on Date Changes

**Decision:** Whenever `issuedDate` or `expiryDate` is created or corrected via the CRUD API (`POST /compliance-records` or `PATCH /compliance-records/:id`), the API recalculates `status` in the **same database transaction** using the shared rule (Decision #17). Clients cannot set `status` directly.

**Status rule:**
```
if expiryDate < today (Asia/Colombo)           → expired
elif expiryDate <= today + buffer (default 30) → expiring
else                                           → active
```

**Reasoning:** Without this, a corrected `expiryDate` could leave a record stuck in `expired` or `expiring`. Because the expiry job only fetches `active`/`expiring` records, `expired` records healed by date correction must be fixed by the API — not the job. This keeps the job simple while ensuring data consistency on every write path.
