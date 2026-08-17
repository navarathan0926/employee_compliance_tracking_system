# CloudFront setup for EB single-instance API (HTTPS without ALB)
#
# INTENDED path (Decision #24). BLOCKED on this AWS account until Support verifies it:
#   "Your account must be verified before you can add new CloudFront resources."
#
# Workaround in use: API Gateway HTTP API as HTTPS proxy — see api-gateway.md
#
# Manual steps (ap-southeast-1 for EB origin, us-east-1 for ACM if using custom domain):
#
# 1. Create CloudFront distribution
#    - Origin: EB environment URL (http://your-env.ap-southeast-1.elasticbeanstalk.com)
#    - Origin protocol: HTTP only (EB single instance on port 80)
#    - Viewer protocol policy: Redirect HTTP to HTTPS
#    - Allowed HTTP methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
#    - Cache policy: CachingDisabled (Managed-CachingDisabled)
#    - Origin request policy: AllViewerExceptHostHeader (or AllViewer)
#
# 2. Use the CloudFront domain (e.g. d1234abcd.cloudfront.net) as:
#    - PUBLIC_API_BASE_URL=https://d1234abcd.cloudfront.net/api
#    - API_BASE_URL (Lambda)
#
# 3. Update backend CORS_ALLOWED_ORIGINS with Amplify URL
#
# Optional custom domain:
#    - Request ACM certificate in us-east-1 (required for CloudFront custom domains)
#    - Attach to CloudFront alternate domain name (CNAME)
