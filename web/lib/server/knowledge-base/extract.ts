import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { cleanExtractedText, detectDocumentKind, inferTopicFromFileName } from "./text-utils";
import type { KnowledgeDocumentKind } from "./types";

export interface ExtractedDocument {
  fileName: string;
  kind: KnowledgeDocumentKind;
  text: string;
  topic: string;
  documentType: string;
}

async function extractPdf(filePath: string): Promise<string> {
  const mod = await import("pdf-parse");
  const pdfParse = (mod as { default?: (buf: Buffer) => Promise<{ text: string }> }).default || (mod as unknown as (buf: Buffer) => Promise<{ text: string }>);
  const buf = fs.readFileSync(filePath);
  const parsed = await pdfParse(buf);
  return cleanExtractedText(parsed.text || "");
}

async function extractDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return cleanExtractedText(result.value || "");
}

function extractPlain(filePath: string): string {
  return cleanExtractedText(fs.readFileSync(filePath, "utf-8"));
}

export async function extractDocument(filePath: string): Promise<ExtractedDocument> {
  const fileName = path.basename(filePath);
  const kind = detectDocumentKind(fileName);
  const { topic, documentType } = inferTopicFromFileName(fileName);

  let text = "";
  if (kind === "docx") text = await extractDocx(filePath);
  else if (kind === "pdf") text = await extractPdf(filePath);
  else if (kind === "txt" || kind === "md") text = extractPlain(filePath);
  else {
    throw new Error(`Qo'llab-quvvatlanmaydigan fayl turi: ${fileName}`);
  }

  return { fileName, kind, text, topic, documentType };
}

export function listKnowledgeSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => {
      if (name.startsWith(".")) return false;
      if (name === "README.md") return false;
      const kind = detectDocumentKind(name);
      return kind === "pdf" || kind === "docx" || kind === "txt" || kind === "md";
    })
    .map((name) => path.join(dir, name))
    .sort();
}
