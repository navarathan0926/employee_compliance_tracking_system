# Expiry Job

Python job that checks compliance record expiry dates, updates statuses through the NestJS API, and publishes one summary event to EventBridge.

**In production** this runs on a schedule (Lambda + EventBridge Scheduler — Phase 4). **Locally** you run it manually with `python src/main.py`.

---

## What it does (simple)

```
Login → fetch active/expiring records → compute status → PATCH API → publish event
```

| Step | Talks to | Purpose |
|------|----------|---------|
| Fetch + PATCH | **NestJS API** | Read and update record statuses in MySQL |
| Publish event | **EventBridge** (LocalStack locally) | Notify downstream systems (e.g. SQS) |

Status changes **never** go through AWS — only through the API.

---

## Quick start (expiry logic only — no AWS)

Use this when you only want to test status evaluation and API updates.

### 1. Prerequisites

- Backend running: `cd backend && npm run start:dev`
- Database migrated and seeded: `npm run seed`
- Python 3.9+

### 2. Install and configure

```bash
cd expiry-job
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

- Set `SERVICE_ACCOUNT_USERNAME` and `SERVICE_ACCOUNT_PASSWORD` to match your backend user
- Keep `SKIP_EVENT_PUBLISH=true` (or uncomment it in `.env.example`)

### 3. Run

```bash
python src/main.py
```

### 4. Run tests

```bash
python -m pytest
```

---

## Full local test (with EventBridge + SQS)

Use this when you also want to verify the AWS messaging path on your machine.

### Step 1 — Start the backend

```bash
cd backend
npm run start:dev
```

### Step 2 — Start LocalStack (Docker)

LocalStack emulates AWS locally. It must be running **before** the bootstrap script.

```powershell
docker run -d --name localstack -p 4566:4566 -e LOCALSTACK_AUTH_TOKEN=your_token_here localstack/localstack
```

Get a free token at [app.localstack.cloud](https://app.localstack.cloud).

Check it is healthy:

```powershell
curl.exe http://localhost:4566/_localstack/health
```

> **Note:** `bootstrap_localstack.py` does **not** start Docker. You start LocalStack yourself, then run the script to create bus/queue/rule inside it.

### Step 3 — Configure `.env`

```env
API_BASE_URL=http://localhost:3000/api
SERVICE_ACCOUNT_USERNAME=...
SERVICE_ACCOUNT_PASSWORD=...

AWS_REGION=ap-southeast-1
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Comment out or remove this line to enable EventBridge publish:
# SKIP_EVENT_PUBLISH=true
```

### Step 4 — Bootstrap AWS resources in LocalStack

Creates the EventBridge bus, SQS queue, and the rule that connects them. Run once after each fresh LocalStack container.

```bash
python scripts/bootstrap_localstack.py
```

### Step 5 — Run the job

```bash
python src/main.py
```

**Success looks like:**

```text
Fetched N active/expiring records
Applied bulk-status batch ...          # only when statuses change
Published expiry evaluation event ...  # only when publish is enabled
```

### Step 6 — Verify SQS received the event

Check the queue in the LocalStack UI, or:

```powershell
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 sqs receive-message --queue-url http://localhost:4566/000000000000/compliance-lifecycle-events
```

---

## When to run what

| Command | When |
|---------|------|
| `docker start localstack` | LocalStack is stopped |
| `python scripts/bootstrap_localstack.py` | First time, or after LocalStack container was recreated |
| `python src/main.py` | Every time you want to run the job |
| `python -m pytest` | After code changes |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails | Check backend is running and credentials in `.env` |
| `Could not connect to localhost:4566` | Start LocalStack (`docker start localstack`) |
| Event published but SQS empty | Run `python scripts/bootstrap_localstack.py` |
| `expired` record not changed to `active` | By design — job only fetches `active`/`expiring`. Fix dates via API PATCH |

For detailed AWS/LocalStack setup (credentials, region, auth token issues): **[LOCAL-AWS-TESTING.md](./LOCAL-AWS-TESTING.md)**

---

## Job behaviour (reference)

- **Timezone:** `Asia/Colombo` calendar date
- **Fetches:** only `active` and `expiring` records (not `expired`)
- **Updates:** only when computed status ≠ current status
- **Idempotent:** re-running with no date changes = no PATCH calls, event still published
- **Event publish retry:** if EventBridge fails after PATCH, the payload is saved and resent on the next run (same `runId`)
- **Event schema:** Architecture Decision #7 — see `docs/architecture-decisions.md`
