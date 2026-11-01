"""Small Feishu Base client for the original Hermes employee.

The Base allowlist and credentials are supplied at runtime. No credential or
business record belongs in the source repository.
"""

from __future__ import annotations

import hashlib
import logging
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
from dotenv import dotenv_values


class BitableError(RuntimeError):
    pass


logging.getLogger("httpx").setLevel(logging.WARNING)


def load_app_credentials(hermes_home: Path) -> tuple[str, str]:
    values = dotenv_values(hermes_home / ".env")
    app_id = values.get("FEISHU_APP_ID")
    app_secret = values.get("FEISHU_APP_SECRET")
    if not app_id or not app_secret:
        raise BitableError("Feishu application credentials are unavailable")
    return app_id, app_secret


def stable_client_token(operation_key: str) -> str:
    """A stable UUIDv4-shaped idempotency key for one intended create/update."""
    if len(operation_key.strip()) < 8:
        raise BitableError("operation_key must identify this intended write (8+ characters)")
    digest = hashlib.sha256(operation_key.encode("utf-8")).digest()[:16]
    return str(uuid.UUID(bytes=digest, version=4))


class BitableClient:
    def __init__(
        self,
        app_id: str,
        app_secret: str,
        allowed_app_token: str,
        *,
        write_enabled: bool = False,
        http: httpx.Client | None = None,
    ) -> None:
        if not allowed_app_token:
            raise BitableError("An explicit Base allowlist is required")
        self.app_id = app_id
        self._app_secret = app_secret
        self.allowed_app_token = self._id(allowed_app_token)
        self.write_enabled = write_enabled
        self.http = http or httpx.Client(timeout=20.0)
        self._token = ""
        self._token_expires_at = 0.0

    def _access_token(self) -> str:
        if self._token and time.monotonic() < self._token_expires_at:
            return self._token
        response = self.http.post(
            "https://accounts.feishu.cn/oauth/v3/token",
            json={
                "grant_type": "client_credentials",
                "client_id": self.app_id,
                "client_secret": self._app_secret,
            },
        )
        payload = response.json()
        token = payload.get("access_token") if response.status_code == 200 else None
        if payload.get("code") != 0 or not token:
            raise BitableError(f"Feishu authentication failed (HTTP {response.status_code}, code {payload.get('code')})")
        self._token = token
        self._token_expires_at = time.monotonic() + max(1, int(payload.get("expires_in", 3600)) - 120)
        return token

    def _call(self, method: str, path: str, *, params: dict[str, Any] | None = None,
              body: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            response = self.http.request(
                method,
                "https://open.feishu.cn/open-apis/bitable/v1/apps/" + self.allowed_app_token + path,
                params=params,
                json=body,
                headers={"Authorization": "Bearer " + self._access_token()},
            )
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            # An ambiguous write must never be silently retried.
            raise BitableError(f"Feishu request outcome unknown: {type(exc).__name__}") from exc
        if response.status_code >= 400 or payload.get("code") != 0:
            raise BitableError(
                f"Feishu request failed (HTTP {response.status_code}, code {payload.get('code')}, "
                f"message {str(payload.get('msg') or '')[:120]})"
            )
        return payload.get("data") or {}

    @staticmethod
    def _page_size(value: int) -> int:
        if not 1 <= value <= 100:
            raise BitableError("page_size must be between 1 and 100")
        return value

    def list_tables(self, page_size: int = 100, page_token: str = "") -> dict[str, Any]:
        params = {"page_size": self._page_size(page_size)}
        if page_token:
            params["page_token"] = page_token
        return self._call("GET", "/tables", params=params)

    def list_fields(self, table_id: str, page_size: int = 100, page_token: str = "") -> dict[str, Any]:
        params = {"page_size": self._page_size(page_size)}
        if page_token:
            params["page_token"] = page_token
        return self._call("GET", f"/tables/{self._id(table_id)}/fields", params=params)

    def list_records(self, table_id: str, page_size: int = 50, page_token: str = "") -> dict[str, Any]:
        params = {"page_size": self._page_size(page_size)}
        if page_token:
            params["page_token"] = page_token
        return self._call("GET", f"/tables/{self._id(table_id)}/records", params=params)

    def get_record(self, table_id: str, record_id: str) -> dict[str, Any]:
        return self._call("GET", f"/tables/{self._id(table_id)}/records/{self._id(record_id)}")

    def create_record(self, table_id: str, fields: dict[str, Any], operation_key: str) -> dict[str, Any]:
        self._require_write(fields)
        self._operation_key(operation_key)
        return self._call(
            "POST", f"/tables/{self._id(table_id)}/records",
            params={"client_token": stable_client_token(self.allowed_app_token + "/" + table_id + "/create/" + operation_key)},
            body={"fields": fields},
        )

    def update_record(self, table_id: str, record_id: str, fields: dict[str, Any],
                      operation_key: str, expected_fields: dict[str, Any]) -> dict[str, Any]:
        self._require_write(fields)
        self._operation_key(operation_key)
        if not expected_fields:
            raise BitableError("expected_fields is required to guard against stale edits")
        current = self.get_record(table_id, record_id).get("record", {}).get("fields", {})
        mismatched = [name for name, value in expected_fields.items() if current.get(name) != value]
        if mismatched:
            raise BitableError("Record changed since inspection; re-read before editing: " + ", ".join(mismatched))
        return self._call(
            "PUT", f"/tables/{self._id(table_id)}/records/{self._id(record_id)}",
            params={"client_token": stable_client_token(self.allowed_app_token + "/" + table_id + "/" + record_id + "/update/" + operation_key)},
            body={"fields": fields},
        )

    @staticmethod
    def _id(value: str) -> str:
        if not value or not value.isascii() or not value.replace("_", "").isalnum():
            raise BitableError("Invalid Feishu resource ID")
        return value

    def _require_write(self, fields: dict[str, Any]) -> None:
        if not self.write_enabled:
            raise BitableError("Record writes are not enabled for this Hermes tool")
        if not isinstance(fields, dict) or not fields:
            raise BitableError("Nonempty fields object required")

    @staticmethod
    def _operation_key(value: str) -> None:
        if not isinstance(value, str) or len(value.strip()) < 8:
            raise BitableError("operation_key must identify this intended write (8+ characters)")
