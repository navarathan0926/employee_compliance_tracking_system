# Performance

This document records the performance strategy, indexing plan, and scalability considerations for the Employee Compliance Tracking System.

---

## 1. Primary Key Strategy

Auto-incrementing integer PKs (not UUIDs) are used on all tables. Incrementing integers keep the clustered primary-key index on MySQL InnoDB in insert order, avoiding the index fragmentation (page splits) that random UUIDs cause. This results in faster inserts and smaller index sizes, which benefits all queries that touch the PK. See Architecture Decision #1.

---

## 2. Database Indexes

### `ComplianceRecord` indexes

| Index | Columns | Query pattern covered |
|---|---|---|
| Primary (clustered) | `id` | PK lookup, FK joins |
| Foreign key | `employeeId` | Filter by employee, cascade on employee archive |
| Status filter | `status` | Expiry job fetch (`WHERE status IN ('active','expiring')`), dashboard aggregation |
| Date range | `expiryDate` | Expiry job date comparison, dashboard expiring-soon queries |
| Soft-delete exclusion | `deletedAt` | `WHERE deletedAt IS NULL` on all default list queries |
| Composite | `(status, expiryDate, deletedAt)` | Combined filter used by the expiry job's main fetch query — covers all three conditions in one index scan |

### `Employee` indexes

| Index | Columns | Query pattern covered |
|---|---|---|
| Primary (clustered) | `id` | PK lookup |
| Soft-delete exclusion | `deletedAt` | `WHERE deletedAt IS NULL` on default list queries |
| Department filter | `department` | Dashboard department breakdown, `GET /employees?department=` filter |

### `User` indexes

| Index | Columns | Query pattern covered |
|---|---|---|
| Primary (clustered) | `id` | PK lookup |
| Unique | `username` | Login lookup by username |

**Rule:** Every column that appears in a `WHERE`, `JOIN ON`, or `ORDER BY` clause in a hot path should have an index. Review the query plan with `EXPLAIN` before adding new columns to frequently-executed queries.

---

## 3. Query Strategy

- **Soft-delete filtering:** TypeORM's `@DeleteDateColumn` with `SoftDeleteQueryRunner` automatically appends `deletedAt IS NULL` to all queries. Ensure the `deletedAt` index (and the composite index including it) is in place to avoid full-table scans.
- **Dashboard aggregation:** Metrics are computed live with `COUNT` / `GROUP BY` queries via TypeORM's query builder. No pre-aggregation table is used at this scale (see Architecture Decision #10). If dashboard queries become slow (>200ms p95), revisit with a materialized summary or a caching layer.
- **Avoid N+1 queries:** When fetching a list of compliance records that also requires employee data, use a single `JOIN` or TypeORM `relations` option — never iterate and issue one query per record.
- **Select only needed columns:** Use TypeORM's `select` option on list queries; avoid `SELECT *` in production paths to reduce data transfer and memory pressure.

---

## 4. Pagination

All list endpoints enforce limit/offset pagination (default limit 50, max 200). This prevents any client request from triggering an unbounded full-table scan. See Architecture Decision #16.

**TypeORM mapping:**
```
?limit=50&offset=100  →  .take(50).skip(100)
```

The `total` field in the paginated response is computed via `COUNT(*)` in the same query (TypeORM's `findAndCount`), so the client can determine page count without an extra round trip.

**Performance note:** Deep offsets (e.g. `?offset=100000`) degrade with large tables because MySQL must scan and discard `offset` rows before returning results. At current expected data volumes this is acceptable. If offset-based pagination becomes slow at scale, migrate to cursor-based pagination using `id > lastSeenId` as the cursor.

---

## 5. Expiry Job Batch Processing

See Architecture Decisions #11, #18, and #19 for the full rationale.

- **Fetch (GET):** paginate with `limit=200` (API max; configurable constant in the Python job) until all non-archived `active`/`expiring` records are loaded into an in-memory snapshot. **No PATCH between GET pages** — snapshot-first avoids offset-pagination skips when statuses change mid-fetch.
- **Evaluate:** compare every record in the snapshot against a single Sri Lanka calendar date (`Asia/Colombo`, captured once at run start).
- **Update (PATCH):** submit status changes in batches (e.g. up to 200 records per `PATCH /compliance-records/bulk-status` call; configurable constant in the Python job). `newStatus` may be `active`, `expiring`, or `expired`. Only records whose computed status differs from current status are included.
- The NestJS `bulk-status` endpoint executes a single bulk update per batch (TypeORM `save` on an array, or a raw `UPDATE` with an `IN` clause), not individual updates per record. Archived or missing IDs are skipped without failing the batch.
- **Idempotency:** skip records whose computed `newStatus` already matches current `status` before sending a PATCH batch; reduces batch size on rerun.
- **Retries:** each GET, PATCH, and EventBridge publish uses exponential backoff (e.g. 1s, 2s, 4s) with a request timeout. Failed PATCH batches are logged and skipped; the next scheduled run repairs missed records.
- **Auth:** login once per run via service account JWT; re-login and retry on `401` only.

---

## 6. Connection Pooling

TypeORM's connection pool should be configured explicitly (not left at defaults). Recommended starting values for the current deployment target:

| Setting | Value | Notes |
|---|---|---|
| `extra.connectionLimit` | 10 | Adjust based on Elastic Beanstalk instance count × API pods |
| `connectTimeout` | 10 000 ms | Fail fast if RDS is unreachable |
| `acquireTimeout` | 10 000 ms | Fail fast if pool is exhausted |

If multiple Elastic Beanstalk instances run simultaneously, the total active connections to RDS = (instances) × (connectionLimit). RDS Free Tier (`db.t3.micro`) supports up to ~66 connections; size the pool accordingly.

---

## 7. API Response Size

- Paginated responses cap the result set at 200 records. Large payloads are chunked across pages by the client.
- TypeORM `select` should be used on list endpoints to return only the columns the frontend actually needs, not the full entity (e.g. omit `passwordHash` from any accidental join).

---

## 8. Future Considerations (not current work)

| Concern | Trigger | Option |
|---|---|---|
| Slow dashboard aggregation | p95 > 200 ms | Add a scheduled summary cache (Redis or a summary table refreshed every N minutes) |
| Deep-offset pagination | `offset` > 10 000 causing noticeable latency | Migrate list endpoints to cursor-based pagination (`id > lastSeenId`) |
| High connection pressure | RDS connection limit hit | Introduce a connection proxy (RDS Proxy) between Elastic Beanstalk instances and RDS |
| Large expiry-job payloads | Record count growing to 10 000+ | Cursor-based job fetch (`id > lastSeenId`), smaller PATCH batches, or a job-specific list endpoint |
