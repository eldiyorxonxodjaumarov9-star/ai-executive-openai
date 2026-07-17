import { analyzeExportContent } from "./analyze-content";
import { sanitizeExportContent } from "./sanitize-export";
import type { ExportFormat, ExportMeta } from "./types";
import { exportDocx, exportMarkdown, exportPdf, exportTxt, exportXlsx } from "./formats";
import { safeFilename } from "./helpers";

export async function exportMessage(format: ExportFormat, meta: ExportMeta): Promise<void> {
  const content = sanitizeExportContent(meta.content);
  const safeMeta: ExportMeta = {
    ...meta,
    content,
    title: meta.title || safeFilename(meta.agentLabel + "_report"),
  };
  const analysis = analyzeExportContent(content);

  switch (format) {
    case "md":
      return exportMarkdown(safeMeta);
    case "txt":
      return exportTxt(safeMeta);
    case "pdf":
      return exportPdf(safeMeta, analysis);
    case "docx":
      return exportDocx(safeMeta, analysis);
    case "xlsx":
      return exportXlsx(safeMeta, analysis);
  }
}

export { analyzeExportContent, getExportOptions } from "./analyze-content";
export type { ExportFormat, ExportMeta, ExportOption } from "./types";
