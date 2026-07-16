"""Test all agents use imported company knowledge."""

from __future__ import annotations

import asyncio
import json
import sys

from app.agents.runner import AgentRunner
from app.knowledge.loader import load_agent_knowledge

AGENTS = ["ceo", "finance", "sales", "hr", "marketing", "customer_success"]
COMPANY_MARKERS = ["xaridlar", "haridlar", "харидлар", "bp-0", "hba-0", "dp-0", "aq-0"]


async def test_agent(agent: str) -> dict:
    kb = load_agent_knowledge(agent)
    runner = AgentRunner()
    question = (
        "Kompaniya bilim bazasidagi ma'lumotlardan foydalanib, "
        "qisqa xulosa bering: kompaniya nomi, asosiy jarayon yoki arxitektura elementi."
    )
    try:
        report = await runner.run_agent_report(agent, question=question)
        lower = report.lower()
        uses_kb = any(marker in lower for marker in COMPANY_MARKERS) or "bilim bazas" in lower
        return {
            "agent": agent,
            "success": True,
            "kb_chars": len(kb),
            "report_chars": len(report),
            "uses_company_knowledge": uses_kb,
            "preview": report[:400],
        }
    except Exception as exc:
        return {
            "agent": agent,
            "success": False,
            "kb_chars": len(kb),
            "error": str(exc),
        }


async def main() -> int:
    results = []
    for agent in AGENTS:
        print(f"Testing {agent}...", flush=True)
        results.append(await test_agent(agent))
    all_ok = all(r.get("success") for r in results)
    print(json.dumps({"results": results, "all_success": all_ok}, ensure_ascii=False, indent=2))
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
