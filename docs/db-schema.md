# Database Schema

MySQL, accessed via TypeORM. All primary keys are auto-incrementing integers.

## Column Conventions

| Convention | Rule |
|---|---|
| Timestamp columns (`createdAt`, `updatedAt`, `deletedAt`) | Stored in **UTC**. TypeORM `@CreateDateColumn`/`@UpdateDateColumn` default to UTC when the MySQL connection charset and `timezone` are set to UTC. |
| Date columns (`issuedDate`, `expiryDate`) | Stored as plain **DATE** (no time component). These represent calendar dates, not moments in time. No timezone conversion is applied. |

---

## `Employee`

| Column | Type | Notes |
|---|---|---|
| `id` | int, auto-increment (PK) | |
| `name` | varchar | |
| `department` | varchar | used for dashboard breakdowns |
| `createdAt` | timestamp (UTC) | set on insert |
| `updatedAt` | timestamp (UTC) | updated on every write |
| `deletedAt` | timestamp (UTC), nullable | soft-delete marker; non-null means archived |

**Soft-delete cascade:** Archiving an employee (setting `deletedAt`) triggers a bulk soft-delete of all associated `ComplianceRecord` rows in the same transaction. See Architecture Decision #15.

---

## `ComplianceRecord`

| Column | Type | Notes |
|---|---|---|
| `id` | int, auto-increment (PK) | |
| `employeeId` | int (FK → Employee.id) | |
| `type` | enum | `visa`, `certification`, `background_check`, `training`, `other` |
| `issuedDate` | date | calendar date, no time component |
| `expiryDate` | date | must be after `issuedDate`; calendar date, no time component |
| `status` | enum | `active`, `expiring`, `expired`, `renewed`, `archived` |
| `renewedFromId` | int, nullable (FK → ComplianceRecord.id) | set on the **new** record created during renewal; points to the record it replaced |
| `notes` | text, nullable | supporting documentation notes |
| `createdAt` | timestamp (UTC) | set on insert |
| `updatedAt` | timestamp (UTC) | updated on every write |
| `deletedAt` | timestamp (UTC), nullable | soft-delete marker; non-null means archived |

---

## `User`

For login/JWT auth only, not a full user-management system. The initial admin user is created via a seed script.

| Column | Type | Notes |
|---|---|---|
| `id` | int, auto-increment (PK) | |
| `username` | varchar, unique | |
| `passwordHash` | varchar | bcrypt hash |
| `createdAt` | timestamp (UTC) | set on insert |

---

## Status Computation Rule

All status assignments (create, date correction, expiry job) use the same rule against the current **Sri Lanka calendar date** (`Asia/Colombo`):

| Condition | Status |
|---|---|
| `expiryDate` < today | `expired` |
| `expiryDate` ≤ today + buffer (default 30 days) | `expiring` |
| otherwise | `active` |

Buffer days is configurable via `COMPLIANCE_EXPIRING_BUFFER_DAYS` (default `30`). See Architecture Decision #17.

---

## Status Lifecycle Notes

| Transition | Who triggers it | Condition |
|---|---|---|
| → `active` / `expiring` / `expired` | CRUD API | On `POST` or when `issuedDate`/`expiryDate` is corrected via `PATCH` — status recalculated in the same transaction |
| `active` ↔ `expiring` ↔ `expired` | Python expiry job | Same date rule as above; PATCH sent only when computed status differs from current status |
| any → `renewed` | CRUD API (renewal only) | Old record superseded by `POST /compliance-records/:id/renew` |
| any → `archived` | CRUD API (manual only) | Explicit soft-delete of a record, or cascade when an employee is archived |

**Rules:**
- The expiry job only sets `active`, `expiring`, and `expired`. It never sets `renewed` or `archived`.
- `renewed` and `archived` both set `deletedAt` and are excluded from default list queries, dashboard metrics, and the expiry job scan.
- **`renewed`** = superseded by a newer record (renewal). **`archived`** = manually removed or employee cascade. This distinction satisfies the requirement's `renewed` status while keeping audit clarity.
- On renewal: old record → `status: renewed` + `deletedAt`; new record → `status` computed from new dates + `renewedFromId` pointing to the old record.
- `renewed` and `archived` records remain in the database for audit purposes and are retrievable via `GET /compliance-records/:id`.

---

## Renewal Chain Example

```
ComplianceRecord id=1  (visa, active → expired → renewed via renewal)
  renewedFromId: null
  deletedAt: set when renewed

ComplianceRecord id=42 (visa, active)
  renewedFromId: 1       ← was created to renew record #1
```

Walking `renewedFromId` backwards reconstructs the full history for that compliance item.

---

## Indexes (planned)

| Index | Columns | Reason |
|---|---|---|
| Primary | `id` | all tables |
| FK index | `ComplianceRecord.employeeId` | joins, cascade queries |
| Filter index | `ComplianceRecord.status` | expiry job fetch, dashboard aggregation |
| Range index | `ComplianceRecord.expiryDate` | expiry job date comparisons, dashboard expiring-soon queries |
| Soft-delete index | `ComplianceRecord.deletedAt` | excluding archived records from default queries |
| Composite | `(status, expiryDate, deletedAt)` | combined filter used by the expiry job fetch query |

See `docs/performance.md` for full indexing rationale.
