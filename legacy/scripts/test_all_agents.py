"""Test all agent report endpoints."""

from __future__ import annotations

import json
import sys
import time

import httpx

BASE_URL = "http://127.0.0.1:8000"
AGENTS = ["ceo", "sales", "finance", "hr", "marketing", "customer_success"]
TIMEOUT = 300.0


def main() -> int:
    results = []
    client = httpx.Client(timeout=TIMEOUT)

    for agent in AGENTS:
        started = time.time()
        entry = {"agent": agent, "success": False, "report_length": 0, "error": None}
        try:
            response = client.post(f"{BASE_URL}/reports/agent/{agent}")
            payload = response.json()
            entry["success"] = payload.get("success") is True
            report = payload.get("report") or ""
            entry["report_length"] = len(report)
            entry["error"] = payload.get("error")
            entry["elapsed_sec"] = round(time.time() - started, 1)
        except Exception as exc:
            entry["error"] = str(exc)
            entry["elapsed_sec"] = round(time.time() - started, 1)
        results.append(entry)
        print(json.dumps(entry, ensure_ascii=False), flush=True)

    client.close()
    all_ok = all(r["success"] for r in results)
    print("ALL_SUCCESS=" + str(all_ok).lower(), flush=True)
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
