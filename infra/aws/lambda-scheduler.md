# Lambda + EventBridge Scheduler setup
#
# 1. Build deployment package:
#    cd expiry-job
#    ./scripts/build-lambda.sh   (or build-lambda.ps1 on Windows)
#
# 2. Create Lambda function (ap-southeast-1):
#    - Runtime: Python 3.11+
#    - Handler: lambda_handler.handler
#    - Timeout: 900 seconds (15 min)
#    - Memory: 512 MB
#    - Upload: build/expiry-job-lambda.zip
#
# 3. Environment variables: copy from expiry-job/.env.production
#
# 4. IAM execution role (least privilege):
#    - logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents
#    - events:PutEvents on arn:aws:events:ap-southeast-1:ACCOUNT:event-bus/compliance-events
#
# 5. EventBridge Scheduler (ap-southeast-1):
#    - Schedule: cron(0 1 * * ? *)
#    - Timezone: Asia/Colombo
#    - Target: Lambda function ARN
#    - Retry policy: default
