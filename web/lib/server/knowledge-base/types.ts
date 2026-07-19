/** Reusable knowledge-base types (CEO now; Finance/Sales/HR later). */

export type KnowledgeDocumentKind = "pdf" | "docx" | "txt" | "md" | "unknown";

export interface KnowledgeChunkMeta {
  fileName: string;
  sectionName: string;
  /** 1-based approximate page (PDF) or line start (text/docx). */
  pageOrLine: number;
  topic: string;
  documentType: string;
  agentId: string;
}

export interface KnowledgeChunk {
  id: string;
  text: string;
  meta: KnowledgeChunkMeta;
  /** Pre-tokenized terms for lexical/semantic scoring. */
  terms: string[];
}

export interface KnowledgeIndex {
  version: number;
  agentId: string;
  builtAt: string;
  sourceDir: string;
  documents: Array<{
    fileName: string;
    documentType: string;
    topic: string;
    chunkCount: number;
  }>;
  chunks: KnowledgeChunk[];
}

export interface RetrievalHit {
  chunk: KnowledgeChunk;
  score: number;
}

export interface RetrievalResult {
  hits: RetrievalHit[];
  query: string;
  usedChunkIds: string[];
}
