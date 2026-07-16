"""Automated setup, server start, and endpoint verification."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT / "venv" / "Scripts" / "python.exe"
VENV_PIP = ROOT / "venv" / "Scripts" / "pip.exe"
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE = ROOT / ".env.example"
BASE_URL = "http://127.0.0.1:8000"

ENDPOINTS = [
    "/health",
    "/test/bitrix",
    "/test/leads",
    "/test/deals",
    "/test/contacts",
    "/test/tasks",
]

# Shell env vars that override .env and can break local runs.
STALE_ENV_KEYS = [
    "BITRIX24_WEBHOOK_URL",
    "ANTHROPIC_API_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "DAILY_REPORT_ENABLED",
]


def ensure_venv() -> None:
    if not VENV_PYTHON.exists():
        print("Creating virtual environment...")
        subprocess.run([sys.executable, "-m", "venv", str(ROOT / "venv")], check=True)


def install_dependencies() -> None:
    print("Installing dependencies...")
    subprocess.run([str(VENV_PIP), "install", "-r", "requirements.txt", "-q"], check=True)


def ensure_env_file() -> None:
    if not ENV_FILE.exists():
        print("Creating .env from .env.example...")
        ENV_FILE.write_text(ENV_EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")


def verify_bitrix_config() -> bool:
    print("Verifying BITRIX24_WEBHOOK_URL from .env...")
    env = subprocess.run(
        [str(VENV_PYTHON), "-c", "from app.config import get_settings; get_settings.cache_clear(); s=get_settings(); print('OK' if 'bitrix24' in s.bitrix24_webhook_url and s.bitrix24_webhook_url.startswith('https://') else 'BAD')"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    ok = "OK" in env.stdout
    print("BITRIX24_WEBHOOK_URL loaded:", "yes" if ok else "no")
    return ok


def clean_env() -> dict[str, str]:
    env = dict(os.environ)
    for key in STALE_ENV_KEYS:
        env.pop(key, None)
    return env


def wait_for_server(timeout: float = 30.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            response = httpx.get(f"{BASE_URL}/health", timeout=2.0)
            if response.status_code == 200:
                return True
        except httpx.RequestError:
            pass
        time.sleep(0.5)
    return False


async def test_endpoints() -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []
    async with httpx.AsyncClient(timeout=90.0) as client:
        for endpoint in ENDPOINTS:
            try:
                response = await client.get(f"{BASE_URL}{endpoint}")
                payload = response.json()
                if endpoint == "/health":
                    passed = payload.get("status") == "ok"
                    detail = f"status={payload.get('status')}"
                else:
                    passed = payload.get("success") is True
                    data = payload.get("data", {})
                    if isinstance(data, dict) and "count" in data:
                        detail = f"count={data.get('count')}"
                    elif passed:
                        detail = "profile_ok"
                    else:
                        detail = payload.get("error", "unknown")
                results.append((endpoint, passed, detail))
            except Exception as exc:
                results.append((endpoint, False, str(exc)))
    return results


def main() -> int:
    ensure_venv()
    install_dependencies()
    ensure_env_file()

    if not verify_bitrix_config():
        print("ERROR: BITRIX24_WEBHOOK_URL is not configured correctly in .env")
        return 1

    print("Starting FastAPI server...")
    server = subprocess.Popen(
        [str(ROOT / "venv" / "Scripts" / "uvicorn"), "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=ROOT,
        env=clean_env(),
    )

    try:
        if not wait_for_server():
            print("ERROR: Server failed to start within timeout")
            return 1

        print("Server started successfully.")
        results = asyncio.run(test_endpoints())

        print("\nEndpoint results:")
        all_passed = True
        for endpoint, passed, detail in results:
            status = "PASS" if passed else "FAIL"
            print(f"  {endpoint:16} {status:4} {detail}")
            all_passed = all_passed and passed

        bitrix_ok = any(ep == "/test/bitrix" and ok for ep, ok, _ in results)
        print("\nBitrix24 connected:", "yes" if bitrix_ok else "no")
        print("All endpoints passed:", "yes" if all_passed else "no")
        return 0 if all_passed else 1
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    raise SystemExit(main())
