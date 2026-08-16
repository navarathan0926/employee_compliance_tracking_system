# Local AWS Testing Guide (LocalStack)

Step-by-step guide to test EventBridge and SQS locally with the expiry job on **Windows**. For core expiry logic only (no AWS), set `SKIP_EVENT_PUBLISH=true` in `.env` and skip this guide.

---

## What the expiry job uses

| Component | Used for | Local target |
|-----------|----------|--------------|
| **NestJS API** | Login, fetch records, bulk-status PATCH | `http://localhost:3000/api` |
| **EventBridge** | Publish one summary event per run | LocalStack (`http://localhost:4566`) |
| **SQS** | Receive events routed from EventBridge (infra verification) | LocalStack |

The job **never** writes status changes through AWS — only through the NestJS API. EventBridge/SQS are for lifecycle notifications.

---

## Prerequisites

1. **Phase 1 backend** running: `npm run start:dev` (from `backend/`)
2. **Docker Desktop** running
3. **AWS CLI v2** installed (`aws --version` works)
4. **Python deps** installed: `pip install -r requirements.txt`
5. **LocalStack auth token** — recent LocalStack images require `LOCALSTACK_AUTH_TOKEN`. Sign up at [app.localstack.cloud](https://app.localstack.cloud) (free Hobby plan) and copy your token.

---

## Step 1 — Configure expiry-job `.env`

Copy the template and set values:

```powershell
cd expiry-job
copy .env.example .env
```

Minimum for local AWS testing:

```env
API_BASE_URL=http://localhost:3000/api
SERVICE_ACCOUNT_USERNAME=<matches backend seed user>
SERVICE_ACCOUNT_PASSWORD=<matches backend seed password>

AWS_REGION=ap-southeast-1
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

EVENTBRIDGE_BUS_NAME=compliance-events
EVENTBRIDGE_SOURCE=compliance.expiry-job
EVENTBRIDGE_DETAIL_TYPE=compliance.expiry-evaluation.completed
SQS_QUEUE_NAME=compliance-lifecycle-events

# Comment out or remove to enable EventBridge publish:
# SKIP_EVENT_PUBLISH=true
```

**Note:** `AWS_REGION` is read by the Python job. The AWS CLI uses `AWS_DEFAULT_REGION` (set in Step 3).

---

## Step 2 — Start LocalStack

First run (replace `your_token_here`):

```powershell
docker run -d --name localstack -p 4566:4566 -e LOCALSTACK_AUTH_TOKEN=your_token_here localstack/localstack
```

If the container already exists but stopped:

```powershell
docker start localstack
```

If it keeps crashing, remove and recreate with your token:

```powershell
docker rm -f localstack
docker run -d --name localstack -p 4566:4566 -e LOCALSTACK_AUTH_TOKEN=your_token_here localstack/localstack
```

**Verify LocalStack is healthy:**

```powershell
curl.exe http://localhost:4566/_localstack/health
```

Expect JSON with `"events": "available"` and `"sqs": "available"`.

---

## Step 3 — Set AWS CLI session variables (PowerShell)

The AWS CLI does **not** read `expiry-job/.env`. Set these in the same terminal before bootstrap commands:

```powershell
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = "ap-southeast-1"
$env:HOME = $env:USERPROFILE
```

| Variable | Used by |
|----------|---------|
| `AWS_REGION` | Python job (`.env`) |
| `AWS_DEFAULT_REGION` | AWS CLI (terminal) |

---

## Step 4 — Bootstrap EventBridge + SQS (automated)

After LocalStack is healthy, run from `expiry-job/` (reads `.env`):

```powershell
python scripts/bootstrap_localstack.py
```

This creates the event bus, SQS queue, EventBridge rule, and rule→SQS target. Safe to re-run.

---

## Step 4 (manual) — Create EventBridge bus

```powershell
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 events create-event-bus --name compliance-events
```

Expected: `"EventBusArn": "arn:aws:events:ap-southeast-1:000000000000:event-bus/compliance-events"`

Safe to re-run — if the bus already exists, AWS returns an error you can ignore.

---

## Step 5 — Create SQS queue

```powershell
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 sqs create-queue --queue-name compliance-lifecycle-events
```

Expected: a `QueueUrl` containing `compliance-lifecycle-events`.

---

## Step 6 — Create EventBridge rule

This rule matches events published by the expiry job:

```powershell
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 events put-rule --name compliance-expiry-completed --event-bus-name compliance-events --event-pattern '{\"source\":[\"compliance.expiry-job\"],\"detail-type\":[\"compliance.expiry-evaluation.completed\"]}'
```

Expected: `"RuleArn": "...compliance-expiry-completed"`

**Without this rule, events are published to EventBridge but SQS stays empty.**

---

## Step 7 — Wire rule → SQS target

```powershell
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 events put-targets --rule compliance-expiry-completed --event-bus-name compliance-events --targets "Id=1,Arn=arn:aws:sqs:ap-southeast-1:000000000000:compliance-lifecycle-events"
```

Expected: `"FailedEntryCount": 0`

**Verify rule exists:**

```powershell
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 events list-rules --event-bus-name compliance-events
```

Should list `compliance-expiry-completed`.

---

## Step 8 — Run the expiry job

Ensure the backend is running and at least one record is `active` or `expiring` with an expiry date that triggers a status change (optional for event-only runs).

```powershell
cd expiry-job
python src/main.py
```

**Success logs:**

```text
Fetched N active/expiring records
Applied bulk-status batch ...        # only when status changes
Published expiry evaluation event runId=...
Expiry job completed ...
```

If `SKIP_EVENT_PUBLISH=true`: you will see `skipping EventBridge publish` instead.

---

## Step 9 — Verify SQS received the event

**CLI:**

```powershell
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 sqs receive-message --queue-url http://localhost:4566/000000000000/compliance-lifecycle-events --max-number-of-messages 1
```

Expected: a `Body` JSON containing `runId`, `evaluationDate`, `changedRecords`, `expiringCount`, `expiredCount`.

**LocalStack Web UI:** open the SQS queue `compliance-lifecycle-events` and check **Approximate Number Of Messages** > 0 (or poll/receive messages).

---

## Step 10 — Confirm end-to-end behaviour

| Check | How | Pass criteria |
|-------|-----|---------------|
| NestJS fetch | Job log: `Fetched N ...` | N ≥ 0 |
| NestJS PATCH | Job log: `Applied bulk-status batch` | Record status updated in API/DB |
| EventBridge publish | Job log: `Published expiry evaluation event` | No publish error |
| EventBridge → SQS | `sqs receive-message` or LocalStack UI | Message with matching `runId` |
| Idempotent rerun | Run job again with no date changes | `No status updates required`; event still published |

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `aws` not recognized | AWS CLI not installed | Install AWS CLI v2; reopen terminal |
| `NoRegion` | CLI missing region | Set `$env:AWS_DEFAULT_REGION = "ap-southeast-1"` or pass `--region` |
| `NoCredentials` | CLI missing creds | Set `$env:AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY = "test"` or run `aws configure` |
| `Could not connect to localhost:4566` | LocalStack not running | Start Docker + LocalStack container |
| `License activation failed` (exit 55) | Missing auth token | Recreate container with `LOCALSTACK_AUTH_TOKEN` |
| `Could not determine home directory` (`awslocal`) | Missing `HOME` env | `$env:HOME = $env:USERPROFILE` or use `aws` directly |
| Event published but SQS empty | Rule/target not created | Complete Steps 6–7 |
| Job does not fix `expired` → `active` | By design | Job only fetches `active,expiring`; heal via API PATCH on `expiryDate` |

---

## Quick reference — one-time bootstrap

**Automated (recommended)** — after LocalStack is healthy:

```powershell
cd expiry-job
python scripts/bootstrap_localstack.py
```

**Manual CLI alternative** (Steps 3–7):

```powershell
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = "ap-southeast-1"

aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 events create-event-bus --name compliance-events
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 sqs create-queue --queue-name compliance-lifecycle-events
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 events put-rule --name compliance-expiry-completed --event-bus-name compliance-events --event-pattern '{\"source\":[\"compliance.expiry-job\"],\"detail-type\":[\"compliance.expiry-evaluation.completed\"]}'
aws --endpoint-url=http://localhost:4566 --region ap-southeast-1 events put-targets --rule compliance-expiry-completed --event-bus-name compliance-events --targets "Id=1,Arn=arn:aws:sqs:ap-southeast-1:000000000000:compliance-lifecycle-events"
```

Then: `python src/main.py` → verify SQS (Step 9).
