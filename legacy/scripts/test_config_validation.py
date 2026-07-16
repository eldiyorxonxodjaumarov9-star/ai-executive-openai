"""Validate AI provider config rules without touching .env."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BITRIX = "https://example.bitrix24.uz/rest/1/testtoken/"


def run_case(name: str, extra: dict[str, str]) -> tuple[str, str]:
    env = os.environ.copy()
    for key in (
        "AI_PROVIDER",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GOOGLE_API_KEY",
        "BITRIX24_WEBHOOK_URL",
    ):
        env.pop(key, None)
    env["BITRIX24_WEBHOOK_URL"] = BITRIX
    env.update(extra)
    # Explicitly clear keys not set — .env must not leak into isolated cases.
    if "ANTHROPIC_API_KEY" not in extra:
        env["ANTHROPIC_API_KEY"] = ""
    if "OPENAI_API_KEY" not in extra:
        env["OPENAI_API_KEY"] = ""
    if "GOOGLE_API_KEY" not in extra:
        env["GOOGLE_API_KEY"] = ""

    code = r"""
from pydantic import ValidationError
from app.config import Settings
import app.config as cfg
cfg._startup_logged = False
try:
    s = Settings()
    print("PASS", s.ai_provider, s.openai_configured, s.claude_legacy_configured)
except ValidationError as exc:
    msg = exc.errors()[0].get("msg", str(exc))
    print("FAIL", msg)
except ValueError as exc:
    print("FAIL", str(exc))
"""
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    out = (result.stdout or result.stderr).strip().splitlines()
    line = out[-1] if out else f"FAIL exit={result.returncode}"
    status = "PASS" if line.startswith("PASS") else "FAIL"
    return status, line


def main() -> int:
    cases = [
        (
            "openai provider + OpenAI key only",
            {"AI_PROVIDER": "openai", "OPENAI_API_KEY": "sk-test-openai"},
            "PASS",
        ),
        (
            "claude provider + Anthropic key only",
            {"AI_PROVIDER": "claude", "ANTHROPIC_API_KEY": "sk-ant-test"},
            "PASS",
        ),
        (
            "openai provider without OpenAI key",
            {"AI_PROVIDER": "openai"},
            "FAIL",
        ),
    ]

    print("Config validation tests:")
    ok = True
    for label, env, expected in cases:
        status, detail = run_case(label, env)
        passed = status == expected
        ok = ok and passed
        mark = "OK" if passed else "X"
        print(f"  [{mark}] {label}: {detail}")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
