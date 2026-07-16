"""Bitrix24 connectivity test service."""

from __future__ import annotations

from typing import Any, Optional

import httpx

from app.config import Settings, get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

BITRIX_TEST_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
CONNECTION_FAILED = "Bitrix24 connection failed"

LEAD_SELECT = [
    "ID",
    "TITLE",
    "NAME",
    "LAST_NAME",
    "STATUS_ID",
    "SOURCE_ID",
    "OPPORTUNITY",
    "DATE_CREATE",
    "DATE_MODIFY",
]

DEAL_SELECT = [
    "ID",
    "TITLE",
    "STAGE_ID",
    "OPPORTUNITY",
    "CURRENCY_ID",
    "PROBABILITY",
    "DATE_CREATE",
    "DATE_MODIFY",
]

CONTACT_SELECT = [
    "ID",
    "NAME",
    "LAST_NAME",
    "PHONE",
    "EMAIL",
    "DATE_CREATE",
    "DATE_MODIFY",
]

TASK_SELECT = [
    "ID",
    "TITLE",
    "STATUS",
    "PRIORITY",
    "DEADLINE",
    "CREATED_DATE",
    "CHANGED_DATE",
    "RESPONSIBLE_ID",
]


class BitrixTestService:
    """Lightweight Bitrix24 client for connectivity and entity smoke tests."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.webhook_url = self.settings.bitrix24_webhook_url

    def _failure(self, *, method: str, reason: str) -> dict[str, Any]:
        logger.error("Bitrix24 test failed | method=%s | reason=%s", method, reason)
        return {"success": False, "error": CONNECTION_FAILED}

    def _success(self, *, method: str, data: Any) -> dict[str, Any]:
        logger.info("Bitrix24 test succeeded | method=%s", method)
        return {"success": True, "data": data}

    async def _request(
        self,
        method: str,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Execute a Bitrix24 REST call and normalize the response envelope."""
        url = f"{self.webhook_url}/{method}"
        payload = params or {}

        logger.info(
            "Bitrix24 test request started | method=%s | url=%s | param_keys=%s",
            method,
            url,
            sorted(payload.keys()),
        )

        try:
            async with httpx.AsyncClient(timeout=BITRIX_TEST_TIMEOUT) as client:
                response = await client.post(url, json=payload)
        except httpx.TimeoutException as exc:
            return self._failure(method=method, reason=f"timeout: {exc}")
        except httpx.RequestError as exc:
            return self._failure(method=method, reason=f"network: {exc}")

        logger.info(
            "Bitrix24 test response received | method=%s | status_code=%s",
            method,
            response.status_code,
        )

        if response.status_code >= 400:
            return self._failure(
                method=method,
                reason=f"http_{response.status_code}: {response.text[:300]}",
            )

        try:
            body = response.json()
        except ValueError:
            return self._failure(method=method, reason="invalid_json_response")

        if not isinstance(body, dict):
            return self._failure(method=method, reason="unexpected_response_shape")

        if body.get("error"):
            api_error = body.get("error_description") or body.get("error")
            return self._failure(method=method, reason=f"api_error: {api_error}")

        return self._success(method=method, data=body.get("result", body))

    @staticmethod
    def _limit_list_items(data: Any, limit: int) -> list[dict[str, Any]]:
        if isinstance(data, list):
            return data[:limit]
        return []

    @staticmethod
    def _limit_task_items(data: Any, limit: int) -> list[dict[str, Any]]:
        if isinstance(data, dict):
            tasks = data.get("tasks", [])
            if isinstance(tasks, list):
                return tasks[:limit]
            return []
        if isinstance(data, list):
            return data[:limit]
        return []

    async def test_connection(self) -> dict[str, Any]:
        """Verify webhook connectivity via profile.json."""
        return await self._request("profile.json")

    async def get_leads(self, limit: int = 5) -> dict[str, Any]:
        """Fetch recent leads via crm.lead.list.json."""
        result = await self._request(
            "crm.lead.list.json",
            {
                "order": {"DATE_MODIFY": "DESC"},
                "select": LEAD_SELECT,
                "start": 0,
            },
        )
        if not result["success"]:
            return result

        items = self._limit_list_items(result["data"], limit)
        return {"success": True, "data": {"count": len(items), "items": items}}

    async def get_deals(self, limit: int = 5) -> dict[str, Any]:
        """Fetch recent deals via crm.deal.list.json."""
        result = await self._request(
            "crm.deal.list.json",
            {
                "order": {"DATE_MODIFY": "DESC"},
                "select": DEAL_SELECT,
                "start": 0,
            },
        )
        if not result["success"]:
            return result

        items = self._limit_list_items(result["data"], limit)
        return {"success": True, "data": {"count": len(items), "items": items}}

    async def get_contacts(self, limit: int = 5) -> dict[str, Any]:
        """Fetch recent contacts via crm.contact.list.json."""
        result = await self._request(
            "crm.contact.list.json",
            {
                "order": {"DATE_MODIFY": "DESC"},
                "select": CONTACT_SELECT,
                "start": 0,
            },
        )
        if not result["success"]:
            return result

        items = self._limit_list_items(result["data"], limit)
        return {"success": True, "data": {"count": len(items), "items": items}}

    async def get_tasks(self, limit: int = 5) -> dict[str, Any]:
        """Fetch recent tasks via tasks.task.list.json."""
        result = await self._request(
            "tasks.task.list.json",
            {
                "order": {"CHANGED_DATE": "DESC"},
                "select": TASK_SELECT,
            },
        )
        if not result["success"]:
            return result

        items = self._limit_task_items(result["data"], limit)
        return {"success": True, "data": {"count": len(items), "items": items}}
