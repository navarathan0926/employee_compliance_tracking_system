from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

FETCH_PAGE_SIZE = 200
PATCH_BATCH_SIZE = 200
RETRY_DELAYS_SECONDS = [1, 2, 4]
LOCAL_API_HOSTS = {"localhost", "127.0.0.1", "::1"}


@dataclass(frozen=True)
class Config:
    api_base_url: str
    service_account_username: str
    service_account_password: str
    compliance_expiring_buffer_days: int
    compliance_timezone: str
    api_request_timeout_seconds: int
    aws_region: str
    eventbridge_bus_name: str
    eventbridge_source: str
    eventbridge_detail_type: str
    sqs_queue_name: str
    skip_event_publish: bool
    aws_endpoint_url: str | None
    aws_access_key_id: str | None
    aws_secret_access_key: str | None
    pending_event_path: str | None = None


def _require(name: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise ValueError(f"Missing required environment variable: {name}")
    return value.strip()


def _optional(name: str) -> str | None:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return None
    return value.strip()


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def require_secure_api_base_url(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme == "https" and host:
        return url
    if parsed.scheme == "http" and host in LOCAL_API_HOSTS:
        return url
    raise ValueError(
        "API_BASE_URL must use HTTPS in non-local environments "
        "(http is allowed only for localhost, 127.0.0.1, and ::1)"
    )


def load_config(env_file: str | None = None) -> Config:
    if env_file:
        load_dotenv(env_file)
    else:
        project_root = Path(__file__).resolve().parent.parent
        env_name = os.getenv("APP_ENV", "").strip().lower()
        if env_name == "production":
            load_dotenv(project_root / ".env.production")
        else:
            load_dotenv(project_root / ".env")

    return Config(
        api_base_url=require_secure_api_base_url(_require("API_BASE_URL").rstrip("/")),
        service_account_username=_require("SERVICE_ACCOUNT_USERNAME"),
        service_account_password=_require("SERVICE_ACCOUNT_PASSWORD"),
        compliance_expiring_buffer_days=int(_require("COMPLIANCE_EXPIRING_BUFFER_DAYS")),
        compliance_timezone=_require("COMPLIANCE_TIMEZONE"),
        api_request_timeout_seconds=int(_require("API_REQUEST_TIMEOUT_SECONDS")),
        aws_region=_require("AWS_REGION"),
        eventbridge_bus_name=_require("EVENTBRIDGE_BUS_NAME"),
        eventbridge_source=_require("EVENTBRIDGE_SOURCE"),
        eventbridge_detail_type=_require("EVENTBRIDGE_DETAIL_TYPE"),
        sqs_queue_name=_require("SQS_QUEUE_NAME"),
        skip_event_publish=_parse_bool(_optional("SKIP_EVENT_PUBLISH")),
        aws_endpoint_url=_optional("AWS_ENDPOINT_URL"),
        aws_access_key_id=_optional("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=_optional("AWS_SECRET_ACCESS_KEY"),
        pending_event_path=_optional("PENDING_EVENT_PATH"),
    )
