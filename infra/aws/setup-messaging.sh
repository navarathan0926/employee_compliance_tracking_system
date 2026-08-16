# AWS infrastructure setup (ap-southeast-1)
#
# Run these commands once after configuring AWS CLI credentials.
# Replace placeholder values before running.
#
# Prerequisites:
#   - AWS CLI v2 configured for ap-southeast-1
#   - EB environment already created (single instance)
#   - See docs/phases/phase-4-deployment.md for full walkthrough

set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
EVENTBRIDGE_BUS_NAME="${EVENTBRIDGE_BUS_NAME:-compliance-events}"
SQS_QUEUE_NAME="${SQS_QUEUE_NAME:-compliance-lifecycle-events}"
RULE_NAME="${RULE_NAME:-compliance-expiry-completed}"

echo "Creating EventBridge bus: ${EVENTBRIDGE_BUS_NAME}"
aws events create-event-bus \
  --name "${EVENTBRIDGE_BUS_NAME}" \
  --region "${AWS_REGION}" || true

echo "Creating SQS queue: ${SQS_QUEUE_NAME}"
QUEUE_URL="$(aws sqs create-queue \
  --queue-name "${SQS_QUEUE_NAME}" \
  --region "${AWS_REGION}" \
  --query 'QueueUrl' \
  --output text)"

QUEUE_ARN="$(aws sqs get-queue-attributes \
  --queue-url "${QUEUE_URL}" \
  --attribute-names QueueArn \
  --region "${AWS_REGION}" \
  --query 'Attributes.QueueArn' \
  --output text)"

echo "Creating EventBridge rule: ${RULE_NAME}"
aws events put-rule \
  --name "${RULE_NAME}" \
  --event-bus-name "${EVENTBRIDGE_BUS_NAME}" \
  --event-pattern '{"source":["compliance.expiry-job"],"detail-type":["compliance.expiry-evaluation.completed"]}' \
  --region "${AWS_REGION}"

aws events put-targets \
  --rule "${RULE_NAME}" \
  --event-bus-name "${EVENTBRIDGE_BUS_NAME}" \
  --targets "Id=1,Arn=${QUEUE_ARN}" \
  --region "${AWS_REGION}"

echo "Infrastructure bootstrap complete."
echo "SQS Queue URL: ${QUEUE_URL}"
echo "Next: configure SQS policy to allow EventBridge SendMessage (see phase-4-deployment.md)."
