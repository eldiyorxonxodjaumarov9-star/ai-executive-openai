"""MCP tool definitions for Claude/agent integrations."""

from __future__ import annotations

from typing import Any

from app.config import VALID_AGENTS

# Tool schemas compatible with MCP / Claude tool-use patterns.
MCP_TOOLS: list[dict[str, Any]] = [
    {
        "name": "fetch_bitrix_crm_data",
        "description": (
            "Bitrix24 CRM dan lidlar, bitimlar, kontaktlar va vazifalarni olish. "
            "Tozalangan JSON formatida qaytaradi."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "run_agent_report",
        "description": (
            "Tanlangan agent (CEO, Sales, Finance, Marketing, Customer Success, HR) "
            "yordamida CRM ma'lumotlarini tahlil qilish va hisobot yaratish."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_name": {
                    "type": "string",
                    "enum": sorted(VALID_AGENTS),
                    "description": "Agent nomi",
                },
                "send_telegram": {
                    "type": "boolean",
                    "description": "Hisobotni Telegramga yuborish",
                    "default": True,
                },
            },
            "required": ["agent_name"],
        },
    },
    {
        "name": "send_telegram_message",
        "description": "Telegram chatiga xabar yuborish (uzun xabarlar avtomatik bo'linadi).",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Yuboriladigan xabar matni",
                },
            },
            "required": ["message"],
        },
    },
    {
        "name": "list_agents",
        "description": "Mavjud AI agentlar ro'yxatini qaytarish.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


def get_mcp_tool_catalog() -> dict[str, Any]:
    """Return MCP tool catalog metadata."""
    return {
        "name": "bitrix24-claude-telegram",
        "version": "1.0.0",
        "tools": MCP_TOOLS,
    }
