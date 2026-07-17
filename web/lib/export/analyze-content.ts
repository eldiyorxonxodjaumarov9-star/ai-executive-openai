import type { ContentAnalysis, ExportProfile, ParsedTable } from "./types";

const EXECUTIVE_RE =
  /\b(hisobot|executive|kpi|pipeline|voronka|menejer|tavsiya|risk|prognoz|forecast|analytics|bitimlar|summasi)\b/i;
const TABLE_ROW_RE = /^\|(.+)\|$/;
const TABLE_SEP_RE = /^\|[-:\s|]+\|$/;

function parseMarkdownTables(content: string): ParsedTable[] {
  const lines = content.split("\n");
  const tables: ParsedTable[] = [];
  let i = 0;
  let tableIndex = 0;

  while (i < lines.length) {
    if (!TABLE_ROW_RE.test(lines[i]?.trim() || "")) {
      i++;
      continue;
    }
    const headerLine = lines[i].trim();
    const sepLine = lines[i + 1]?.trim() || "";
    if (!TABLE_SEP_RE.test(sepLine)) {
      i++;
      continue;
    }
    const headers = headerLine
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    i += 2;
    const rows: string[][] = [];
    while (i < lines.length && TABLE_ROW_RE.test(lines[i].trim())) {
      rows.push(
        lines[i]
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim())
      );
      i++;
    }
    tables.push({ name: `Table${++tableIndex}`, headers, rows });
  }
  return tables;
}

function parseSections(content: string): { name: string; body: string }[] {
  const parts = content.split(/^##\s+/m).filter(Boolean);
  if (parts.length <= 1) return [{ name: "Content", body: content }];
  return parts.map((p) => {
    const nl = p.indexOf("\n");
    const name = nl === -1 ? p.trim() : p.slice(0, nl).trim();
    const body = nl === -1 ? "" : p.slice(nl + 1).trim();
    return { name, body };
  });
}

function extractFreshness(content: string): string | null {
  const m = content.match(/Bitrix24['']?dan\s+[\d.,:\s]+da\s+yangilandi/i);
  return m ? m[0] : null;
}

function extractSummary(content: string): string {
  const lines = content.split("\n").filter((l) => l.trim());
  return lines.slice(0, 5).join("\n").slice(0, 600);
}

export function analyzeExportContent(content: string): ContentAnalysis {
  const tables = parseMarkdownTables(content);
  const hasTables = tables.length > 0;
  const hasAnalytics = EXECUTIVE_RE.test(content) || hasTables;
  const profile: ExportProfile =
    EXECUTIVE_RE.test(content) || content.length > 800 ? "executive" : "casual";

  const namedTables = tables.map((t, idx) => {
    const sectionNames = ["Summary", "Managers", "Deals", "Pipeline", "Risks", "Forecast", "Recommendations", "KPIs"];
    return { ...t, name: sectionNames[idx] || t.name };
  });

  return {
    profile,
    hasTables,
    hasAnalytics,
    freshnessLine: extractFreshness(content),
    executiveSummary: extractSummary(content),
    sections: parseSections(content),
    tables: namedTables,
  };
}

export function getExportOptions(analysis: ContentAnalysis): import("./types").ExportOption[] {
  const excelDisabled = !analysis.hasTables && !analysis.hasAnalytics;

  if (analysis.profile === "executive") {
    return [
      { format: "pdf", label: "PDF", icon: "📄" },
      { format: "docx", label: "Word (.docx)", icon: "📝" },
      { format: "xlsx", label: "Excel (.xlsx)", icon: "📊", disabled: excelDisabled },
      { format: "md", label: "Markdown (.md)", icon: "📋" },
      { format: "txt", label: "TXT", icon: "📃" },
    ];
  }

  return [
    { format: "txt", label: "TXT", icon: "📃" },
    { format: "md", label: "Markdown (.md)", icon: "📋" },
    { format: "pdf", label: "PDF", icon: "📄" },
    { format: "xlsx", label: "Excel (.xlsx)", icon: "📊", disabled: excelDisabled },
  ];
}
