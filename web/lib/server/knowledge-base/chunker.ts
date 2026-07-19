import { tokenize } from "./text-utils";
import type { KnowledgeChunk, KnowledgeChunkMeta } from "./types";

const DEFAULT_TARGET_CHARS = 900;
const DEFAULT_OVERLAP_CHARS = 120;

export interface ChunkOptions {
  targetChars?: number;
  overlapChars?: number;
}

function splitIntoSections(text: string): Array<{ sectionName: string; body: string; lineStart: number }> {
  const lines = text.split("\n");
  const sections: Array<{ sectionName: string; body: string; lineStart: number }> = [];
  let currentName = "Kirish";
  let currentLines: string[] = [];
  let sectionLineStart = 1;

  const flush = () => {
    const body = currentLines.join("\n").trim();
    if (!body) return;
    sections.push({ sectionName: currentName, body, lineStart: sectionLineStart });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading =
      /^(#{1,4}\s+.+)$/.test(line.trim()) ||
      /^(\d+(\.\d+)*[\).]?\s+\S.+)$/.test(line.trim()) ||
      /^([A-ZА-ЯЎҚҒҲ][A-ZА-ЯЎҚҒҲ\s]{8,})$/.test(line.trim());

    if (heading && currentLines.join("").trim().length > 40) {
      flush();
      currentName = line.replace(/^#+\s*/, "").trim().slice(0, 120) || `Bo'lim ${sections.length + 1}`;
      currentLines = [];
      sectionLineStart = i + 1;
    }
    currentLines.push(line);
  }
  flush();

  if (!sections.length && text.trim()) {
    sections.push({ sectionName: "Umumiy", body: text.trim(), lineStart: 1 });
  }
  return sections;
}

function windowChunks(body: string, target: number, overlap: number): string[] {
  if (body.length <= target) return [body];
  const out: string[] = [];
  let start = 0;
  while (start < body.length) {
    let end = Math.min(body.length, start + target);
    if (end < body.length) {
      const soft = body.lastIndexOf("\n", end);
      if (soft > start + target * 0.5) end = soft;
    }
    const slice = body.slice(start, end).trim();
    if (slice) out.push(slice);
    if (end >= body.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out;
}

export function chunkDocumentText(
  text: string,
  baseMeta: Omit<KnowledgeChunkMeta, "sectionName" | "pageOrLine">,
  options: ChunkOptions = {}
): KnowledgeChunk[] {
  const target = options.targetChars ?? DEFAULT_TARGET_CHARS;
  const overlap = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const sections = splitIntoSections(text);
  const chunks: KnowledgeChunk[] = [];
  let idx = 0;

  for (const section of sections) {
    const windows = windowChunks(section.body, target, overlap);
    let offset = 0;
    for (const window of windows) {
      idx += 1;
      const lineApprox = section.lineStart + Math.floor(offset / 80);
      const id = `${baseMeta.fileName}::${idx}`;
      chunks.push({
        id,
        text: window,
        meta: {
          ...baseMeta,
          sectionName: section.sectionName,
          pageOrLine: Math.max(1, lineApprox),
        },
        terms: tokenize(`${window} ${section.sectionName} ${baseMeta.topic} ${baseMeta.fileName}`),
      });
      offset += window.length;
    }
  }

  return chunks;
}
