from __future__ import annotations

import json
import logging
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

from config import RETRY_DELAYS_SECONDS, Config
from evaluator import StatusUpdate

logger = logging.getLogger(__name__)
DEFAULT_PENDING_EVENT_NAME = "compliance-expiry-pending-event.json"


@dataclass(frozen=True)
class EventPayload:
    event_type: str
    run_id: str
    evaluation_date: str
    timezone: str
    expiring_count: int
    expired_count: int
    changed_records: list[dict[str, int | str]]
    timestamp: str

    def to_dict(self) -> dict:
        return {
            "eventType": self.event_type,
            "runId": self.run_id,
            "evaluationDate": self.evaluation_date,
            "timezone": self.timezone,
            "expiringCount": self.expiring_count,
            "expiredCount": self.expired_count,
            "changedRecords": self.changed_records,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: dict) -> EventPayload:
        return cls(
            event_type=data["eventType"],
            run_id=data["runId"],
            evaluation_date=data["evaluationDate"],
            timezone=data["timezone"],
            expiring_count=int(data["expiringCount"]),
            expired_count=int(data["expiredCount"]),
            changed_records=list(data["changedRecords"]),
            timestamp=data["timestamp"],
        )


def build_event_payload(
    config: Config,
    run_id: str,
    evaluation_date: str,
    successful_updates: list[StatusUpdate],
    reference_time: datetime | None = None,
) -> EventPayload:
    changed_records = [
        {
            "id": update.id,
            "previousStatus": update.previous_status,
            "newStatus": update.new_status,
        }
        for update in successful_updates
    ]

    # Counts reflect transitions in changedRecords where newStatus is expiring/expired.
    expiring_count = sum(
        1 for record in changed_records if record["newStatus"] == "expiring"
    )
    expired_count = sum(
        1 for record in changed_records if record["newStatus"] == "expired"
    )

    current = reference_time or datetime.now(ZoneInfo(config.compliance_timezone))
    timestamp = current.isoformat(timespec="seconds")

    return EventPayload(
        event_type=config.eventbridge_detail_type,
        run_id=run_id,
        evaluation_date=evaluation_date,
        timezone=config.compliance_timezone,
        expiring_count=expiring_count,
        expired_count=expired_count,
        changed_records=changed_records,
        timestamp=timestamp,
    )


def _build_events_client(config: Config):
    client_kwargs: dict = {"region_name": config.aws_region}
    if config.aws_endpoint_url:
        # LocalStack / custom endpoint only. On Lambda, AWS_ACCESS_KEY_ID is
        # always set by the runtime; passing key+secret without AWS_SESSION_TOKEN
        # causes UnrecognizedClientException.
        client_kwargs["endpoint_url"] = config.aws_endpoint_url
        if config.aws_access_key_id and config.aws_secret_access_key:
            client_kwargs["aws_access_key_id"] = config.aws_access_key_id
            client_kwargs["aws_secret_access_key"] = config.aws_secret_access_key

    timeout = config.api_request_timeout_seconds
    client_kwargs["config"] = BotoConfig(
        connect_timeout=timeout,
        read_timeout=timeout,
        retries={"max_attempts": 0},
    )
    return boto3.client("events", **client_kwargs)


def _put_events_with_retry(client, entries: list[dict]) -> dict:
    last_error: Exception | None = None

    for attempt, delay in enumerate([0, *RETRY_DELAYS_SECONDS]):
        if delay:
            time.sleep(delay)

        try:
            response = client.put_events(Entries=entries)
            failed = int(response.get("FailedEntryCount", 0))
            if failed:
                raise RuntimeError(f"EventBridge publish failed for {failed} entries")
            return response
        except (BotoCoreError, ClientError, RuntimeError) as error:
            last_error = error
            if attempt == len(RETRY_DELAYS_SECONDS):
                break
            logger.warning(
                "EventBridge publish failed (attempt %s): %s",
                attempt + 1,
                error,
            )

    raise RuntimeError(f"EventBridge publish failed after retries: {last_error}")


def pending_event_file(config: Config) -> Path:
    if config.pending_event_path:
        return Path(config.pending_event_path)
    return Path(tempfile.gettempdir()) / DEFAULT_PENDING_EVENT_NAME


def save_pending_event(config: Config, payload: EventPayload) -> None:
    path = pending_event_file(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(path.name + ".tmp")
    tmp_path.write_text(json.dumps(payload.to_dict()), encoding="utf-8")
    tmp_path.replace(path)


def load_pending_event(config: Config) -> EventPayload | None:
    path = pending_event_file(config)
    if not path.is_file():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Pending event file must contain a JSON object")
        return EventPayload.from_dict(data)
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        raise RuntimeError(f"Failed to read pending event at {path}: {error}") from error


def clear_pending_event(config: Config) -> None:
    pending_event_file(config).unlink(missing_ok=True)


def republish_pending_event(config: Config) -> None:
    if config.skip_event_publish:
        return

    pending = load_pending_event(config)
    if pending is None:
        return

    logger.info("Publishing pending event from previous run runId=%s", pending.run_id)
    publish_event(config, pending)


def publish_event(config: Config, payload: EventPayload) -> None:
    if config.skip_event_publish:
        logger.info("SKIP_EVENT_PUBLISH=true; skipping EventBridge publish")
        return

    save_pending_event(config, payload)

    try:
        client = _build_events_client(config)
        detail = json.dumps(payload.to_dict())
        entries = [
            {
                "Source": config.eventbridge_source,
                "DetailType": config.eventbridge_detail_type,
                "Detail": detail,
                "EventBusName": config.eventbridge_bus_name,
            }
        ]
        _put_events_with_retry(client, entries)
    except (BotoCoreError, ClientError, RuntimeError):
        logger.error(
            "EventBridge publish failed; pending event retained at %s runId=%s",
            pending_event_file(config),
            payload.run_id,
        )
        raise

    clear_pending_event(config)
    logger.info("Published expiry evaluation event runId=%s", payload.run_id)
