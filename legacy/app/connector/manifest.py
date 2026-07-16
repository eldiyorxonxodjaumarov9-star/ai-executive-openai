"""Connector tool manifest for Claude.ai integration."""

from __future__ import annotations

from typing import Any

CONNECTOR_SERVICE_NAME = "AI Executive Platform Claude Connector"

TOOL_NAMES = [
    "get_bitrix_summary",
    "run_ceo_agent",
    "run_finance_agent",
    "run_sales_agent",
    "run_hr_agent",
    "run_marketing_agent",
    "run_customer_success_agent",
]

_AGENT_TOOLS: tuple[tuple[str, str, str], ...] = (
    ("ceo", "run_ceo_agent", "CEO Agent — strategik tahlil va Bitrix24 holati."),
    ("finance", "run_finance_agent", "Finance Agent — moliyaviy tahlil va cashflow."),
    ("sales", "run_sales_agent", "Sales Agent — pipeline, lidlar va savdo tahlili."),
    ("hr", "run_hr_agent", "HR Agent — xodimlar, vazifalar va yuklama tahlili."),
    ("marketing", "run_marketing_agent", "Marketing Agent — kampaniyalar va lead manbalari."),
    (
        "customer_success",
        "run_customer_success_agent",
        "Customer Success Agent — mijozlar, retention va renewals.",
    ),
)


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


def build_connector_tools(base_url: str) -> list[dict[str, Any]]:
    """Build connector tool definitions with absolute URLs."""
    root = _normalize_base_url(base_url)
    tools: list[dict[str, Any]] = [
        {
            "name": "get_bitrix_summary",
            "description": (
                "Bitrix24 CRM umumiy statistikasini olish: lidlar, bitimlar, "
                "kontaktlar, vazifalar soni va umumiy summa."
            ),
            "method": "GET",
            "path": "/tools/bitrix/summary",
            "url": f"{root}/tools/bitrix/summary",
            "input_schema": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        }
    ]

    for agent_id, tool_name, description in _AGENT_TOOLS:
        tools.append(
            {
                "name": tool_name,
                "description": description,
                "method": "POST",
                "path": f"/tools/agent/{agent_id}",
                "url": f"{root}/tools/agent/{agent_id}",
                "input_schema": {
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
                },
            }
        )

    return tools


def build_connector_manifest(base_url: str) -> dict[str, Any]:
    """Return full connector manifest JSON."""
    root = _normalize_base_url(base_url)
    tools = build_connector_tools(root)
    return {
        "name": "ai-executive-platform-connector",
        "version": "1.0.0",
        "service": CONNECTOR_SERVICE_NAME,
        "description": (
            "Claude.ai connector for AI Executive Platform — live Bitrix24 CRM "
            "analysis via executive AI agents."
        ),
        "base_url": root,
        "documentation": f"{root}/claude/instructions",
        "mcp_url": f"{root}/mcp",
        "health_check": f"{root}/claude/health",
        "mcp_health_check": f"{root}/mcp/health",
        "tools": tools,
    }


def build_connector_instructions(base_url: str) -> dict[str, Any]:
    """Return user-facing instructions for Claude.ai connector usage."""
    root = _normalize_base_url(base_url)
    return {
        "title": "AI Executive Platform — Claude Connector Instructions",
        "instructions": (
            "You are connected to AI Executive Platform. Use the available tools to "
            "analyze live Bitrix24 CRM data and return executive-level answers.\n\n"
            "When the user asks in Uzbek or English (for example: "
            "\"CEO, bugungi Bitrix24 holatini tahlil qil\"), select the matching agent tool:\n"
            "- CEO questions → run_ceo_agent\n"
            "- Finance questions → run_finance_agent\n"
            "- Sales / pipeline questions → run_sales_agent\n"
            "- HR / tasks / workload → run_hr_agent\n"
            "- Marketing / campaigns / lead sources → run_marketing_agent\n"
            "- Customer success / retention / renewals → run_customer_success_agent\n"
            "- Quick CRM stats only → get_bitrix_summary\n\n"
            "Always pass the user's question in the JSON body: {\"question\": \"...\"}.\n"
            "Base answers on tool responses only. If data is missing, say "
            "\"Insufficient information.\"\n"
            "Do not invent company facts or CRM numbers."
        ),
        "example_prompts": [
            "CEO, bugungi Bitrix24 holatini tahlil qil",
            "Finance, pipeline moliyaviy xulosasini ber",
            "Sales, lidlar va bitimlar bo'yicha qisqa tahlil",
        ],
        "base_url": root,
        "mcp_url": f"{root}/mcp",
        "manifest_url": f"{root}/claude/manifest",
        "health_url": f"{root}/claude/health",
        "mcp_health_url": f"{root}/mcp/health",
    }


def build_connector_health() -> dict[str, Any]:
    """Return connector health payload."""
    return {
        "success": True,
        "service": CONNECTOR_SERVICE_NAME,
        "tools_available": TOOL_NAMES,
    }
