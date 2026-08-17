# Postman Demo Data

Import these files into Postman to seed **20 employees** and **43 compliance records** into production (or any environment).

## Files

| File | Purpose |
|------|---------|
| `compliance-tracking-demo-data.postman_collection.json` | Collection — import this |
| `compliance-tracking-production.postman_environment.json` | Environment template — import and set password |
| `demo-seed-data.json` | Human-readable seed data + JOB-TEST expectations |
| `generate-collection.js` | Regenerates the collection after editing `demo-seed-data.json` |

## Setup

1. Open Postman → **Import** → select both JSON files in this folder.
2. Select environment **Compliance Tracking - Production**.
3. Edit environment variables:
   - `baseUrl` — your API Gateway URL including `/api` suffix  
     Example: `https://6dwo549x25.execute-api.ap-southeast-1.amazonaws.com/api`
   - `username` — admin username
   - `password` — your admin password (secret)

## Run order

1. **Auth → Login** — saves JWT to `token`.
2. **Demo Data → Seed All Demo Data** — creates all employees and records (skips if already seeded).
3. **Demo Data → Get Metrics (baseline)** — note `active` / `expiring` / `expired` totals.
4. **Demo Data → List JOB-TEST Records** — check console for the five tagged records.

### After the 1am job (2026-08-17 Asia/Colombo)

5. **After 1am Job → Get Metrics (after job)** — compare totals with baseline.
6. **After 1am Job → Verify JOB-TEST Transitions** — automated pass/fail checks.
7. Optionally run **List Expired Records** and **List Expiring Records**.

## JOB-TEST records (verify expiry job)

Seeded on **2026-08-16**. Lambda evaluates using **2026-08-17** calendar date at **01:00 Asia/Colombo**.

| Tag | Employee | Expiry | Status on seed day | Expected after job |
|-----|----------|--------|--------------------|--------------------|
| JOB-TEST-A | Amara Perera | 2026-08-16 | `expiring` | **`expired`** (should change) |
| JOB-TEST-B | Rajesh Kumar | 2026-09-16 | `active` | **`expiring`** (should change) |
| JOB-TEST-C | Nimali Fernando | 2026-08-15 | `expired` | `expired` (no change) |
| JOB-TEST-D | Priya Sivan | 2026-08-17 | `expiring` | `expiring` (no change) |
| JOB-TEST-E | Marcus Silva | 2026-09-17 | `active` | `active` (no change) |

The job should report **2 changed records** (A and B) in the EventBridge/SQS payload.

## Idempotency

Seed skips if an employee named **Amara Perera** already exists. To re-seed, archive/delete demo employees first or use a fresh database.

## Regenerate collection

After editing `demo-seed-data.json`:

```bash
node postman/generate-collection.js
```

Then re-import the updated collection in Postman.
