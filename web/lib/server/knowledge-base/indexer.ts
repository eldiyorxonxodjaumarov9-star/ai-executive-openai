import fs from "fs";
import path from "path";
import { chunkDocumentText } from "./chunker";
import { extractDocument, listKnowledgeSourceFiles } from "./extract";
import type { KnowledgeIndex } from "./types";

export function indexPathFor(sourceDir: string): string {
  return path.join(sourceDir, ".index", "chunks.json");
}

export async function buildKnowledgeIndex(options: {
  agentId: string;
  sourceDir: string;
}): Promise<KnowledgeIndex> {
  const files = listKnowledgeSourceFiles(options.sourceDir);
  const chunks = [];
  const documents: KnowledgeIndex["documents"] = [];

  for (const filePath of files) {
    const doc = await extractDocument(filePath);
    if (!doc.text.trim()) continue;
    const docChunks = chunkDocumentText(doc.text, {
      fileName: doc.fileName,
      topic: doc.topic,
      documentType: doc.documentType,
      agentId: options.agentId,
    });
    chunks.push(...docChunks);
    documents.push({
      fileName: doc.fileName,
      documentType: doc.documentType,
      topic: doc.topic,
      chunkCount: docChunks.length,
    });
  }

  const index: KnowledgeIndex = {
    version: 1,
    agentId: options.agentId,
    builtAt: new Date().toISOString(),
    sourceDir: options.sourceDir,
    documents,
    chunks,
  };

  const out = indexPathFor(options.sourceDir);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(index), "utf-8");
  return index;
}

export function loadKnowledgeIndex(sourceDir: string): KnowledgeIndex | null {
  const file = indexPathFor(sourceDir);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as KnowledgeIndex;
  } catch {
    return null;
  }
}

export async function ensureKnowledgeIndex(options: {
  agentId: string;
  sourceDir: string;
  forceRebuild?: boolean;
}): Promise<KnowledgeIndex> {
  if (!options.forceRebuild) {
    const existing = loadKnowledgeIndex(options.sourceDir);
    const sourceFiles = listKnowledgeSourceFiles(options.sourceDir);
    if (existing && existing.agentId === options.agentId && existing.documents.length === sourceFiles.length) {
      return existing;
    }
  }
  return buildKnowledgeIndex(options);
}
