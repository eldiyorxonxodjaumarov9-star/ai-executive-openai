"""Shared MCP tool execution — reuses existing Bitrix and agent logic."""

from __future__ import annotations

import json
from typing import Any

from app.agents.runner import AGENT_DISPLAY_NAMES, AgentError, AgentRunner
from app.connector.manifest import TOOL_NAMES
from app.services.bitrix import Bitrix24Error, Bitrix24Service
from app.services.claude_service import ClaudeServiceError
from app.utils.logger import get_logger

logger = get_logger(__name__)

MCP_PROTOCOL_VERSION = "2024-11-05"
MCP_SERVER_NAME = "ai-executive-platform"
MCP_SERVER_VERSION = "1.0.0"

AGENT_TOOL_MAP: dict[str, str] = {
    "run_ceo_agent": "ceo",
    "run_finance_agent": "finance",
    "run_sales_agent": "sales",
    "run_hr_agent": "hr",
    "run_marketing_agent": "marketing",
    "run_customer_success_agent": "customer_success",
}

_QUESTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "question": {
            "type": "string",
            "description": (
                "Foydalanuvchi savoli yoki tahlil so'rovi "
                "(masalan: bugungi Bitrix24 holatini tahlil qil)"
            ),
        }
    },
    "required": ["question"],
}

_MCP_TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "get_bitrix_summary",
        "description": (
            "Bitrix24 CRM umumiy statistikasini olish: lidlar, bitimlar, "
            "kontaktlar, vazifalar soni va umumiy summa."
        ),
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "run_ceo_agent",
        "description": "CEO Agent — strategik tahlil va Bitrix24 holati.",
        "inputSchema": _QUESTION_SCHEMA,
    },
    {
        "name": "run_finance_agent",
        "description": "Finance Agent — moliyaviy tahlil va cashflow.",
        "inputSchema": _QUESTION_SCHEMA,
    },
    {
        "name": "run_sales_agent",
        "description": "Sales Agent — pipeline, lidlar va savdo tahlili.",
        "inputSchema": _QUESTION_SCHEMA,
    },
    {
        "name": "run_hr_agent",
        "description": "HR Agent — xodimlar, vazifalar va yuklama tahlili.",
        "inputSchema": _QUESTION_SCHEMA,
    },
    {
        "name": "run_marketing_agent",
        "description": "Marketing Agent — kampaniyalar va lead manbalari.",
        "inputSchema": _QUESTION_SCHEMA,
    },
    {
        "name": "run_customer_success_agent",
        "description": "Customer Success Agent — mijozlar, retention va renewals.",
        "inputSchema": _QUESTION_SCHEMA,
    },
]


def list_mcp_tools() -> list[dict[str, Any]]:
    """Return MCP tools/list payload."""
    return _MCP_TOOL_DEFINITIONS


async def execute_mcp_tool(name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Execute a tool and return MCP tools/call result content."""
    args = arguments or {}
    logger.info("MCP tool call | tool=%s", name)

    if name not in TOOL_NAMES:
        raise ValueError(f"Unknown tool: {name}")

    try:
        if name == "get_bitrix_summary":
            payload = await _get_bitrix_summary()
        else:
            agent_id = AGENT_TOOL_MAP[name]
            question = str(args.get("question", "")).strip()
            if not question:
                raise ValueError("Missing required argument: question")
            payload = await _run_agent(agent_id, question)

        return {
            "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=2)}],
            "isError": False,
        }
    except (AgentError, ClaudeServiceError, Bitrix24Error, ValueError) as exc:
        logger.error("MCP tool failed | tool=%s | error=%s", name, exc)
        return {
            "content": [{"type": "text", "text": str(exc)}],
            "isError": True,
        }


async def _get_bitrix_summary() -> dict[str, Any]:
    bitrix = Bitrix24Service()
    crm_data = await bitrix.fetch_all_crm_data()
    return {
        "success": True,
        "tool": "get_bitrix_summary",
        "fetched_at": crm_data.get("fetched_at"),
        "summary": crm_data.get("summary", {}),
    }


async def _run_agent(agent_id: str, question: str) -> dict[str, Any]:
    runner = AgentRunner()
    normalized = runner.normalize_agent_name(agent_id)
    answer = await runner.run_agent_report(normalized, question=question, optimized=True)
    crm_data = await runner.bitrix.fetch_all_crm_data()
    return {
        "success": True,
        "tool": f"run_{normalized}_agent",
        "agent": normalized,
        "agent_display_name": AGENT_DISPLAY_NAMES.get(normalized, normalized),
        "question": question,
        "answer": answer,
        "crm_summary": crm_data.get("summary", {}),
        "fetched_at": crm_data.get("fetched_at"),
    }
