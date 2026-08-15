from __future__ import annotations

import pytest
import requests

from api_client import ApiClient, ApiClientError
from config import Config


def _config() -> Config:
    return Config(
        api_base_url="http://example.com/api",
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
        aws_endpoint_url=None,
        aws_access_key_id=None,
        aws_secret_access_key=None,
    )


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text or str(payload)
        self.content = b"{}" if payload is None else b"1"

    def json(self) -> dict:
        return self._payload


def test_login_stores_access_token(mocker) -> None:
    client = ApiClient(_config())
    mocker.patch.object(
        client._session,
        "request",
        return_value=FakeResponse(200, {"accessToken": "token-123"}),
    )

    client.login()

    assert client._access_token == "token-123"


def test_fetch_all_active_expiring_paginates(mocker) -> None:
    client = ApiClient(_config())
    client._access_token = "token-123"

    responses = [
        FakeResponse(
            200,
            {
                "data": [{"id": 1, "status": "active", "expiryDate": "2026-09-01"}],
                "total": 2,
                "limit": 200,
                "offset": 0,
            },
        ),
        FakeResponse(
            200,
            {
                "data": [{"id": 2, "status": "expiring", "expiryDate": "2026-08-20"}],
                "total": 2,
                "limit": 200,
                "offset": 1,
            },
        ),
    ]
    mocker.patch.object(client._session, "request", side_effect=responses)

    records = client.fetch_all_active_expiring()

    assert len(records) == 2
    assert records[0]["id"] == 1
    assert records[1]["id"] == 2


def test_relogin_on_401_and_retry_once(mocker) -> None:
    client = ApiClient(_config())
    client._access_token = "expired-token"

    responses = [
        FakeResponse(401),
        FakeResponse(200, {"accessToken": "fresh-token"}),
        FakeResponse(200, {"data": [], "total": 0}),
    ]
    mocker.patch.object(client._session, "request", side_effect=responses)

    records = client.fetch_all_active_expiring()

    assert records == []
    assert client._access_token == "fresh-token"


def test_bulk_status_update_requires_non_empty_batch() -> None:
    client = ApiClient(_config())

    with pytest.raises(ValueError):
        client.bulk_status_update([])


def test_raises_after_retry_exhaustion(mocker) -> None:
    client = ApiClient(_config())
    mocker.patch.object(
        client._session,
        "request",
        side_effect=requests.Timeout("timeout"),
    )

    with pytest.raises(ApiClientError):
        client._request_without_auth("POST", "/auth/login", json={"username": "a", "password": "b"})
