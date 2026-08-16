# Production smoke test checklist

Run after all AWS resources are deployed in `ap-southeast-1`.

## Prerequisites

- [ ] RDS migrated and seeded (`npm run migration:run`, `npm run seed`)
- [ ] EB single instance running with env vars from `backend/.env.production`
- [ ] CloudFront distribution pointing at EB (HTTPS API URL)
- [ ] Amplify frontend built from `main` with `PUBLIC_API_BASE_URL` set to CloudFront API URL
- [ ] Backend `CORS_ALLOWED_ORIGINS` set to Amplify URL
- [ ] Lambda deployed with env from `expiry-job/.env.production`
- [ ] EventBridge Scheduler enabled: `cron(0 1 * * ? *)`, timezone `Asia/Colombo`
- [ ] EventBridge bus + SQS rule configured

## Tests

1. **Frontend login**
   - Open Amplify URL
   - Login as admin
   - Dashboard loads metrics and expiring records

2. **Lambda manual invoke**
   - AWS Console → Lambda → Test
   - Confirm HTTP 200 response with `runId`, counts

3. **API status updates**
   - Verify compliance record statuses changed (if seed data has near-expiry records)

4. **SQS message (Decision #7)**
   - Poll `compliance-lifecycle-events` queue
   - Confirm payload fields: `eventType`, `runId`, `evaluationDate`, `timezone`, `expiringCount`, `expiredCount`, `changedRecords`, `timestamp`

5. **Login throttle**
   - Send 6 rapid `POST /auth/login` requests with wrong password from same IP
   - 6th request should return `429 Too Many Requests`

6. **Scheduler**
   - Confirm EventBridge Scheduler target is Lambda and rule is ENABLED
