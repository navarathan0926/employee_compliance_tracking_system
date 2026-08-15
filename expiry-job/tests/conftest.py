import os
from datetime import date

import pytest

from config import Config


@pytest.fixture
def sample_config(tmp_path) -> Config:
    return Config(
        api_base_url="http://localhost:3000/api",
        service_account_username="expiry-job",
        service_account_password="secret",
        compliance_expiring_buffer_days=30,
        compliance_timezone="Asia/Colombo",
        api_request_timeout_seconds=5,
        aws_region="ap-southeast-1",
        eventbridge_bus_name="compliance-events",
        eventbridge_source="compliance.expiry-job",
        eventbridge_detail_type="compliance.expiry-evaluation.completed",
        sqs_queue_name="compliance-lifecycle-events",
        skip_event_publish=True,
        aws_endpoint_url="http://localhost:4566",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        pending_event_path=str(tmp_path / "pending-event.json"),
    )


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in list(os.environ):
        if key.startswith(
            (
                "API_",
                "SERVICE_",
                "COMPLIANCE_",
                "AWS_",
                "EVENTBRIDGE_",
                "SQS_",
                "SKIP_EVENT_",
                "PENDING_EVENT_",
            )
        ):
            monkeypatch.delenv(key, raising=False)
