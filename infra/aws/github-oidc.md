# GitHub Actions AWS deploy credentials
#
# Current approach: IAM user access keys (OIDC is optional follow-up).
#
# 1. IAM → Users → Create user (e.g. github-actions-deploy)
#    Attach:
#      - AdministratorAccess-AWSElasticBeanstalk
#      - AWSLambda_FullAccess
#
# 2. Create access key (CLI / programmatic). Copy Access key ID + Secret.
#
# 3. GitHub repo → Settings → Secrets and variables → Actions:
#    Secrets:
#      AWS_ACCESS_KEY_ID=AKIA...
#      AWS_SECRET_ACCESS_KEY=...
#    Variables:
#      EB_APP_NAME=compliance-tracking-api
#      EB_ENV_NAME=Compliance-tracking-api-env
#      LAMBDA_FUNCTION_NAME=python-expiry-job
#      RUN_SEED=true  (migrate workflow only, first run)
#
# 4. Migration workflow secrets (optional):
#    DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD,
#    DATABASE_NAME, JWT_SECRET, SEED_ADMIN_*, SEED_SERVICE_*
#
# OIDC (not used by current workflows):
#    Provider URL: https://token.actions.githubusercontent.com
#    Audience: sts.amazonaws.com
#    Role trust: repo:OWNER/employee_compliance_tracking_system:ref:refs/heads/main
