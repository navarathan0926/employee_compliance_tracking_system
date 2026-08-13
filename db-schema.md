# Database Schema

MySQL, accessed via TypeORM. All primary keys are auto-incrementing integers.

## `Employee`

| Column | Type | Notes |
|---|---|---|
| `id` | int, auto-increment (PK) | |
| `name` | varchar | |
| `department` | varchar | used for dashboard breakdowns |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

## `ComplianceRecord`

| Column | Type | Notes |
|---|---|---|
| `id` | int, auto-increment (PK) | |
| `employeeId` | int (FK → Employee.id) | |
| `type` | enum | `visa`, `certification`, `background_check`, `training`, `other` |
| `issuedDate` | date | |
| `expiryDate` | date | must be after `issuedDate` |
| `status` | enum | `active`, `expiring`, `expired`, `renewed`, `archived` |
| `notes` | text, nullable | supporting documentation notes |
| `lastEvaluatedStatus` | enum, nullable | tracks what the expiry job last set, used for idempotency |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `deletedAt` | timestamp, nullable | soft-delete marker |

## `User`

For login/JWT auth only, not a full user-management system.

| Column | Type | Notes |
|---|---|---|
| `id` | int, auto-increment (PK) | |
| `username` | varchar, unique | |
| `passwordHash` | varchar | |
| `createdAt` | timestamp | |

## Status Lifecycle Notes

- `active` → `expiring`: when `expiryDate` is within a 30-day buffer of the current date.
- `active`/`expiring` → `expired`: when `expiryDate` has passed.
- These two transitions are the only ones the scheduled Python job performs.
- `archived` is only ever set manually, via the CRUD API, never by the scheduled job.
- `renewed` is set manually when a record's underlying compliance item is renewed (may also involve creating a new record with a new `issuedDate`/`expiryDate`, depending on how renewal is implemented).
