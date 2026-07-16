/**
 * File upload — extract text client-side, send via RUN_AGENT attachments
 */
(function (global) {
  "use strict";

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_TEXT = 50000;

  async function readFileAsText(file) {
    if (file.type === "text/csv" || file.type === "text/plain" || file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      const text = await file.text();
      return text.slice(0, MAX_TEXT);
    }

    if (file.name.endsWith(".xlsx") || file.type.includes("spreadsheet")) {
      return `[Attachment: ${file.name}]\nSpreadsheet uploaded. Please analyze based on filename and user question.`;
    }

    if (file.name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
      const buffer = await file.arrayBuffer();
      const text = extractDocxText(buffer);
      return text.slice(0, MAX_TEXT) || `[DOCX: ${file.name}]`;
    }

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      return `[PDF Attachment: ${file.name}]\nPDF content uploaded for analysis.`;
    }

    const fallback = await file.text().catch(() => "");
    return fallback.slice(0, MAX_TEXT) || `[File: ${file.name}]`;
  }

  function extractDocxText(buffer) {
    try {
      const bytes = new Uint8Array(buffer);
      const decoder = new TextDecoder("utf-8");
      const raw = decoder.decode(bytes);
      const matches = raw.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      return matches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ");
    } catch {
      return "";
    }
  }

  async function processFiles(fileList) {
    const attachments = [];
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${file.name} (max 5MB)`);
      }
      const content = await readFileAsText(file);
      attachments.push({
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        content,
        size: file.size,
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      });
    }
    return attachments;
  }

  function renderAttachmentChip(att, onRemove, onPreview) {
    const chip = document.createElement("div");
    chip.className = "aiep-attachment";
    chip.dataset.id = att.id;
    chip.innerHTML = `
      <span class="aiep-attachment-icon">${global.AIEP.icons.icon("paperclip", 14)}</span>
      <span class="aiep-attachment-name" title="${att.name}">${att.name}</span>
      <button type="button" class="aiep-attachment-preview" title="Preview">${global.AIEP.icons.icon("eye", 14)}</button>
      <button type="button" class="aiep-attachment-remove" title="Remove">${global.AIEP.icons.icon("x", 14)}</button>
    `;
    chip.querySelector(".aiep-attachment-remove").addEventListener("click", () => onRemove(att.id));
    chip.querySelector(".aiep-attachment-preview").addEventListener("click", () => onPreview(att));
    return chip;
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.upload = { processFiles, renderAttachmentChip, readFileAsText };
})(typeof window !== "undefined" ? window : self);
