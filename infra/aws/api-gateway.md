# API Gateway HTTP API in front of EB (HTTPS without ALB / CloudFront)

Used for this assessment because CloudFront creation is blocked until the AWS account is verified
(`Your account must be verified before you can add new CloudFront resources`).

API Gateway is a TLS proxy only. It is not used for auth, throttling, or a Lambda integration.
See Architecture Decision #24.

## Console steps (ap-southeast-1)

1. API Gateway → Create **HTTP API** (not REST API).
2. Add HTTP integration:
   - Method: ANY (or catch-all)
   - URL: Elastic Beanstalk HTTP origin, e.g.
     `http://compliance-tracking-api-env.eba-xxxx.ap-southeast-1.elasticbeanstalk.com`
3. Routes: `ANY /{proxy+}` (and `ANY /` if needed) so `/api/*` is forwarded.
4. Stage: `$default` (auto-deploy) is enough for demo.
5. Invoke URL looks like:
   `https://6dwo549x25.execute-api.ap-southeast-1.amazonaws.com`

## Point clients at this URL

Include the `/api` suffix:

- Amplify `PUBLIC_API_BASE_URL=https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/api`
- Lambda `API_BASE_URL` — same value
- Backend `CORS_ALLOWED_ORIGINS` — Amplify origin only (not the API Gateway URL)

Example login:

`https://6dwo549x25.execute-api.ap-southeast-1.amazonaws.com/api/auth/login`

## Notes

- EB itself stays HTTP on port 80 (single instance, no ALB). Clients never call EB directly.
- Do not enable API Gateway usage plans / WAF for this demo. Rate limits stay in NestJS (`@nestjs/throttler`).
- If CloudFront becomes available later, replace this proxy and update Amplify + Lambda base URLs. Keep EB as origin.
