"""Classify extracted company documents into agent knowledge base files."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTRACTED_DIR = ROOT / "scripts" / "extracted_docs"
KNOWLEDGE_DIR = ROOT / "knowledge"
MANIFEST_PATH = EXTRACTED_DIR / "manifest.json"
REPORT_PATH = ROOT / "scripts" / "knowledge_import_report.json"

AGENTS = ("ceo", "finance", "sales", "hr", "marketing", "customer_success")
KB_FILES = ("knowledge.md", "rules.md", "kpi.md", "faq.md", "examples.md")

# (agent, target_file, section_title)
Route = tuple[str, str, str]


def routes_for_filename(filename: str) -> list[Route]:
    """Map source filename to agent knowledge targets."""
    name = filename.lower()
    routes: list[Route] = []

    def add(agent: str, target: str, title: str) -> None:
        routes.append((agent, target, title))

    # CEO business model & strategy
    if "haridlar" in name and ("biznes" in name or "модел" in name or "model" in name):
        add("ceo", "knowledge.md", "Business Model Canvas — HARIDLAR.UZ")
        add("marketing", "knowledge.md", "Customer Segments & Channels")
        add("sales", "knowledge.md", "Customer Segments & Value Proposition")
        return routes

    if name.endswith(".png"):
        add("ceo", "faq.md", "Clarification Required — Business Model / Org Diagram Image")
        add("hr", "faq.md", "Clarification Required — Organizational Structure Image")
        return routes

    # HBA architecture layers
    if name.startswith("hba-"):
        code = name.split("_")[0]
        if "hba-01" in code:
            add("sales", "knowledge.md", "Davlat tashkilotlari bilan munosabatlar arxitekturasi")
            add("ceo", "knowledge.md", "Davlat segmenti strategiyasi")
        elif "hba-02" in code:
            add("sales", "knowledge.md", "Sotuv arxitekturasi")
            add("sales", "rules.md", "Sotuv arxitekturasi qoidalari")
        elif "hba-03" in code:
            add("sales", "knowledge.md", "Tijoriy taklif (VENU) arxitekturasi")
            add("marketing", "knowledge.md", "Tijoriy taklif va VENU")
        elif "hba-04" in code:
            add("sales", "knowledge.md", "Brokerlar bilan ishlash arxitekturasi")
        elif "hba-05" in code:
            add("ceo", "knowledge.md", "Ta'minot va logistika arxitekturasi")
            add("sales", "knowledge.md", "Ta'minot va logistika (savdo ta'siri)")
        elif "hba-06" in code:
            add("finance", "rules.md", "Hujjatlashtirish arxitekturasi")
            add("sales", "rules.md", "Hujjatlashtirish (savdo jarayoni)")
            add("ceo", "rules.md", "Hujjatlashtirish boshqaruvi")
        elif "hba-07" in code:
            add("finance", "knowledge.md", "Moliya arxitekturasi")
            add("finance", "kpi.md", "Moliya arxitekturasi KPIlari")
        elif "hba-08" in code:
            add("customer_success", "knowledge.md", "Mijozlarga xizmat arxitekturasi")
            add("customer_success", "rules.md", "Mijozlarga xizmat qoidalari")
        elif "hba-09" in code:
            add("ceo", "knowledge.md", "Boshqaruv arxitekturasi")
            add("ceo", "rules.md", "Boshqaruv va qaror qabul qilish")
            add("hr", "knowledge.md", "Boshqaruv va mas'uliyat taqsimoti")
        return routes

    # Business processes П1-П9
    if re.match(r"п\d", name) or name.startswith("п"):
        proc = name.split(".")[0].upper()
        if "п9" in name or "мурод" in name:
            add("ceo", "knowledge.md", f"Biznes jarayon {proc} — CEO strategik jarayon")
            add("ceo", "rules.md", "CEO boshqaruv jarayonlari")
        else:
            add("sales", "knowledge.md", f"Biznes jarayon {proc}")
            add("sales", "rules.md", f"Jarayon {proc} qoidalari")
            if proc in {"П1", "П2", "П3"}:
                add("sales", "examples.md", f"Jarayon {proc} namunasi")
        return routes

    # Directorate passports DP-01..04
    if name.startswith("dp-"):
        if "savdo" in name:
            add("sales", "knowledge.md", "Savdo direksiyasi pasporti")
            add("sales", "kpi.md", "Savdo direksiyasi KPIlari")
            add("sales", "rules.md", "Savdo direksiyasi qoidalari")
        elif "taminot" in name:
            add("ceo", "knowledge.md", "Ta'minot direksiyasi pasporti")
            add("sales", "knowledge.md", "Ta'minot direksiyasi (savdo integratsiyasi)")
        elif "moliya" in name:
            add("finance", "knowledge.md", "Moliya direksiyasi pasporti")
            add("finance", "kpi.md", "Moliya direksiyasi KPIlari")
            add("finance", "rules.md", "Moliya direksiyasi qoidalari")
        elif "customer_success" in name:
            add("customer_success", "knowledge.md", "Customer Success direksiyasi pasporti")
            add("customer_success", "kpi.md", "Customer Success KPIlari")
            add("customer_success", "rules.md", "Customer Success qoidalari")
        return routes

    # Practical manuals AQ-01..06
    if name.startswith("aq-"):
        if "aq-01" in name or "savdo" in name:
            add("sales", "knowledge.md", "Savdo direktori amaliy qo'llanma")
            add("sales", "rules.md", "Savdo direktori operatsion qoidalari")
            add("sales", "examples.md", "Savdo direktori amaliy misollar")
        elif "aq-02" in name or "taminot" in name:
            add("ceo", "knowledge.md", "Ta'minot direktori amaliy qo'llanma")
            add("sales", "rules.md", "Ta'minot bilan ishlash qoidalari")
        elif "aq-03" in name or "moliya" in name:
            add("finance", "knowledge.md", "Moliya direktori amaliy qo'llanma")
            add("finance", "rules.md", "Moliya direktori operatsion qoidalari")
            add("finance", "examples.md", "Moliya amaliy misollar")
        elif "aq-04" in name or "customer_success" in name:
            add("customer_success", "knowledge.md", "Customer Success direktori amaliy qo'llanma")
            add("customer_success", "rules.md", "Customer Success operatsion qoidalari")
            add("customer_success", "examples.md", "Customer Success amaliy misollar")
        elif "aq-06" in name or "it_biznes" in name or "analitika" in name:
            add("ceo", "knowledge.md", "IT va biznes analitika qo'llanmasi")
            add("hr", "knowledge.md", "IT/biznes analitika va jamoa rollari")
            for agent in AGENTS:
                add(agent, "faq.md", "CRM va analitika (IT qo'llanmasi)")
        return routes

    # Fallback
    add("ceo", "faq.md", "Clarification Required — Unclassified document")
    return routes


def format_section(title: str, source: str, body: str) -> str:
    return (
        f"\n\n## {title}\n\n"
        f"**Source:** `{source}`\n\n"
        f"{body.strip()}\n"
    )


def extract_kpi_snippets(body: str) -> str:
    lines = [ln for ln in body.splitlines() if "kpi" in ln.lower() or "reja/fakt" in ln.lower()]
    return "\n".join(lines[:80]) if lines else ""


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    buckets: dict[str, dict[str, list[str]]] = {
        agent: {kb: [] for kb in KB_FILES} for agent in AGENTS
    }
    assignments: dict[str, list[str]] = defaultdict(list)
    clarifications: list[dict] = []
    analyzed = 0
    imported = 0

    header = (
        "# Imported Company Knowledge\n\n"
        "> Auto-imported from `Ai agentlar/` documents. Facts only — no invented data.\n"
        "> Original files are unchanged.\n"
    )

    for entry in manifest:
        analyzed += 1
        filename = entry["filename"]
        rel = entry["relative_path"]
        status = entry.get("status", "unknown")

        if status != "ok":
            clarifications.append({"file": filename, "reason": status})
            continue

        extracted_rel = entry.get("extracted_to")
        if not extracted_rel:
            continue

        body = (ROOT / extracted_rel).read_text(encoding="utf-8")
        if "OCR not available" in body or "manual review required" in body.lower():
            clarifications.append({"file": filename, "reason": "Image requires manual OCR review"})

        routes = routes_for_filename(filename)
        imported += 1

        for agent, target_file, title in routes:
            section_body = body
            if target_file == "kpi.md":
                kpi_text = extract_kpi_snippets(body)
                if kpi_text:
                    section_body = kpi_text
                elif len(body) > 2500:
                    section_body = body[:2500] + "\n\n[... truncated for KPI file; see knowledge.md ...]"

            buckets[agent][target_file].append(format_section(title, filename, section_body))
            assignments[agent].append(filename)

    for agent in AGENTS:
        agent_dir = KNOWLEDGE_DIR / agent
        agent_dir.mkdir(parents=True, exist_ok=True)
        for kb_file in KB_FILES:
            path = agent_dir / kb_file
            existing = path.read_text(encoding="utf-8") if path.exists() else f"# {agent.upper()} — {kb_file}\n"
            if "## Imported Company Knowledge" in existing:
                existing = existing.split("## Imported Company Knowledge")[0].rstrip()
            new_sections = "".join(buckets[agent][kb_file])
            if new_sections:
                path.write_text(existing + "\n\n## Imported Company Knowledge\n" + new_sections, encoding="utf-8")
            elif "## Imported Company Knowledge" not in existing:
                path.write_text(existing, encoding="utf-8")

    report = {
        "files_analyzed": analyzed,
        "documents_imported": imported,
        "assignments": {k: sorted(set(v)) for k, v in assignments.items()},
        "clarifications_required": clarifications,
        "knowledge_files_updated": [
            str((KNOWLEDGE_DIR / a / f).relative_to(ROOT))
            for a in AGENTS
            for f in KB_FILES
            if buckets[a][f]
        ],
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"files_analyzed": analyzed, "documents_imported": imported}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
