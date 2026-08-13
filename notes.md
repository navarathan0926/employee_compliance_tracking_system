# Other Important Notes

## Out of scope for now
- S3 file attachments (a `notes` text field covers documentation needs for now)
- A notification consumer actually reading from SQS (publishing the event is the current deliverable; consuming it is future work)
- Full user-management (roles, registration, multi-tenant) — auth is a minimal username/password → JWT flow only

## Things to decide later, not blocking current work
- Exact renewal flow: does renewing a record update it in place, or create a new record referencing the old one?
- Final buffer window for "expiring soon" (currently 30 days, adjustable)
- Whether department/type breakdowns on the dashboard need to be combinable (e.g. by department AND type at once) or just one at a time

## Local development setup reminders
- Use LocalStack (or manual mocks) to emulate EventBridge/SQS locally, don't require real AWS credentials for day-to-day development
- Python job should be runnable as a plain script (`python src/main.py`) against a local NestJS instance, no AWS dependency required to test the core expiry logic
- Keep all AWS resource names/endpoints/account IDs in environment variables, never hardcoded, so local and production configs can differ cleanly

## Idempotency reminder
`lastEvaluatedStatus` on `ComplianceRecord` exists specifically so reruns of the expiry job (accidental or retried) don't reprocess records that were already handled in the same run/window.
