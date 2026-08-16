# GitHub Actions OIDC setup for AWS deploys
#
# 1. AWS IAM → Identity providers → Add OpenID Connect provider
#    - Provider URL: https://token.actions.githubusercontent.com
#    - Audience: sts.amazonaws.com
#
# 2. Create IAM role with trust policy for your GitHub repo:
#    - repo:YOUR_ORG/employee_compliance_tracking_system:ref:refs/heads/main
#
# 3. Attach policies (least privilege):
#    - elasticbeanstalk:* (or scoped deploy actions)
#    - lambda:UpdateFunctionCode on specific function
#    - (optional) rds/connect for migrate workflow from runner with network access
#
# 4. GitHub repo settings → Secrets and variables → Actions:
#    Secret:  AWS_ROLE_ARN=arn:aws:iam::ACCOUNT:role/github-actions-deploy
#    Var:     EB_APP_NAME=compliance-tracking-api
#    Var:     EB_ENV_NAME=compliance-tracking-api-prod
#    Var:     LAMBDA_FUNCTION_NAME=compliance-expiry-job
#    Var:     RUN_SEED=true  (migrate workflow only, first run)
#
# 5. Migration workflow secrets (optional):
#    DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD,
#    DATABASE_NAME, JWT_SECRET, SEED_ADMIN_*, SEED_SERVICE_*
