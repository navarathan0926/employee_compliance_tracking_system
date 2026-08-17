# Amplify Hosting setup (frontend)
#
# 1. AWS Amplify Console → New app → Host web app
# 2. Connect GitHub repository, branch: main
# 3. Monorepo: set app root to frontend/
# 4. Build settings: use amplify.yml at repo root (already configured)
# 5. Environment variables (build time):
#      PUBLIC_API_BASE_URL=https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/api
#      (intended: CloudFront domain; this account uses API Gateway — see api-gateway.md)
# 6. Deploy — Amplify provides HTTPS URL (e.g. https://main.xxxxx.amplifyapp.com)
# 7. Update backend CORS_ALLOWED_ORIGINS with Amplify URL → redeploy EB
#
# Amplify auto-builds on every push to main; no separate GitHub deploy workflow required.
