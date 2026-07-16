"""Validate agent brain loading and integration with AgentRunner."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from app.agents.runner import AgentRunner
from app.brains.loader import BRAIN_LOAD_ORDER, get_brain_stats, load_agent_brain
from app.config import VALID_AGENTS

AGENTS = sorted(VALID_AGENTS)
MIN_BRAIN_CHARS = 50_000
BRAIN_MARKERS = [
    "hba-",
    "bp-0",
    "insufficient information",
    "yetarli ma'lumot",
    "executive",
    "bitrix24",
    "tinchlik",
    "haridlar",
    "xaridlar",
]


def test_brain_files_exist() -> list[dict]:
    """Verify every agent has all expected brain files on disk."""
    results = []
    for agent in AGENTS:
        expected = BRAIN_LOAD_ORDER.get(agent, [])
        agent_dir = Path(__file__).resolve().parent.parent / "brains" / agent
        missing = [f for f in expected if not (agent_dir / f).is_file()]
        stats = get_brain_stats(agent)
        results.append(
            {
                "agent": agent,
                "expected_files": len(expected),
                "loaded_files": stats["files"],
                "chars": stats["chars"],
                "missing": missing,
                "ok": not missing and stats["chars"] >= MIN_BRAIN_CHARS,
            }
        )
    return results


def test_runner_system_prompt() -> list[dict]:
    """Verify AgentRunner merges prompt + brain into system message."""
    runner = AgentRunner()
    results = []
    for agent in AGENTS:
        system = runner.build_system_prompt(agent)
        brain = load_agent_brain(agent)
        results.append(
            {
                "agent": agent,
                "system_chars": len(system),
                "brain_in_system": "AGENT BRAIN" in system and brain[:200] in system,
                "ok": "AGENT BRAIN" in system and brain[:200] in system,
            }
        )
    return results


async def test_agent_claude_integration(agent: str) -> dict:
    """Run a short Claude report and verify brain-informed output."""
    runner = AgentRunner()
    stats = get_brain_stats(agent)
    question = (
        "Agent brain va kompaniya bilim bazasidan foydalanib, "
        "qisqa executive xulosa bering: kompaniya nomi, asosiy KPI yoki HBA qatlami."
    )
    try:
        report = await runner.run_agent_report(agent, question=question)
        lower = report.lower()
        uses_brain = any(marker in lower for marker in BRAIN_MARKERS)
        return {
            "agent": agent,
            "success": True,
            "brain_files": stats["files"],
            "brain_chars": stats["chars"],
            "report_chars": len(report),
            "brain_informed": uses_brain,
            "preview": report[:500],
        }
    except Exception as exc:
        return {
            "agent": agent,
            "success": False,
            "brain_files": stats["files"],
            "brain_chars": stats["chars"],
            "error": str(exc),
        }


async def main() -> int:
    file_results = test_brain_files_exist()
    system_results = test_runner_system_prompt()

    print("=== Brain file validation ===", flush=True)
    for r in file_results:
        status = "OK" if r["ok"] else "FAIL"
        print(
            f"  [{status}] {r['agent']}: {r['loaded_files']} files, "
            f"{r['chars']:,} chars"
            + (f", missing={r['missing']}" if r["missing"] else ""),
            flush=True,
        )

    print("\n=== Runner system prompt integration ===", flush=True)
    for r in system_results:
        status = "OK" if r["ok"] else "FAIL"
        print(f"  [{status}] {r['agent']}: system_chars={r['system_chars']:,}", flush=True)

    files_ok = all(r["ok"] for r in file_results)
    system_ok = all(r["ok"] for r in system_results)

    claude_results: list[dict] = []
    if files_ok and system_ok:
        print("\n=== Claude integration (all agents) ===", flush=True)
        for agent in AGENTS:
            print(f"  Testing {agent}...", flush=True)
            claude_results.append(await test_agent_claude_integration(agent))
            status = "OK" if claude_results[-1].get("success") else "FAIL"
            print(f"    [{status}] report_chars={claude_results[-1].get('report_chars', 0)}", flush=True)
    else:
        print("\nSkipping Claude tests — fix file/system validation first.", flush=True)

    claude_ok = all(r.get("success") for r in claude_results) if claude_results else False
    structural_ok = files_ok and system_ok
    summary = {
        "brain_files_ok": files_ok,
        "system_integration_ok": system_ok,
        "claude_integration_ok": claude_ok,
        "structural_validation_passed": structural_ok,
        "file_results": file_results,
        "system_results": system_results,
        "claude_results": claude_results,
        "all_passed": structural_ok,
    }
    print("\n" + json.dumps(summary, ensure_ascii=True, indent=2), flush=True)
    return 0 if summary["all_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
