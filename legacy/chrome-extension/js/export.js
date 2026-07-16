/**
 * PDF, DOCX export and Markdown copy
 */
(function (global) {
  "use strict";

  const COMPANY = "HARIDLAR.UZ";
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32"><rect width="32" height="32" rx="8" fill="#1e3a5f"/><text x="40" y="22" font-family="Inter,system-ui,sans-serif" font-size="14" font-weight="700" fill="#1e3a5f">HARIDLAR.UZ</text></svg>`;

  function buildPrintHtml(meta, markdownText) {
    const rendered = global.AIEP.markdown.render(markdownText);
    const date = meta.date || new Date().toLocaleDateString();
    const time = meta.time || new Date().toLocaleTimeString();

    return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <title>${meta.title || "Rahbarlik hisoboti"}</title>
  <style>
  @page { margin: 1in; }
  body { font-family: Inter, Georgia, serif; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 24px; }
  .header { border-bottom: 2px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 24px; }
  .meta { color: #666; font-size: 13px; margin-top: 8px; }
  h1,h2,h3 { color: #1e3a5f; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
  th { background: #f3f4f6; }
  blockquote { border-left: 4px solid #3b6fd9; padding-left: 16px; color: #444; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
  pre { background: #f6f6f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    ${LOGO_SVG}
    <h1>${meta.title || "Rahbarlik hisoboti"}</h1>
    <div class="meta">
      <div>Agent: ${meta.agentLabel || meta.agent || "—"}</div>
      <div>Sana: ${date} · Tayyorlangan: ${time}</div>
    </div>
  </div>
  <div class="content">${rendered}</div>
  <div class="footer">${COMPANY} · Rahbarlik AI platformasi · Maxfiy</div>
</body>
</html>`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf(meta, markdownText) {
    const html = buildPrintHtml(meta, markdownText);
    const win = window.open("", "_blank");
    if (!win) {
      alert("PDF hisobot uchun qalqib chiquvchi oynalarga ruxsat bering.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  }

  function exportDocx(meta, markdownText) {
    const html = buildPrintHtml(meta, markdownText);
    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${meta.title || "Hisobot"}</title></head>
      <body>${html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html}</body>
      </html>`;
    const blob = new Blob([docContent], {
      type: "application/vnd.ms-word;charset=utf-8",
    });
    const filename = `executive-report-${meta.agent || "agent"}-${Date.now()}.doc`;
    downloadBlob(blob, filename);
  }

  async function copyMarkdown(markdownText) {
    await navigator.clipboard.writeText(markdownText);
  }

  async function shareReport(meta, markdownText) {
    const text = `# ${meta.title || "Rahbarlik hisoboti"}\n\nAgent: ${meta.agentLabel}\n\n${markdownText}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: meta.title, text });
        return;
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(text);
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.export = { exportPdf, exportDocx, copyMarkdown, shareReport, buildPrintHtml };
})(typeof window !== "undefined" ? window : self);
