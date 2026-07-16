"""Bitrix24 REST API integration service."""

from __future__ import annotations

from datetime import datetime, timezone
import asyncio
from typing import Any, Optional

import httpx

from app.config import Settings, get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

class Bitrix24Error(Exception):
    """Raised when Bitrix24 API returns an error."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class Bitrix24Service:
    """Async client for Bitrix24 incoming webhook REST API."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.webhook_url = self.settings.bitrix24_webhook_url

    async def _request(self, url: str, payload: dict[str, Any]) -> httpx.Response:
        timeout = httpx.Timeout(self.settings.bitrix_timeout_seconds, connect=10.0)
        attempts = self.settings.bitrix_max_retries + 1
        async with httpx.AsyncClient(timeout=timeout) as client:
            for attempt in range(attempts):
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code != 429 and response.status_code < 500:
                        return response
                    if attempt == attempts - 1:
                        return response
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt == attempts - 1:
                        raise
                await asyncio.sleep(min(0.5 * (2**attempt), 4.0))
        raise RuntimeError("unreachable")

    async def _call(
        self,
        method: str,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Execute a Bitrix24 REST method via incoming webhook."""
        url = f"{self.webhook_url}/{method}"
        payload = params or {}

        logger.debug("Bitrix24 request: %s params=%s", method, list(payload.keys()))

        try:
            response = await self._request(url, payload)
        except httpx.RequestError as exc:
            logger.error("Bitrix24 network error for %s: %s", method, exc)
            raise Bitrix24Error("CRM ulanish xatosi — Bitrix24 dan javob kelmadi.") from exc

        if response.status_code >= 400:
            logger.error(
                "Bitrix24 HTTP %s for %s: %s",
                response.status_code,
                method,
                response.text[:500],
            )
            raise Bitrix24Error(
                f"Bitrix24 HTTP {response.status_code}: {response.text[:200]}",
                status_code=response.status_code,
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise Bitrix24Error("Bitrix24 returned invalid JSON") from exc

        if "error" in data:
            error_msg = data.get("error_description") or data.get("error")
            logger.error("Bitrix24 API error for %s: %s", method, error_msg)
            raise Bitrix24Error(f"Bitrix24 API error: {error_msg}")

        return data

    async def _list_all(
        self,
        method: str,
        *,
        select: list[str],
        limit: int,
        order: Optional[dict[str, str]] = None,
    ) -> list[dict[str, Any]]:
        """Fetch records with pagination up to the configured limit."""
        collected: list[dict[str, Any]] = []
        start = 0
        page_size = min(50, limit)

        while len(collected) < limit:
            batch_size = min(page_size, limit - len(collected))
            params: dict[str, Any] = {
                "select": select,
                "start": start,
            }
            if order:
                params["order"] = order

            result = await self._call(method, params)
            items = result.get("result", [])

            if not items:
                break

            collected.extend(items)
            start += len(items)

            if len(items) < batch_size or not result.get("next"):
                break

        return collected[:limit]

    @staticmethod
    def _normalize_record(record: dict[str, Any]) -> dict[str, Any]:
        """Strip empty values and normalize common Bitrix24 field shapes."""
        normalized: dict[str, Any] = {}
        for key, value in record.items():
            if value is None or value == "" or value == []:
                continue
            if isinstance(value, list) and value and isinstance(value[0], dict):
                if "VALUE" in value[0]:
                    normalized[key] = [item.get("VALUE") for item in value if item.get("VALUE")]
                else:
                    normalized[key] = value
            else:
                normalized[key] = value
        return normalized

    async def fetch_leads(self) -> list[dict[str, Any]]:
        """Fetch CRM leads."""
        select = [
            "ID",
            "TITLE",
            "NAME",
            "LAST_NAME",
            "STATUS_ID",
            "SOURCE_ID",
            "OPPORTUNITY",
            "CURRENCY_ID",
            "DATE_CREATE",
            "DATE_MODIFY",
            "ASSIGNED_BY_ID",
            "COMMENTS",
        ]
        records = await self._list_all(
            "crm.lead.list",
            select=select,
            limit=self.settings.bitrix_leads_limit,
            order={"DATE_MODIFY": "DESC"},
        )
        return [self._normalize_record(r) for r in records]

    async def fetch_deals(self) -> list[dict[str, Any]]:
        """Fetch CRM deals."""
        select = [
            "ID",
            "TITLE",
            "STAGE_ID",
            "OPPORTUNITY",
            "CURRENCY_ID",
            "PROBABILITY",
            "DATE_CREATE",
            "DATE_MODIFY",
            "CLOSEDATE",
            "ASSIGNED_BY_ID",
            "CONTACT_ID",
            "COMPANY_ID",
            "COMMENTS",
        ]
        records = await self._list_all(
            "crm.deal.list",
            select=select,
            limit=self.settings.bitrix_deals_limit,
            order={"DATE_MODIFY": "DESC"},
        )
        return [self._normalize_record(r) for r in records]

    async def fetch_contacts(self) -> list[dict[str, Any]]:
        """Fetch CRM contacts."""
        select = [
            "ID",
            "NAME",
            "LAST_NAME",
            "SECOND_NAME",
            "PHONE",
            "EMAIL",
            "COMPANY_ID",
            "TYPE_ID",
            "SOURCE_ID",
            "DATE_CREATE",
            "DATE_MODIFY",
            "ASSIGNED_BY_ID",
            "COMMENTS",
        ]
        records = await self._list_all(
            "crm.contact.list",
            select=select,
            limit=self.settings.bitrix_contacts_limit,
            order={"DATE_MODIFY": "DESC"},
        )
        return [self._normalize_record(r) for r in records]

    async def fetch_tasks(self) -> list[dict[str, Any]]:
        """Fetch tasks if the tasks module is available."""
        try:
            result = await self._call(
                "tasks.task.list",
                {
                    "order": {"CHANGED_DATE": "DESC"},
                    "select": [
                        "ID",
                        "TITLE",
                        "DESCRIPTION",
                        "STATUS",
                        "PRIORITY",
                        "DEADLINE",
                        "CREATED_DATE",
                        "CHANGED_DATE",
                        "RESPONSIBLE_ID",
                        "CREATED_BY",
                    ],
                },
            )
            raw = result.get("result", {})
            if isinstance(raw, dict):
                records = list(raw.get("tasks", []))
            elif isinstance(raw, list):
                records = raw
            else:
                records = []

            return [
                self._normalize_record(r)
                for r in records[: self.settings.bitrix_tasks_limit]
            ]
        except Bitrix24Error as exc:
            logger.warning("Tasks module unavailable or restricted: %s", exc)
            return []

    async def search_users_by_name(
        self,
        name: str,
        *,
        field: str = "NAME",
    ) -> list[dict[str, Any]]:
        """Search Bitrix24 users by first or last name."""
        if not name or not name.strip():
            return []
        try:
            result = await self._call(
                "user.search",
                {
                    "FILTER": {field: name.strip()},
                    "SELECT": ["ID", "NAME", "LAST_NAME", "EMAIL"],
                },
            )
            users = result.get("result", [])
            return users if isinstance(users, list) else []
        except Bitrix24Error as exc:
            logger.warning("user.search failed for %s: %s", name, exc)
            return []

    async def fetch_all_crm_data(self, *, use_cache: bool = True) -> dict[str, Any]:
        """Fetch and normalize all supported CRM entities into a single payload."""
        from app.utils.crm_cache import get_cached_crm, set_cached_crm

        if use_cache:
            cached = await get_cached_crm()
            if cached is not None:
                logger.info("Bitrix24 CRM cache hit")
                return cached

        logger.info("Fetching Bitrix24 CRM data")

        leads, deals, contacts, tasks = await asyncio.gather(
            self.fetch_leads(), self.fetch_deals(), self.fetch_contacts(), self.fetch_tasks()
        )

        payload = {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "leads_count": len(leads),
                "deals_count": len(deals),
                "contacts_count": len(contacts),
                "tasks_count": len(tasks),
                "total_opportunity": sum(
                    float(d.get("OPPORTUNITY", 0) or 0) for d in deals
                ),
            },
            "leads": leads,
            "deals": deals,
            "contacts": contacts,
            "tasks": tasks,
        }

        logger.info(
            "Bitrix24 data fetched: %d leads, %d deals, %d contacts, %d tasks",
            len(leads),
            len(deals),
            len(contacts),
            len(tasks),
        )
        await set_cached_crm(payload)
        return payload
