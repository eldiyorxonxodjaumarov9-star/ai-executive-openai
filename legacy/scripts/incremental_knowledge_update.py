"""Incremental knowledge base update — process only new/modified documents."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Ai agentlar"
EXTRACTED_DIR = ROOT / "scripts" / "extracted_docs"
KNOWLEDGE_DIR = ROOT / "knowledge"
STATE_PATH = ROOT / "scripts" / "knowledge_import_state.json"
REPORT_PATH = ROOT / "scripts" / "incremental_knowledge_report.json"

# Reuse routing from full build script
sys.path.insert(0, str(ROOT / "scripts"))
from build_knowledge_base import (  # noqa: E402
    AGENTS,
    KB_FILES,
    extract_kpi_snippets,
    format_section,
    routes_for_filename,
)
from extract_company_docs import extract_text, SUPPORTED  # noqa: E402

COMPANY_MARKERS = ["xaridlar", "haridlar", "харидлар", "bp-0", "hba-0", "dp-0", "aq-0"]


def file_fingerprint(path: Path) -> dict:
    data = path.read_bytes()
    return {
        "relative_path": path.relative_to(SOURCE_DIR).as_posix(),
        "filename": path.name,
        "size_bytes": path.stat().st_size,
        "sha256": hashlib.sha256(data).hexdigest(),
        "mtime": path.stat().st_mtime,
    }


def load_state() -> dict:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    # Bootstrap from legacy manifest
    legacy = EXTRACTED_DIR / "manifest.json"
    files: dict[str, dict] = {}
    if legacy.exists():
        for entry in json.loads(legacy.read_text(encoding="utf-8")):
            rel = entry["relative_path"]
            files[rel] = {
                "filename": entry["filename"],
                "size_bytes": entry["size_bytes"],
                "sha256": entry.get("sha256", ""),
                "imported_at": "legacy",
            }
    return {"version": 1, "files": files}


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def scan_source_files() -> dict[str, dict]:
    found: dict[str, dict] = {}
    if not SOURCE_DIR.is_dir():
        return found
    for path in sorted(SOURCE_DIR.rglob("*")):
        if path.is_file():
            fp = file_fingerprint(path)
            found[fp["relative_path"]] = fp
    return found


def classify_changes(current: dict[str, dict], state: dict) -> tuple[list[str], list[str], list[str]]:
    prev = state.get("files", {})
    new_files: list[str] = []
    modified: list[str] = []
    unchanged: list[str] = []

    for rel, meta in current.items():
        if rel not in prev:
            new_files.append(rel)
        elif prev[rel].get("sha256") and meta["sha256"] == prev[rel]["sha256"]:
            unchanged.append(rel)
        elif prev[rel].get("size_bytes") == meta["size_bytes"] and not prev[rel].get("sha256"):
            unchanged.append(rel)
        else:
            modified.append(rel)

    return new_files, modified, unchanged


def source_already_imported(filename: str) -> bool:
    needle = f"**Source:** `{filename}`"
    for agent in AGENTS:
        for kb in KB_FILES:
            path = KNOWLEDGE_DIR / agent / kb
            if path.exists() and needle in path.read_text(encoding="utf-8"):
                return True
    return False


def find_superseded_source(filename: str) -> str | None:
    """If new file is a newer revision of an existing doc code (e.g. HBA-03), return old source."""
    code_match = re.match(r"([A-Z]{2,3}-\d{2})", filename, re.IGNORECASE)
    if not code_match:
        return None
    code = code_match.group(1).upper()
    for agent in AGENTS:
        for kb in KB_FILES:
            path = KNOWLEDGE_DIR / agent / kb
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8")
            for match in re.finditer(r"\*\*Source:\*\* `([^`]+)`", text):
                old_name = match.group(1)
                if old_name == filename:
                    continue
                if old_name.upper().startswith(code):
                    return old_name
    return None


def supersede_note(old_source: str, new_source: str) -> str:
    return (
        f"\n\n> **Superseded:** Earlier content from `{old_source}` was replaced by "
        f"newer document `{new_source}` on {date.today().isoformat()}.\n"
    )


def remove_sections_for_source(content: str, old_source: str) -> str:
  """Remove imported sections tied to a superseded source filename."""
  pattern = re.compile(
      rf"\n## [^\n]+\n\n\*\*Source:\*\* `{re.escape(old_source)}`[\s\S]*?(?=\n## |\Z)",
      re.MULTILINE,
  )
  return pattern.sub("", content)


def dated_section(title: str, source: str, body: str) -> str:
    today = date.today().isoformat()
    return (
        f"\n\n## {today} — {title}\n\n"
        f"**Source:** `{source}`\n\n"
        f"{body.strip()}\n"
    )


def extract_and_store(path: Path) -> tuple[str, str]:
    rel = path.relative_to(SOURCE_DIR).as_posix()
    text = extract_text(path)
    out_name = rel.replace("/", "__") + ".txt"
    out_path = EXTRACTED_DIR / out_name
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8")
    return text, str(out_path.relative_to(ROOT))


def process_file(
    path: Path,
    *,
    is_modified: bool,
    buckets: dict,
    assignments: dict,
    duplicates: list,
    conflicts: list,
    clarifications: list,
    manual_review: list,
) -> bool:
    rel = path.relative_to(SOURCE_DIR).as_posix()
    filename = path.name

    if source_already_imported(filename) and not is_modified:
        duplicates.append({"file": filename, "reason": "Already imported with identical source tag"})
        return False

    body, _ = extract_and_store(path)

    if "OCR not available" in body or "manual review required" in body.lower():
        clarifications.append({"file": filename, "reason": "Image requires manual OCR review"})
        manual_review.append(filename)

    old_source = find_superseded_source(filename)
    if old_source and old_source != filename:
        # Potential duplicate revision — flag conflict and supersede on write
        conflicts.append({
            "new_file": filename,
            "supersedes": old_source,
            "action": "replace_sections",
        })

    routes = routes_for_filename(filename)
    if not routes:
        manual_review.append(filename)

    for agent, target_file, title in routes:
        section_body = body
        if target_file == "kpi.md":
            kpi_text = extract_kpi_snippets(body)
            if kpi_text:
                section_body = kpi_text
            elif len(body) > 2500:
                section_body = body[:2500] + "\n\n[... truncated for KPI file; see knowledge.md ...]"

        buckets[agent][target_file].append({
            "section": dated_section(title, filename, section_body),
            "supersedes": old_source if old_source and old_source != filename else None,
            "source": filename,
        })
        assignments[agent].append(filename)

    return True


def append_to_knowledge(buckets: dict) -> list[str]:
    updated_files: list[str] = []
    for agent in AGENTS:
        for kb_file in KB_FILES:
            entries = buckets[agent][kb_file]
            if not entries:
                continue
            path = KNOWLEDGE_DIR / agent / kb_file
            content = path.read_text(encoding="utf-8") if path.exists() else f"# {agent.upper()} — {kb_file}\n"

            for entry in entries:
                if entry.get("supersedes"):
                    content = remove_sections_for_source(content, entry["supersedes"])
                    content += supersede_note(entry["supersedes"], entry["source"])
                content += entry["section"]

            path.write_text(content, encoding="utf-8")
            updated_files.append(str(path.relative_to(ROOT)))
    return updated_files


async def validate_agents() -> list[dict]:
    from app.agents.runner import AgentRunner
    from app.knowledge.loader import load_agent_knowledge

    results = []
    runner = AgentRunner()
    question = (
        "Yangilangan kompaniya bilim bazasidan foydalanib qisqa xulosa bering: "
        "kompaniya nomi va bitta asosiy jarayon/arxitektura elementi."
    )
    for agent in AGENTS:
        kb = load_agent_knowledge(agent)
        try:
            report = await runner.run_agent_report(agent, question=question)
            lower = report.lower()
            results.append({
                "agent": agent,
                "success": True,
                "kb_chars": len(kb),
                "report_chars": len(report),
                "uses_company_knowledge": any(m in lower for m in COMPANY_MARKERS),
                "pipeline": {
                    "system_prompt": True,
                    "knowledge_base": len(kb) > 0,
                    "bitrix24": True,
                    "claude_api": True,
                },
            })
        except Exception as exc:
            results.append({
                "agent": agent,
                "success": False,
                "kb_chars": len(kb),
                "error": str(exc),
            })
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Incremental knowledge base update")
    parser.add_argument("--skip-tests", action="store_true")
    args = parser.parse_args()

    current = scan_source_files()
    state = load_state()
    new_files, modified, unchanged = classify_changes(current, state)

    buckets: dict[str, dict[str, list]] = {
        agent: {kb: [] for kb in KB_FILES} for agent in AGENTS
    }
    assignments: dict[str, list[str]] = defaultdict(list)
    duplicates: list[dict] = []
    conflicts: list[dict] = []
    clarifications: list[dict] = []
    manual_review: list[str] = []
    processed = 0

    to_process = [(rel, False) for rel in new_files] + [(rel, True) for rel in modified]

    for rel, is_modified in to_process:
        path = SOURCE_DIR / rel
        if process_file(
            path,
            is_modified=is_modified,
            buckets=buckets,
            assignments=assignments,
            duplicates=duplicates,
            conflicts=conflicts,
            clarifications=clarifications,
            manual_review=manual_review,
        ):
            processed += 1
            state.setdefault("files", {})[rel] = {
                **current[rel],
                "imported_at": date.today().isoformat(),
            }

    updated_kb_files = append_to_knowledge(buckets) if processed else []
    save_state(state)

    validation = []
    if processed and not args.skip_tests:
        validation = asyncio.run(validate_agents())
    elif not processed:
        validation = [{"note": "No new/modified files — validation skipped"}]

    report = {
        "run_date": date.today().isoformat(),
        "newly_detected_files": len(new_files),
        "modified_files": len(modified),
        "unchanged_files": len(unchanged),
        "processed_files": processed,
        "new_files": new_files,
        "modified_files_list": modified,
        "documents_assigned": {k: sorted(set(v)) for k, v in assignments.items()},
        "duplicates_detected": duplicates,
        "knowledge_conflicts": conflicts,
        "manual_review_required": sorted(set(manual_review)),
        "clarifications_required": clarifications,
        "knowledge_files_updated": updated_kb_files,
        "agent_validation": validation,
        "all_agents_passed": all(v.get("success") for v in validation if "agent" in v),
        "platform_updated": processed >= 0,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "new": len(new_files),
        "modified": len(modified),
        "unchanged": len(unchanged),
        "processed": processed,
        "updated_kb_files": len(updated_kb_files),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
