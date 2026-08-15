"""Bootstrap LocalStack EventBridge bus, SQS queue, rule, and target.

Idempotent: safe to re-run after LocalStack restarts or on a fresh container.
Reads config from expiry-job/.env via load_config().
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import boto3
from botocore.exceptions import ClientError

from config import load_config

logger = logging.getLogger(__name__)

RULE_NAME = "compliance-expiry-completed"
LOCALSTACK_ACCOUNT_ID = "000000000000"


def _client(service: str, config):
    kwargs: dict = {"region_name": config.aws_region}
    if config.aws_endpoint_url:
        kwargs["endpoint_url"] = config.aws_endpoint_url
    if config.aws_access_key_id and config.aws_secret_access_key:
        kwargs["aws_access_key_id"] = config.aws_access_key_id
        kwargs["aws_secret_access_key"] = config.aws_secret_access_key
    return boto3.client(service, **kwargs)


def _create_event_bus(events, bus_name: str) -> None:
    try:
        events.create_event_bus(Name=bus_name)
        logger.info("Created event bus: %s", bus_name)
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code == "ResourceAlreadyExistsException":
            logger.info("Event bus already exists: %s", bus_name)
            return
        raise


def _create_queue(sqs, queue_name: str) -> str:
    response = sqs.create_queue(QueueName=queue_name)
    queue_url = response["QueueUrl"]
    logger.info("SQS queue ready: %s", queue_url)
    return queue_url


def _create_rule(events, config) -> None:
    event_pattern = (
        '{"source":["'
        + config.eventbridge_source
        + '"],"detail-type":["'
        + config.eventbridge_detail_type
        + '"]}'
    )
    events.put_rule(
        Name=RULE_NAME,
        EventBusName=config.eventbridge_bus_name,
        EventPattern=event_pattern,
        State="ENABLED",
    )
    logger.info("EventBridge rule ready: %s", RULE_NAME)


def _wire_rule_to_queue(events, config) -> None:
    queue_arn = (
        f"arn:aws:sqs:{config.aws_region}:{LOCALSTACK_ACCOUNT_ID}:"
        f"{config.sqs_queue_name}"
    )
    response = events.put_targets(
        Rule=RULE_NAME,
        EventBusName=config.eventbridge_bus_name,
        Targets=[{"Id": "1", "Arn": queue_arn}],
    )
    failed = int(response.get("FailedEntryCount", 0))
    if failed:
        raise RuntimeError(f"Failed to attach SQS target ({failed} failures)")
    logger.info("Rule target wired to queue: %s", config.sqs_queue_name)


def bootstrap() -> None:
    config = load_config()
    if not config.aws_endpoint_url:
        raise ValueError(
            "AWS_ENDPOINT_URL is required for LocalStack bootstrap "
            "(e.g. http://localhost:4566)"
        )

    events = _client("events", config)
    sqs = _client("sqs", config)

    _create_event_bus(events, config.eventbridge_bus_name)
    _create_queue(sqs, config.sqs_queue_name)
    _create_rule(events, config)
    _wire_rule_to_queue(events, config)

    logger.info("LocalStack bootstrap complete")


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        bootstrap()
    except (ClientError, RuntimeError, ValueError) as error:
        logger.error("Bootstrap failed: %s", error)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
