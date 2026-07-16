export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportDocxSimple(title: string, markdown: string): void {
  const html = `<html><head><meta charset="utf-8"><title>${title}</title></head><body><pre style="font-family:Segoe UI,sans-serif;white-space:pre-wrap">${markdown.replace(/</g, "&lt;")}</pre></body></html>`;
  downloadText(`${title}.doc`, html, "application/msword");
}

export function printPdf(title: string, markdown: string): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:Segoe UI,sans-serif;padding:24px;line-height:1.6;max-width:800px;margin:0 auto}
    h1{font-size:18px} pre{white-space:pre-wrap}</style></head><body>
    <h1>${title}</h1><pre>${markdown.replace(/</g, "&lt;")}</pre></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
