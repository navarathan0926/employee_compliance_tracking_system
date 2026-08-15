from __future__ import annotations

import pytest

from scripts.bootstrap_localstack import RULE_NAME, bootstrap


def test_bootstrap_creates_bus_queue_rule_and_target(mocker) -> None:
    mock_events = mocker.Mock()
    mock_events.put_targets.return_value = {"FailedEntryCount": 0}
    mock_sqs = mocker.Mock()
    mock_sqs.create_queue.return_value = {
        "QueueUrl": "http://localhost:4566/000000000000/compliance-lifecycle-events"
    }

    mock_config = mocker.Mock(
        aws_region="ap-southeast-1",
        aws_endpoint_url="http://localhost:4566",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        eventbridge_bus_name="compliance-events",
        eventbridge_source="compliance.expiry-job",
        eventbridge_detail_type="compliance.expiry-evaluation.completed",
        sqs_queue_name="compliance-lifecycle-events",
    )
    mocker.patch("scripts.bootstrap_localstack.load_config", return_value=mock_config)

    def fake_client(service, config):
        if service == "events":
            return mock_events
        if service == "sqs":
            return mock_sqs
        raise ValueError(service)

    mocker.patch("scripts.bootstrap_localstack._client", side_effect=fake_client)

    bootstrap()

    mock_events.create_event_bus.assert_called_once_with(Name="compliance-events")
    mock_sqs.create_queue.assert_called_once_with(QueueName="compliance-lifecycle-events")
    mock_events.put_rule.assert_called_once()
    assert mock_events.put_rule.call_args.kwargs["Name"] == RULE_NAME
    mock_events.put_targets.assert_called_once()


def test_bootstrap_ignores_existing_event_bus(mocker) -> None:
    from botocore.exceptions import ClientError

    mock_events = mocker.Mock()
    mock_events.create_event_bus.side_effect = ClientError(
        {"Error": {"Code": "ResourceAlreadyExistsException", "Message": "exists"}},
        "CreateEventBus",
    )
    mock_events.put_targets.return_value = {"FailedEntryCount": 0}
    mock_sqs = mocker.Mock()
    mock_sqs.create_queue.return_value = {"QueueUrl": "http://example/queue"}

    mock_config = mocker.Mock(
        aws_region="ap-southeast-1",
        aws_endpoint_url="http://localhost:4566",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        eventbridge_bus_name="compliance-events",
        eventbridge_source="compliance.expiry-job",
        eventbridge_detail_type="compliance.expiry-evaluation.completed",
        sqs_queue_name="compliance-lifecycle-events",
    )
    mocker.patch("scripts.bootstrap_localstack.load_config", return_value=mock_config)
    mocker.patch(
        "scripts.bootstrap_localstack._client",
        side_effect=lambda service, config: mock_events if service == "events" else mock_sqs,
    )

    bootstrap()

    mock_events.put_rule.assert_called_once()
    mock_events.put_targets.assert_called_once()
