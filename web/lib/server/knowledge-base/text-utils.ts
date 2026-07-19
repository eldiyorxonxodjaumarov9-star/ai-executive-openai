import path from "path";
import type { KnowledgeDocumentKind } from "./types";

export function detectDocumentKind(fileName: string): KnowledgeDocumentKind {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".txt") return "txt";
  if (ext === ".md" || ext === ".markdown") return "md";
  return "unknown";
}

/** Infer topic / document type from HBA-* and similar filenames. */
export function inferTopicFromFileName(fileName: string): { topic: string; documentType: string } {
  const base = fileName.replace(/\.[^.]+$/, "");
  const lower = base.toLowerCase();

  const map: Array<{ match: RegExp; topic: string; documentType: string }> = [
    { match: /hba-01|davlat/, topic: "davlat_tashkilotlari", documentType: "architecture_layer" },
    { match: /hba-02|sotuv/, topic: "sotuv", documentType: "architecture_layer" },
    { match: /hba-03|tijoriy|taklif|taminotch/, topic: "tijoriy_taklif", documentType: "architecture_layer" },
    { match: /hba-04|broker/, topic: "brokerlar", documentType: "architecture_layer" },
    { match: /hba-05|taminot|logistik/, topic: "taminot_logistika", documentType: "architecture_layer" },
    { match: /hba-06|hujjat/, topic: "hujjatlashtirish", documentType: "architecture_layer" },
    { match: /hba-07|moliya/, topic: "moliya", documentType: "architecture_layer" },
    { match: /hba-08|mijoz|xizmat/, topic: "mijozlarga_xizmat", documentType: "architecture_layer" },
    { match: /hba-09|boshqaruv/, topic: "boshqaruv", documentType: "architecture_layer" },
  ];

  for (const row of map) {
    if (row.match.test(lower)) return { topic: row.topic, documentType: row.documentType };
  }

  return { topic: base.slice(0, 80), documentType: "company_document" };
}

export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}
