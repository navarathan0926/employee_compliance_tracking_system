from __future__ import annotations

from datetime import datetime

import pytest

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from evaluator import StatusUpdate
from event_publisher import (
    build_event_payload,
    clear_pending_event,
    load_pending_event,
    pending_event_file,
    publish_event,
    republish_pending_event,
    save_pending_event,
)


def test_build_event_payload_matches_decision_7_schema(sample_config) -> None:
    updates = [
        StatusUpdate(id=101, new_status="expiring", previous_status="active"),
        StatusUpdate(id=205, new_status="expired", previous_status="expiring"),
    ]
    reference = datetime(2026, 8, 14, 1, 0, 5, tzinfo=ZoneInfo("Asia/Colombo"))

    payload = build_event_payload(
        sample_config,
        run_id="run-123",
        evaluation_date="2026-08-14",
        successful_updates=updates,
        reference_time=reference,
    )

    assert payload.to_dict() == {
        "eventType": "compliance.expiry-evaluation.completed",
        "runId": "run-123",
        "evaluationDate": "2026-08-14",
        "timezone": "Asia/Colombo",
        "expiringCount": 1,
        "expiredCount": 1,
        "changedRecords": [
            {"id": 101, "previousStatus": "active", "newStatus": "expiring"},
            {"id": 205, "previousStatus": "expiring", "newStatus": "expired"},
        ],
        "timestamp": "2026-08-14T01:00:05+05:30",
    }


def test_publish_event_skips_when_flag_enabled(sample_config, mocker) -> None:
    payload = build_event_payload(
        sample_config,
        run_id="run-123",
        evaluation_date="2026-08-14",
        successful_updates=[],
    )
    mock_boto = mocker.patch("event_publisher.boto3.client")

    publish_event(sample_config, payload)

    mock_boto.assert_not_called()


def test_events_client_uses_default_credentials_on_lambda(sample_config, mocker) -> None:
    config = sample_config.__class__(
        **{
            **sample_config.__dict__,
            "skip_event_publish": False,
            "aws_endpoint_url": None,
            "aws_access_key_id": "ASIAEXAMPLE",
            "aws_secret_access_key": "secret",
        }
    )
    mock_client = mocker.Mock()
    mock_boto = mocker.patch("event_publisher.boto3.client", return_value=mock_client)
    mock_client.put_events.return_value = {"FailedEntryCount": 0}
    payload = build_event_payload(
        config,
        run_id="run-123",
        evaluation_date="2026-08-14",
        successful_updates=[],
    )

    publish_event(config, payload)

    kwargs = mock_boto.call_args.kwargs
    assert "aws_access_key_id" not in kwargs
    assert "aws_secret_access_key" not in kwargs
    assert "endpoint_url" not in kwargs


def test_publish_event_puts_events(sample_config, mocker) -> None:
    config = sample_config.__class__(
        **{
            **sample_config.__dict__,
            "skip_event_publish": False,
        }
    )
    payload = build_event_payload(
        config,
        run_id="run-123",
        evaluation_date="2026-08-14",
        successful_updates=[],
    )
    mock_client = mocker.Mock()
    mock_client.put_events.return_value = {"FailedEntryCount": 0}
    mocker.patch("event_publisher.boto3.client", return_value=mock_client)

    publish_event(config, payload)

    mock_client.put_events.assert_called_once()
    entry = mock_client.put_events.call_args.kwargs["Entries"][0]
    assert entry["Source"] == "compliance.expiry-job"
    assert entry["DetailType"] == "compliance.expiry-evaluation.completed"
    assert entry["EventBusName"] == "compliance-events"


def test_publish_event_retries_then_succeeds(sample_config, mocker) -> None:
    config = sample_config.__class__(
        **{**sample_config.__dict__, "skip_event_publish": False}
    )
    payload = build_event_payload(
        config,
        run_id="run-123",
        evaluation_date="2026-08-14",
        successful_updates=[],
    )
    mock_client = mocker.Mock()
    mock_client.put_events.side_effect = [
        {"FailedEntryCount": 1},
        {"FailedEntryCount": 0},
    ]
    mocker.patch("event_publisher.boto3.client", return_value=mock_client)
    mocker.patch("event_publisher.time.sleep")

    publish_event(config, payload)

    assert mock_client.put_events.call_count == 2


def test_publish_event_raises_after_retry_exhaustion(sample_config, mocker) -> None:
    from botocore.exceptions import BotoCoreError

    config = sample_config.__class__(
        **{**sample_config.__dict__, "skip_event_publish": False}
    )
    payload = build_event_payload(
        config,
        run_id="run-123",
        evaluation_date="2026-08-14",
        successful_updates=[],
    )
    mock_client = mocker.Mock()
    mock_client.put_events.side_effect = BotoCoreError()
    mocker.patch("event_publisher.boto3.client", return_value=mock_client)
    mocker.patch("event_publisher.time.sleep")

    with pytest.raises(RuntimeError, match="after retries"):
        publish_event(config, payload)

    assert mock_client.put_events.call_count == 4
    pending = load_pending_event(config)
    assert pending is not None
    assert pending.run_id == "run-123"


def test_publish_event_clears_pending_file_after_success(sample_config, mocker) -> None:
    config = sample_config.__class__(
        **{**sample_config.__dict__, "skip_event_publish": False}
    )
    payload = build_event_payload(
        config,
        run_id="run-123",
        evaluation_date="2026-08-14",
        successful_updates=[],
    )
    mock_client = mocker.Mock()
    mock_client.put_events.return_value = {"FailedEntryCount": 0}
    mocker.patch("event_publisher.boto3.client", return_value=mock_client)

    publish_event(config, payload)

    assert load_pending_event(config) is None
    assert not pending_event_file(config).exists()


def test_republish_pending_event_sends_same_run_id(sample_config, mocker) -> None:
    config = sample_config.__class__(
        **{**sample_config.__dict__, "skip_event_publish": False}
    )
    updates = [
        StatusUpdate(id=101, new_status="expired", previous_status="expiring"),
    ]
    payload = build_event_payload(
        config,
        run_id="run-original",
        evaluation_date="2026-08-14",
        successful_updates=updates,
    )
    save_pending_event(config, payload)

    mock_client = mocker.Mock()
    mock_client.put_events.return_value = {"FailedEntryCount": 0}
    mocker.patch("event_publisher.boto3.client", return_value=mock_client)

    republish_pending_event(config)

    entry = mock_client.put_events.call_args.kwargs["Entries"][0]
    assert '"runId": "run-original"' in entry["Detail"]
    assert '"newStatus": "expired"' in entry["Detail"]
    assert load_pending_event(config) is None


def test_run_republishes_pending_event_before_new_evaluation(sample_config, mocker) -> None:
    from datetime import date

    from main import run_expiry_job

    config = sample_config.__class__(
        **{**sample_config.__dict__, "skip_event_publish": False}
    )
    pending_payload = build_event_payload(
        config,
        run_id="run-original",
        evaluation_date="2026-08-14",
        successful_updates=[
            StatusUpdate(id=205, new_status="expired", previous_status="expiring"),
        ],
    )
    save_pending_event(config, pending_payload)

    client = mocker.Mock()
    client.login.return_value = None
    client.fetch_all_active_expiring.return_value = []
    mocker.patch("main.ApiClient", return_value=client)
    mocker.patch("main.get_today_in_timezone", return_value=date(2026, 8, 14))

    mock_client = mocker.Mock()
    mock_client.put_events.return_value = {"FailedEntryCount": 0}
    mocker.patch("event_publisher.boto3.client", return_value=mock_client)

    result = run_expiry_job(config)

    assert mock_client.put_events.call_count == 2
    first_detail = mock_client.put_events.call_args_list[0].kwargs["Entries"][0]["Detail"]
    second_detail = mock_client.put_events.call_args_list[1].kwargs["Entries"][0]["Detail"]
    assert '"runId": "run-original"' in first_detail
    assert result.run_id != "run-original"
    assert f'"runId": "{result.run_id}"' in second_detail
    client.bulk_status_update.assert_not_called()
    assert load_pending_event(config) is None
    clear_pending_event(config)
