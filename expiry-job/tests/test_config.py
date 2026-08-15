from pathlib import Path

import pytest

from config import load_config, require_secure_api_base_url


def test_allows_https_remote_api() -> None:
    assert (
        require_secure_api_base_url("https://api.example.com/api")
        == "https://api.example.com/api"
    )


def test_allows_http_on_local_hosts() -> None:
    assert require_secure_api_base_url("http://localhost:3000/api").startswith("http://")
    assert require_secure_api_base_url("http://127.0.0.1:3000/api").startswith("http://")
    assert require_secure_api_base_url("http://[::1]:3000/api").startswith("http://")


def test_rejects_http_on_non_local_hosts() -> None:
    with pytest.raises(ValueError, match="HTTPS"):
        require_secure_api_base_url("http://api.example.com/api")


def _write_env(path: Path, api_base_url: str) -> Path:
    path.write_text(
        "\n".join(
            [
                f"API_BASE_URL={api_base_url}",
                "SERVICE_ACCOUNT_USERNAME=expiry-job",
                "SERVICE_ACCOUNT_PASSWORD=secret",
                "COMPLIANCE_EXPIRING_BUFFER_DAYS=30",
                "COMPLIANCE_TIMEZONE=Asia/Colombo",
                "API_REQUEST_TIMEOUT_SECONDS=30",
                "AWS_REGION=ap-southeast-1",
                "EVENTBRIDGE_BUS_NAME=compliance-events",
                "EVENTBRIDGE_SOURCE=compliance.expiry-job",
                "EVENTBRIDGE_DETAIL_TYPE=compliance.expiry-evaluation.completed",
                "SQS_QUEUE_NAME=compliance-lifecycle-events",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def test_load_config_rejects_plaintext_remote_api(tmp_path: Path) -> None:
    env_file = _write_env(tmp_path / ".env", "http://api.example.com/api")

    with pytest.raises(ValueError, match="HTTPS"):
        load_config(str(env_file))


def test_load_config_accepts_local_http(tmp_path: Path) -> None:
    env_file = _write_env(tmp_path / ".env", "http://localhost:3000/api")

    config = load_config(str(env_file))

    assert config.api_base_url == "http://localhost:3000/api"
