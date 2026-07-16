/**
 * Canvas chart engine (Chart.js-compatible subset)
 */
(function (global) {
  "use strict";

  const PALETTE = ["#3b6fd9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

  function extractChartData(text, keywords) {
    const lower = text.toLowerCase();
    if (!keywords.some((k) => lower.includes(k))) return null;

    const rows = [];
    const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
    let match;
    while ((match = tableRegex.exec(text)) !== null) {
      const headers = match[1].split("|").map((h) => h.trim()).filter(Boolean);
      const bodyRows = match[2].trim().split("\n");
      bodyRows.forEach((row) => {
        const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 2) rows.push({ label: cells[0], values: cells.slice(1).map(parseNum) });
      });
      if (rows.length && headers.length >= 2) {
        return { headers, rows, type: detectType(lower) };
      }
    }

    const bulletRegex = /^[-*]\s+\*?\*?([^:*]+)\*?\*?:\s*([\d,.]+)/gim;
    const bullets = [];
    let b;
    while ((b = bulletRegex.exec(text)) !== null) {
      bullets.push({ label: b[1].trim(), value: parseNum(b[2]) });
    }
    if (bullets.length >= 2) {
      return {
        headers: ["Item", "Value"],
        rows: bullets.map((x) => ({ label: x.label, values: [x.value] })),
        type: detectType(lower),
      };
    }

    return null;
  }

  function parseNum(s) {
    const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  function detectType(text) {
    if (/trend|over time|monthly|weekly|timeline/i.test(text)) return "line";
    if (/share|distribution|breakdown|percent/i.test(text)) return "pie";
    if (/cash\s*flow|revenue trend/i.test(text)) return "area";
    return "bar";
  }

  function drawChart(canvas, chartData) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 200;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const { rows, type } = chartData;
    const labels = rows.map((r) => r.label);
    const values = rows.map((r) => r.values[0] || 0);
    const max = Math.max(...values, 1);

    ctx.clearRect(0, 0, w, h);

    if (type === "pie") {
      drawPie(ctx, labels, values, w, h);
    } else if (type === "line" || type === "area") {
      drawLine(ctx, labels, values, w, h, type === "area");
    } else {
      drawBar(ctx, labels, values, w, h, max);
    }
  }

  function drawBar(ctx, labels, values, w, h, max) {
    const pad = { t: 20, r: 16, b: 40, l: 16 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const barW = chartW / values.length - 8;

    values.forEach((v, i) => {
      const barH = (v / max) * chartH;
      const x = pad.l + i * (barW + 8) + 4;
      const y = pad.t + chartH - barH;
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 4);
      ctx.fill();
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      const label = labels[i].length > 10 ? labels[i].slice(0, 9) + "…" : labels[i];
      ctx.fillText(label, x + barW / 2, h - 12);
    });
  }

  function drawLine(ctx, labels, values, w, h, fill) {
    const pad = { t: 20, r: 16, b: 40, l: 16 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const max = Math.max(...values, 1);
    const points = values.map((v, i) => ({
      x: pad.l + (i / Math.max(values.length - 1, 1)) * chartW,
      y: pad.t + chartH - (v / max) * chartH,
    }));

    if (fill) {
      ctx.fillStyle = "rgba(59, 111, 217, 0.15)";
      ctx.beginPath();
      ctx.moveTo(points[0].x, pad.t + chartH);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, pad.t + chartH);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "#3b6fd9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    points.forEach((p, i) => {
      ctx.fillStyle = "#3b6fd9";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(labels[i]?.slice(0, 8) || "", p.x, h - 12);
    });
  }

  function drawPie(ctx, labels, values, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 10;
    const r = Math.min(w, h) / 2 - 30;
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let angle = -Math.PI / 2;

    values.forEach((v, i) => {
      const slice = (v / total) * Math.PI * 2;
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fill();
      angle += slice;
    });

    ctx.font = "10px Inter, system-ui, sans-serif";
    labels.forEach((label, i) => {
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fillRect(16, 16 + i * 16, 8, 8);
      ctx.fillStyle = "#374151";
      ctx.textAlign = "left";
      ctx.fillText(`${label}: ${values[i]}`, 28, 24 + i * 16);
    });
  }

  function renderChartsInSection(sectionEl, bodyText, keywords) {
    const data = extractChartData(bodyText, keywords || ["pipeline", "revenue", "sales", "leads", "cashflow", "deals"]);
    if (!data) return;

    const wrap = document.createElement("div");
    wrap.className = "aiep-chart-wrap";
    const canvas = document.createElement("canvas");
    canvas.className = "aiep-chart";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Data chart");
    wrap.appendChild(canvas);
    sectionEl.querySelector(".aiep-card-body")?.prepend(wrap);
    requestAnimationFrame(() => drawChart(canvas, data));
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.charts = { extractChartData, drawChart, renderChartsInSection };
})(typeof window !== "undefined" ? window : self);
