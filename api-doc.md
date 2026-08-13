# API Documentation (Summary)

Base URL: `/api` (adjust per environment via `.env`)

All endpoints except `/auth/login` require a `Authorization: Bearer <JWT>` header.

## Auth

### `POST /auth/login`
Body: `{ "username": string, "password": string }`
Response: `{ "accessToken": string }`

## Employees

### `POST /employees`
Create an employee.
Body: `{ "name": string, "department": string }`

### `GET /employees`
List employees. Supports `?department=` filter.

### `GET /employees/:id`
Retrieve a single employee.

### `PATCH /employees/:id`
Update an employee.

## Compliance Records

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
Validation: `expiryDate` must be after `issuedDate`; all fields except `notes` are required.

### `GET /compliance-records`
List records. Supports filters: `?employeeId=`, `?status=`, `?type=`, `?expiryFrom=`, `?expiryTo=`.

### `GET /compliance-records/:id`
Retrieve a single record.

### `PATCH /compliance-records/:id`
Update a record (e.g. renew, correct a field).

### `PATCH /compliance-records/bulk-status`
Used by the Python expiry job. Bulk status update.
Body:
```json
{
  "updates": [
    { "id": integer, "newStatus": "expiring" },
    { "id": integer, "newStatus": "expired" }
  ]
}
```
Idempotent: if a record's current status already matches `newStatus`, it's skipped, no-op.

### `DELETE /compliance-records/:id`
Archives the record (soft delete, sets `status: archived` and `deletedAt`). Hard delete is not exposed here, handled separately/manually for data-entry corrections only.

## Dashboard

### `GET /dashboard/metrics`
Returns totals by status, optionally broken down by department/type.
Query params: `?departmentBreakdown=true`, `?typeBreakdown=true`

### `GET /dashboard/expiring`
Returns records expiring within a date range.
Query params: `?days=30` (preset) or `?from=&to=` (custom range)
