"""Verify OpenAI is used in chat flow when AI_PROVIDER=openai (no Claude SDK)."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parent.parent
BITRIX = "https://example.bitrix24.uz/rest/1/testtoken/"


async def _run() -> int:
    env = os.environ.copy()
    for key in ("AI_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "BITRIX24_WEBHOOK_URL"):
        env.pop(key, None)
    env.update(
        {
            "AI_PROVIDER": "openai",
            "OPENAI_API_KEY": "sk-test-openai",
            "ANTHROPIC_API_KEY": "",
            "BITRIX24_WEBHOOK_URL": BITRIX,
        }
    )

    code = r"""
import asyncio
from unittest.mock import AsyncMock, patch

async def main():
    from app.config import get_settings
    import app.config as cfg
    get_settings.cache_clear()
    cfg._startup_logged = False
    settings = get_settings()
    assert settings.ai_provider == "openai"
    assert settings.openai_configured
    assert not settings.claude_legacy_configured

    from app.agents.runner import AgentRunner

    mock_openai = AsyncMock(return_value="Test OpenAI javobi")
    mock_claude = AsyncMock(return_value="Claude javobi")

    with patch("app.agents.runner.ask_openai", mock_openai), patch(
        "app.services.claude_service.ask_claude", mock_claude
    ), patch(
        "app.agents.runner.fetch_crm_for_quick",
        AsyncMock(return_value=([], {"summary": {}, "leads": [], "deals": [], "tasks": []})),
    ), patch(
        "app.agents.runner.load_knowledge_for_intent",
        lambda *a, **k: ([], "test knowledge"),
    ):
        runner = AgentRunner()
        result = await runner.run_quick_answer("ceo", question="Salom?")
        assert result == "Test OpenAI javobi"
        mock_openai.assert_called_once()
        mock_claude.assert_not_called()
        print("PASS runner uses ask_openai only")

asyncio.run(main())
"""
    import subprocess

    result = subprocess.run([sys.executable, "-c", code], cwd=ROOT, env=env, capture_output=True, text=True)
    out = (result.stdout + result.stderr).strip()
    print(out)
    return 0 if result.returncode == 0 and "PASS" in out else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_run()))
