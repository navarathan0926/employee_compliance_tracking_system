# Tomorrow checklist (submit day)

Live app is already deployed. Do **not** wait on CI/CD for the 1am job.

## 1. After the 1am job (Asia/Colombo, 17 Aug 2026)

Postman — environment **Compliance Tracking - Production**:

1. [ ] **Auth → Login** (token may have expired)
2. [ ] **After 1am Job → Get Metrics (after job)** — compare with last night's baseline
3. [ ] **After 1am Job → Verify JOB-TEST Transitions** — all 5 tests must pass

Expected after job:

| Tag | Employee | Must be |
|-----|----------|---------|
| JOB-TEST-A | Amara Perera visa (expiry 2026-08-16) | `expired` |
| JOB-TEST-B | Rajesh Kumar background_check (expiry 2026-09-16) | `expiring` |
| JOB-TEST-C | Nimali Fernando | `expired` (unchanged) |
| JOB-TEST-D | Priya Sivan | `expiring` (unchanged) |
| JOB-TEST-E | Marcus Silva | `active` (unchanged) |

4. [ ] SQS `compliance-lifecycle-events` — new message with `evaluationDate: "2026-08-17"` and **2** changed records (A and B)
5. [ ] Optional: Amplify dashboard shows the same statuses

If Verify fails: Lambda CloudWatch logs, Scheduler last invoke, Lambda env `API_BASE_URL` (must be API Gateway HTTPS `/api`).

## 2. Remaining smoke tests

See `docs/phases/phase-4-smoke-test.md`.

- [ ] Login throttle: 6 rapid wrong-password `POST /auth/login` → 6th returns `429`
- [ ] EventBridge Scheduler still **ENABLED**, cron `0 1 * * ? *`, timezone `Asia/Colombo`

Already done: frontend login, Lambda manual invoke 200, SQS Decision #7 payload.

## 3. GitHub Actions CI/CD (not needed for the 1am job)

Workflows deploy with an IAM user (not OIDC). Guide: `infra/aws/github-oidc.md`

### AWS

- [ ] IAM user (e.g. `github-actions-deploy`) with EB + Lambda deploy permissions
- [ ] Create access key (CLI / programmatic)

### GitHub → Settings → Secrets and variables → Actions

**Secrets**

| Name | Value |
|------|--------|
| `AWS_ACCESS_KEY_ID` | IAM user access key ID |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret access key |

**Variables** (use names from the AWS console)

| Name | Example / likely value |
|------|------------------------|
| `EB_APP_NAME` | `compliance-tracking-api` |
| `EB_ENV_NAME` | `compliance-tracking-api-env` |
| `LAMBDA_FUNCTION_NAME` | `python-expiry-job` |

Skip `DATABASE_*` / `SEED_*` unless you run `migrate.yml`. RDS is already migrated.

### Then

- [ ] Commit and push remaining local changes to `main` (Postman files, docs, expiry-job EventBridge credential fix, `amplify.yml` if not pushed)
- [ ] Confirm `ci.yml` is green
- [ ] If `backend/**` or `expiry-job/**` changed, confirm EB / Lambda deploy workflows succeed
- [ ] Amplify rebuilds frontend automatically on `main`

## 4. Optional later

- [ ] Switch HTTPS front from API Gateway to CloudFront if AWS Support verifies the account (see Architecture Decision #24)
