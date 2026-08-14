# Repository Guidelines

## Project Overview

Employee Compliance Tracking System. Tracks employee compliance records (visas, certifications, background checks, training) with automated expiry detection and a reporting dashboard.

**Stack (decided, not speculative):**
- Backend API: NestJS, TypeScript, MySQL (AWS RDS Free Tier), TypeORM
- Auth: username/password login via Passport.js (`passport-local` + `passport-jwt`) issuing a JWT
- Scheduled expiry job: Python, calls the NestJS API over HTTP (never accesses MySQL directly); runs locally as a script during development, deployed later as a Lambda behind EventBridge Scheduler
- Messaging: AWS EventBridge and SQS (Free Tier only, no hardcoded account IDs or ARNs), tested locally before wiring up real AWS resources
- Frontend: SvelteKit, TypeScript

Full reasoning for each decision above is in `docs/architecture-decisions.md`, read it before making changes that would contradict these choices. Also see `docs/db-schema.md`, `docs/api-doc.md`, `docs/process-flow.md`, and `docs/notes.md` for schema, endpoints, data flow, and open items.

**Implementation order:** `docs/phases/README.md` (4 phases for tight timeline).

## Project Structure & Module Organization

```
backend/          # NestJS API
  src/
    compliance/            # shared module: compliance-records + employees
      compliance-records/  # ComplianceRecord entity, service, controller
      employees/            # Employee entity, service, controller
    dashboard/             # analytics/reporting endpoints
    auth/                   # Passport local + JWT strategies, login endpoint
    common/                 # shared pipes, guards, DTOs
  test/
expiry-job/        # Python scheduled job
  src/
  tests/
frontend/          # SvelteKit dashboard
  src/
    lib/
      api.ts
      types.ts
      components/
        MetricsCard.svelte
        DateRangeFilter.svelte
        RecordsTable.svelte
        StatusBadge.svelte
    routes/
      login/+page.svelte    # login form
      +page.svelte          # dashboard: metrics + expiring soon list
      +page.ts                # load function, fetches metrics
docs/               # architecture notes, API contracts, trade-off writeups
.env.example        # required config keys, no secrets
```

Keep backend modules domain-focused: `compliance-records`, `employees` (if separated), `dashboard`, `notifications`. Do not mix persistence, business rules, and controllers into a single file.

## Build, Test, and Development Commands

**Backend (NestJS):**
- `npm install`
- `npm run start:dev` — local dev server with watch mode
- `npm run test` — unit tests
- `npm run test:e2e` — end-to-end tests
- `npm run lint` — ESLint/Prettier check

**Expiry job (Python):**
- `pip install -r requirements.txt`
- `python -m pytest` — run tests
- `python src/main.py` — run the job manually for local testing

**Frontend (SvelteKit):**
- `npm install`
- `npm run dev` — local dev server
- `npm run test` — unit tests (Vitest, if configured)
- `npm run lint` — lint check
- `npm run build` — production build

Update this section immediately if any command changes, Codex relies on this being accurate rather than guessing package.json scripts.

## Coding Style & Naming Conventions

- TypeScript (backend and frontend): 2-space indentation, descriptive domain names, e.g. `ComplianceRecord`, `Employee`, `expiryDate`, `ComplianceStatus`, `dashboardMetricsService`.
- TypeORM entities live alongside their module (`compliance-records/compliance-record.entity.ts`, `employees/employee.entity.ts`), keep entity definitions separate from service logic.
- Python: 4-space indentation, `snake_case` for functions/variables, `PascalCase` for classes, follow PEP 8.
- Keep configuration (env vars, AWS resource names) out of business logic files, isolate into a config module.
- No file should mix UI rendering, persistence, and business rules.

## Testing Guidelines

- Backend: place tests beside modules or under `test/`, following NestJS convention (`*.spec.ts` for unit, `*.e2e-spec.ts` for e2e).
- Python: place tests under `expiry-job/tests/`, name by behavior, e.g. `test_expiry_transition.py`, `test_idempotent_run.py`.
- Frontend: colocate component tests or use `src/lib/**/*.test.ts`.

Priority coverage areas:
- Expiry date validation (`expiryDate` must be after `issuedDate`)
- Status transition logic (active ↔ expiring ↔ expired; renewal → `renewed`; manual delete → `archived`)
- Status recalculation on date PATCH (Asia/Colombo calendar date)
- Idempotency of the scheduled job (no duplicate events on rerun)
- Dashboard aggregation correctness
- Soft delete/archive and renewal behavior

Add a regression test for every bug fix.

## Commit Guidelines

Use concise, imperative commit messages, e.g. `Add compliance record validation`, `Fix idempotency check in expiry job`. Scope commits per module where practical (`backend:`, `expiry-job:`, `frontend:` prefixes are welcome but not required). Keep messages clear enough to reconstruct the implementation timeline on their own.

## Security & Configuration Tips

- Never commit secrets, real employee data, or AWS credentials.
- Document all required environment variables in `.env.example` with placeholder values only.
- All AWS resources must stay within Free Tier limits, no hardcoded account IDs, ARNs, or region values in code.
- Treat the soft-delete/archive logic and any audit-relevant fields as sensitive, changes here should be deliberate and documented in `docs/`.

## Notes for Codex

- Prioritize correctness and clear architectural reasoning over speed shortcuts that would need rework later.
- Schema, cron configuration, notification payload structure, and aggregation logic are intentionally left to your (the developer's) judgment. Document decisions in `docs/` as you make them, do not leave reasoning only in commit messages or chat history.
- When implementing the reporting dashboard, follow the live-computed strategy (see `docs/`) unless told otherwise, do not introduce a pre-aggregation table without updating that decision record.
