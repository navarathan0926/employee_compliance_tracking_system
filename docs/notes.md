# Other Important Notes

## In scope (this build)

| Area | Deliverable |
|---|---|
| NestJS API | CRUD for employees + compliance records, validation, soft delete, renewal, bulk-status, dashboard endpoints |
| Auth | Passport login → JWT; seed admin + service account |
| Expiry job | Daily 01:00 SL; snapshot fetch → evaluate → bulk PATCH → publish EventBridge event |
| Messaging | EventBridge → SQS (publish lifecycle events; no separate consumer app) |
| Frontend | SvelteKit login + dashboard (metrics, expiring list, date filter) |
| Config | `.env.example`; LocalStack for local AWS emulation |

## Decided — no longer open



The following items were previously listed as open decisions. They are now resolved:



| Item | Decision |

|---|---|

| Renewal flow | New record with `renewedFromId`; old record → `status: renewed` + `deletedAt`. `PATCH` is for corrections only. See Architecture Decision #14. |

| `renewed` vs `archived` | `renewed` = superseded by renewal. `archived` = manual delete or employee cascade. Both set `deletedAt`. |

| Status on date change | API recalculates `status` on `POST`/`PATCH` when dates change. See Architecture Decision #21. |

| Expiring buffer | Default 30 days via `COMPLIANCE_EXPIRING_BUFFER_DAYS` env var. |

| Timezone | Business timezone: `Asia/Colombo`. Expiry job, dashboard, and status rule use Sri Lanka calendar date. Job runs daily at 01:00 SL. See Decision #17, #20. |

| Pagination | Limit/offset (`?limit=&offset=`), default 50, max 200. See Architecture Decision #16. |

| Multi-status filter | Comma-separated: `?status=active,expiring`. See `docs/api-doc.md`. |

| Dashboard breakdowns | `departmentBreakdown` and `typeBreakdown` are independent flags; both may be set together (not a cross-tab). See `docs/api-doc.md`. |

| Lifecycle events | One summary event per run with `runId`, `changedRecords[]`. Consumer dedupes by `runId`. See Architecture Decision #7. |

| JWT refresh | No refresh token. Short-lived access token only; re-login on expiry. See Architecture Decision #6. |

| First admin user | Created via seed script (`npm run seed`), not a manual DB insert. See Architecture Decision #6. |

| Employee soft-delete cascade | Archiving an employee cascades to all their compliance records (`archived`) in a single transaction. See Architecture Decision #15. |

| Expiry job fetch strategy | Snapshot-first: paginate GET (`limit=200`) until all pages loaded, then evaluate and PATCH in batches. Fetches `active`/`expiring` only. See Decision #18. |

| Expiry job auth | Service account JWT via login once per run; re-login on 401 and retry that request. No permanent API token. See Decision #19. |

| Expiry job schedule | Daily at 01:00 `Asia/Colombo` via EventBridge Scheduler. See Decision #20. |

| Expiry job retries / idempotency | Exponential backoff on GET/PATCH/EventBridge; failed PATCH batches logged and skipped. Skip when computed status matches current `status`. See Decision #11. |



## Still open / to decide during implementation

- TypeORM migrations vs `synchronize` for local dev (prefer migrations before any shared/production DB)
- EventBridge rule → SQS target wiring (AWS console, CLI, or IaC — not in application code)
- Elastic Beanstalk cost monitoring in deployment (limited free tier)

## Local development setup reminders

- Use LocalStack (or manual mocks) to emulate EventBridge/SQS locally; don't require real AWS credentials for day-to-day development

- Python job should be runnable as a plain script (`python src/main.py`) against a local NestJS instance, no AWS dependency required to test the core expiry logic

- Keep all AWS resource names/endpoints/account IDs in environment variables, never hardcoded, so local and production configs can differ cleanly

- Run MySQL with `--default-time-zone='+00:00'` (or equivalent in RDS parameter group) and set TypeORM `timezone: 'Z'` to ensure all timestamp writes are stored in UTC

- For local expiry testing, pass `COMPLIANCE_EXPIRING_BUFFER_DAYS` and use Sri Lanka date logic explicitly (do not rely on system local timezone)



## Idempotency reminder

- **Record level:** compare computed status to current `status`; skip PATCH when they match.

- **Event level:** Each run publishes one message with a unique `runId`. Consumers ignore duplicate `runId` values to prevent duplicate alerts within the same evaluation window.



## Sri Lanka date comparison rule (expiry job)

The expiry job **must** compare `expiryDate` against the current **Sri Lanka calendar date** (`Asia/Colombo`) — e.g. in Python: `datetime.now(ZoneInfo("Asia/Colombo")).date()`. Do not use `datetime.utcnow().date()` or bare `datetime.now().date()`. This rule applies equally to the NestJS status computation helper.

