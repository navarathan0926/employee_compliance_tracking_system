from __future__ import annotations

import logging
import time
from typing import Any

import requests

from config import FETCH_PAGE_SIZE, RETRY_DELAYS_SECONDS, Config

logger = logging.getLogger(__name__)


class ApiClientError(Exception):
    pass


class ApiClient:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._session = requests.Session()
        self._access_token: str | None = None

    def login(self) -> None:
        response = self._request_without_auth(
            method="POST",
            path="/auth/login",
            json={
                "username": self._config.service_account_username,
                "password": self._config.service_account_password,
            },
        )
        token = response.get("accessToken")
        if not token:
            raise ApiClientError("Login response did not include accessToken")
        self._access_token = token

    def fetch_all_active_expiring(self) -> list[dict[str, Any]]:
        snapshot: list[dict[str, Any]] = []
        offset = 0

        while True:
            page = self._authorized_request(
                method="GET",
                path="/compliance-records",
                params={
                    "status": "active,expiring",
                    "limit": FETCH_PAGE_SIZE,
                    "offset": offset,
                },
            )
            data = page.get("data", [])
            total = int(page.get("total", 0))

            snapshot.extend(data)
            offset += len(data)

            if offset >= total or len(data) == 0:
                break

        return snapshot

    def bulk_status_update(self, updates: list[dict[str, int | str]]) -> dict[str, Any]:
        if not updates:
            raise ValueError("bulk_status_update requires at least one update")

        return self._authorized_request(
            method="PATCH",
            path="/compliance-records/bulk-status",
            json={"updates": updates},
        )

    def _authorized_request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if self._access_token is None:
            self.login()

        try:
            return self._request_with_retry(
                method=method,
                path=path,
                params=params,
                json=json,
                include_auth=True,
            )
        except ApiClientError as error:
            if "401" not in str(error):
                raise

            logger.warning("Received 401; re-authenticating and retrying once")
            self.login()
            return self._request_with_retry(
                method=method,
                path=path,
                params=params,
                json=json,
                include_auth=True,
            )

    def _request_without_auth(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._request_with_retry(
            method=method,
            path=path,
            params=params,
            json=json,
            include_auth=False,
        )

    def _request_with_retry(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        include_auth: bool,
    ) -> dict[str, Any]:
        last_error: Exception | None = None

        for attempt, delay in enumerate([0, *RETRY_DELAYS_SECONDS]):
            if delay:
                time.sleep(delay)

            try:
                return self._send_request(
                    method=method,
                    path=path,
                    params=params,
                    json=json,
                    include_auth=include_auth,
                )
            except ApiClientError as error:
                last_error = error
                if "401" in str(error):
                    raise
                if attempt == len(RETRY_DELAYS_SECONDS):
                    break
                logger.warning("Request failed (attempt %s): %s", attempt + 1, error)

        raise ApiClientError(f"Request failed after retries: {last_error}")

    def _send_request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        include_auth: bool,
    ) -> dict[str, Any]:
        headers: dict[str, str] = {}
        if include_auth:
            if not self._access_token:
                raise ApiClientError("Missing access token")
            headers["Authorization"] = f"Bearer {self._access_token}"

        url = f"{self._config.api_base_url}{path}"

        try:
            response = self._session.request(
                method=method,
                url=url,
                params=params,
                json=json,
                headers=headers,
                timeout=self._config.api_request_timeout_seconds,
            )
        except requests.RequestException as error:
            raise ApiClientError(str(error)) from error

        if response.status_code == 401:
            raise ApiClientError("401 Unauthorized")

        if response.status_code >= 400:
            raise ApiClientError(
                f"{method} {path} failed with status {response.status_code}: {response.text}"
            )

        if not response.content:
            return {}

        payload = response.json()
        if not isinstance(payload, dict):
            raise ApiClientError(f"Expected JSON object from {method} {path}")

        return payload
