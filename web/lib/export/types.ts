import type { AgentId } from "../constants";

export type ExportFormat = "pdf" | "docx" | "xlsx" | "md" | "txt";

export type ExportProfile = "casual" | "executive";

export interface ExportMeta {
  agentId: AgentId;
  agentLabel: string;
  title: string;
  content: string;
  userQuestion?: string;
  fetchedAt?: string;
}

export interface ContentAnalysis {
  profile: ExportProfile;
  hasTables: boolean;
  hasAnalytics: boolean;
  freshnessLine: string | null;
  executiveSummary: string;
  sections: ExportSection[];
  tables: ParsedTable[];
}

export interface ExportSection {
  name: string;
  body: string;
}

export interface ParsedTable {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ExportOption {
  format: ExportFormat;
  label: string;
  icon: string;
  disabled?: boolean;
}
