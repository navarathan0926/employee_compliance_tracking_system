# API Documentation (Summary)



Base URL: `/api` (adjust per environment via `.env`)



All endpoints except `POST /auth/login` require an `Authorization: Bearer <JWT>` header.

Auth is implemented with Passport.js (`passport-local` for login, `passport-jwt` for protected routes). See Architecture Decision #6.



---



## Pagination



All list endpoints (`GET /employees`, `GET /compliance-records`) support limit/offset pagination.



| Query param | Type | Default | Max | Notes |

|---|---|---|---|---|

| `limit` | integer | 50 | 200 | Number of records to return |

| `offset` | integer | 0 | — | Number of records to skip |



**Response envelope for all paginated endpoints:**

```json

{

  "data": [...],

  "total": 120,

  "limit": 50,

  "offset": 0

}

```



Requests with `limit` above 200 are rejected with `400 Bad Request`.



---



## Auth



### `POST /auth/login`

Body: `{ "username": string, "password": string }`

Response: `{ "accessToken": string }`



Tokens are short-lived. There is no refresh token endpoint — when a token expires, the user logs in again.



---



## Employees



### `POST /employees`

Create an employee.

Body: `{ "name": string, "department": string }`



### `GET /employees`

List employees. Supports filters and pagination. Archived (soft-deleted) employees are **excluded** by default.



Query params: `?department=`, `?limit=`, `?offset=`



### `GET /employees/:id`

Retrieve a single employee (excludes archived/soft-deleted).



### `PATCH /employees/:id`

Update an employee's fields (e.g. name, department).



### `DELETE /employees/:id`

Soft-delete (archive) an employee. Sets `deletedAt` on the employee and **cascades** to all of that employee's `ComplianceRecord` rows in the same transaction — each record's `deletedAt` is set and its `status` is set to `archived`.



Neither the employee nor their records are hard-deleted. The operation is irreversible via the API; hard delete requires direct database access.



Response: `204 No Content`



---



## Compliance Records



### Status computation (shared rule)



Used on create, date correction (`PATCH`), and by the expiry job. Evaluates against the current **Sri Lanka calendar date** (`Asia/Colombo`):



| Condition | Status |

|---|---|

| `expiryDate` < today | `expired` |

| `expiryDate` ≤ today + buffer | `expiring` |

| otherwise | `active` |



Buffer defaults to 30 days (`COMPLIANCE_EXPIRING_BUFFER_DAYS`). Clients cannot set `status` directly on create or PATCH.



### `POST /compliance-records`

Create a record.



Body:

```json

{

  "employeeId": integer,

  "type": "visa | certification | background_check | training | other",

  "issuedDate": "YYYY-MM-DD",

  "expiryDate": "YYYY-MM-DD",

  "notes": "optional string"

}

```



Validation:

- `expiryDate` must be after `issuedDate`.

- All fields except `notes` are required.

- `employeeId` must reference a non-archived employee.



Response includes computed `status` (not supplied by client).



### `GET /compliance-records`

List records. Supports filters and pagination. `renewed` and `archived` records are **excluded** by default.



Query params: `?employeeId=`, `?status=`, `?type=`, `?expiryFrom=`, `?expiryTo=`, `?limit=`, `?offset=`



**Multi-value status filter:** comma-separated, e.g. `?status=active,expiring` (used by the expiry job). Valid values: `active`, `expiring`, `expired`, `renewed`, `archived`.



`?status=archived` or `?status=renewed` can be passed explicitly for audit views.



**Employee data on list:** Each item includes `employeeId` only — the list response does **not** embed a nested `employee` object (keeps the expiry job fetch lean).



When employee name/department is needed:

- **Single record:** `GET /compliance-records/:id` — includes nested `employee`.
- **Dashboard expiring table:** `GET /dashboard/expiring` — returns `employeeName` and `department` per row.
- **By employee:** `GET /employees/:id` or filter with `?employeeId=`.



**Future (not implemented):** optional `?includeEmployee=true` on this list endpoint to join employee name/department in one paginated response. Use the endpoints above until then.



### `GET /compliance-records/:id`

Retrieve a single record (including `renewed` and `archived`, to support audit views).



### `PATCH /compliance-records/:id`

Correct a record's fields (e.g. fix a typo in `notes`, correct an `issuedDate` or `expiryDate` data-entry error).



**This endpoint is for corrections only, not for renewals.** Use `POST /compliance-records/:id/renew` to renew.



When `issuedDate` or `expiryDate` is updated, the API **recalculates `status`** in the same transaction using the shared status rule above. This heals records that were `expiring` or `expired` after a date correction — the expiry job does not need to fetch `expired` records for this case.



`status` cannot be set directly via PATCH.



### `POST /compliance-records/:id/renew`

Renew a compliance record. This is an atomic operation:



1. Creates a new `ComplianceRecord` with the provided `issuedDate` and `expiryDate`, setting `renewedFromId` to the ID of the record being renewed. Initial `status` is computed from the new dates.

2. Marks the old record as renewed (`deletedAt` set, `status: renewed`).



Both steps occur in a single transaction. Returns the newly created record.



Body:

```json

{

  "issuedDate": "YYYY-MM-DD",

  "expiryDate": "YYYY-MM-DD",

  "notes": "optional string"

}

```



Validation: same as `POST /compliance-records` (date ordering, required fields). The source record must not already be `renewed` or `archived`.



### `PATCH /compliance-records/bulk-status`

Used by the Python expiry job. Bulk status update. At most **200** updates per request (same cap as list pagination).



Body:

```json

{

  "updates": [

    { "id": integer, "newStatus": "active" },

    { "id": integer, "newStatus": "expiring" },

    { "id": integer, "newStatus": "expired" }

  ]

}

```



Idempotent: if a record's current `status` already matches `newStatus`, it is skipped — no state change.



`renewed`, `archived`, or missing record IDs in the batch are skipped without failing the entire request (e.g. a record renewed or archived after the job fetched its snapshot).



Only `active`, `expiring`, and `expired` are accepted as `newStatus` values from this endpoint. Attempting to set `renewed` or `archived` via this endpoint is rejected with `400 Bad Request`.



### `DELETE /compliance-records/:id`

Archives a single record (soft delete). Sets `deletedAt` and `status: archived`.



Hard delete is not exposed via the API. Use direct database access for genuine data-entry error corrections only.



Response: `204 No Content`



---



## Dashboard



All dashboard queries use the **Sri Lanka calendar date** (`Asia/Colombo`) for "today" and date-range calculations. `renewed` and `archived` records are excluded from all counts and lists.



### `GET /dashboard/metrics`

Returns totals by status, optionally broken down by department and/or type.



Query params:

- `?departmentBreakdown=true` — include per-department counts

- `?typeBreakdown=true` — include per-type counts



Both flags may be set together. Breakdowns are independent (not a cross-tab of department × type).



Response:

```json

{

  "totals": {

    "active": 100,

    "expiring": 15,

    "expired": 8

  },

  "byDepartment": [

    {

      "department": "Engineering",

      "active": 40,

      "expiring": 5,

      "expired": 2

    }

  ],

  "byType": [

    {

      "type": "visa",

      "active": 20,

      "expiring": 3,

      "expired": 1

    }

  ]

}

```



`byDepartment` is present only when `departmentBreakdown=true`. `byType` is present only when `typeBreakdown=true`.



### `GET /dashboard/expiring`

Returns non-archived records whose `expiryDate` falls within the requested window (typically `expiring` or `active` records nearing expiry).



Query params:

- `?days=30` — preset window from today's Sri Lanka date (default 30 if omitted; max 365)

- `?from=YYYY-MM-DD&to=YYYY-MM-DD` — custom range (both required when used; `days` is ignored)

- `?limit=` — page size (default 50, max 200)

- `?offset=` — records to skip (default 0)



Uses `getManyAndCount()`: `data` is the current page; `total` is the count of all matching rows (for pagination UI).



Response:

```json

{

  "data": [

    {

      "id": 1,

      "employeeId": 10,

      "employeeName": "Jane Doe",

      "department": "Engineering",

      "type": "visa",

      "issuedDate": "2024-01-15",

      "expiryDate": "2026-09-01",

      "status": "expiring",

      "notes": null

    }

  ],

  "total": 15,

  "limit": 50,

  "offset": 0,

  "from": "2026-08-14",

  "to": "2026-09-13"

}

```



---



## Scheduled Job (reference)



The Python expiry job is triggered daily at **01:00 `Asia/Colombo`** via EventBridge Scheduler → Lambda. See `docs/process-flow.md` and Architecture Decision #20.

