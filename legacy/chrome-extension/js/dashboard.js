/**
 * AI Executive Dashboard — main UI controller
 */
(function (global) {
  "use strict";

  if (!global.AIEP?.config || !global.AIEP?.icons) {
    console.error("[AIEP ERROR] dashboard.js: config yoki icons yuklanmagan");
    return;
  }

  const {
    config,
    icons,
    state,
    history,
    errors,
    reportCards,
    export: exportUtil,
    loading,
    upload,
    statusBar,
  } = global.AIEP;

  class ExecutiveDashboard {
    constructor() {
      this.attachments = [];
      this.currentReport = null;
      this.loadingHandle = null;
      this.statusInterval = null;
      this.lastQuestion = "";
      this.lastAgent = "ceo";
      this.isSubmitting = false;
      this.abortController = null;
      this._scrollTimer = null;
      this.pendingJobId = null;
    }

    mount(parentEl) {
      const parent = parentEl || document.documentElement || document.body;
      let root = document.getElementById("aiep-root");

      if (root && root.parentElement !== parent) {
        parent.appendChild(root);
      }

      if (root) {
        this.adopt(root);
        return;
      }

      root = document.createElement("div");
      root.id = "aiep-root";
      root.dataset.theme = "light";
      parent.appendChild(root);

      root.innerHTML = `
        <div id="aiep-backdrop" class="aiep-backdrop"></div>
        <button id="aiep-fab" type="button" class="aiep-fab" aria-label="Rahbarlik AI platformasini ochish">
          ${icons.icon("briefcase", 18)}
          <span>Rahbar AI</span>
        </button>
        <aside id="aiep-panel" class="aiep-panel" role="dialog" aria-label="Rahbarlik AI platformasi">
          <div id="aiep-status" class="aiep-status-wrap"></div>
          <header class="aiep-sticky-header">
            <div class="aiep-sticky-top">
              <div class="aiep-brand">
                ${icons.icon("briefcase", 20)}
                <div>
                  <h1>Rahbarlik AI platformasi</h1>
                  <p class="aiep-agent-label" id="aiep-agent-label">Bosh direktor agenti</p>
                </div>
              </div>
              <div class="aiep-header-actions">
                <button type="button" id="aiep-refresh-panel" class="aiep-icon-btn" title="Oynani yangilash">${icons.icon("refresh", 18)}</button>
                <button type="button" id="aiep-theme-toggle" class="aiep-icon-btn" title="Mavzuni almashtirish">${icons.icon("moon", 18)}</button>
                <button type="button" id="aiep-history-toggle" class="aiep-icon-btn" title="Tarix">${icons.icon("history", 18)}</button>
                <button type="button" class="aiep-icon-btn aiep-close" title="Yopish">${icons.icon("x", 18)}</button>
              </div>
            </div>
            <div class="aiep-report-meta" id="aiep-report-meta">
              <span id="aiep-report-date"></span>
              <span id="aiep-report-time"></span>
            </div>
            <div class="aiep-export-bar">
              <button type="button" id="aiep-export-pdf" class="aiep-export-btn">${icons.icon("download", 14)} PDF hisobot</button>
              <button type="button" id="aiep-export-docx" class="aiep-export-btn">${icons.icon("file-text", 14)} DOCX</button>
              <button type="button" id="aiep-copy-md" class="aiep-export-btn">${icons.icon("copy", 14)} Nusxalash</button>
              <button type="button" id="aiep-share" class="aiep-export-btn">${icons.icon("share", 14)} Ulashish</button>
            </div>
          </header>

          <div class="aiep-history-panel" id="aiep-history-panel" hidden>
            <div class="aiep-history-header">
              <h3>Hisobotlar tarixi</h3>
              <input type="search" id="aiep-history-search" placeholder="Tarixdan qidirish…" aria-label="Tarixdan qidirish" />
            </div>
            <ul id="aiep-history-list" class="aiep-history-list"></ul>
          </div>

          <div class="aiep-report-search-wrap">
            <span class="aiep-search-icon">${icons.icon("search", 16)}</span>
            <input type="search" id="aiep-report-search" class="aiep-report-search" placeholder="Hisobot ichidan qidirish…" aria-label="Hisobot ichidan qidirish" />
          </div>

          <div class="aiep-report-scroll" id="aiep-report-scroll">
            <div id="aiep-error" class="aiep-error-banner" hidden></div>
            <div id="aiep-report-cards" class="aiep-report-cards">
              <div class="aiep-empty-state">
                ${icons.icon("file-text", 48)}
                <p>Birinchi savolingizni yozing — tez javob olasiz. To'liq hisobot uchun «to'liq hisobot» deb yozing.</p>
              </div>
            </div>
          </div>

          <footer class="aiep-composer">
            <div class="aiep-upload-zone" id="aiep-upload-zone">
              <input type="file" id="aiep-file-input" multiple accept=".pdf,.docx,.xlsx,.csv,.txt" hidden />
              <div class="aiep-upload-inner">
                ${icons.icon("upload", 20)}
                <span>Faylni tashlang yoki tanlang</span>
                <small>PDF, DOCX, XLSX, CSV, TXT</small>
              </div>
            </div>
            <div id="aiep-attachments" class="aiep-attachments"></div>
            <div class="aiep-composer-row">
              <select id="aiep-agent" class="aiep-agent-select" aria-label="Agentni tanlash"></select>
              <button type="button" id="aiep-send" class="aiep-send-btn">So'rash</button>
            </div>
            <textarea id="aiep-question" class="aiep-question" rows="3" placeholder="Masalan: bugun nechta bitim yopildi?" aria-label="Savol"></textarea>
            <div class="aiep-panel-footer">
              <span id="aiep-version-footer" class="aiep-version-label"></span>
            </div>
          </footer>
        </aside>
      `;

      this.root = root;
      this.finishMount();
    }

    adopt(root) {
      this.root = root;
      this.finishMount();
    }

    finishMount() {
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = null;
      }
      this.cacheElements();
      if (!this.els.fab?.dataset.aiepBound) {
        this.bindEvents();
      }
      try {
        if (this.els.agentSelect && !this.els.agentSelect.options.length) {
          this.populateAgents();
        }
      } catch (err) {
        console.error("[AIEP ERROR] agentlar ro'yxati:", err);
      }
      this.setVersionLabel();
      this.root.dataset.aiepReady = "1";
      const panel = this.els.panel;
      if (panel) panel.setAttribute("aria-hidden", "true");
      global.AIEP.activeDashboard = this;
      this.initState().catch((err) => console.error("[AIEP ERROR] initState:", err));
    }

    onPanelOpen() {
      if (!this.els?.status) return;
      if (this.statusInterval) return;
      statusBar.renderStatusBar(this.els.status);
      this.statusInterval = statusBar.startPolling(this.els.status);
    }

    cacheElements() {
      const q = (sel) => this.root.querySelector(sel);
      this.els = {
        backdrop: q("#aiep-backdrop"),
        fab: q("#aiep-fab"),
        panel: q("#aiep-panel"),
        status: q("#aiep-status"),
        agentSelect: q("#aiep-agent"),
        agentLabel: q("#aiep-agent-label"),
        question: q("#aiep-question"),
        send: q("#aiep-send"),
        reportCards: q("#aiep-report-cards"),
        reportScroll: q("#aiep-report-scroll"),
        reportSearch: q("#aiep-report-search"),
        error: q("#aiep-error"),
        reportDate: q("#aiep-report-date"),
        reportTime: q("#aiep-report-time"),
        uploadZone: q("#aiep-upload-zone"),
        fileInput: q("#aiep-file-input"),
        attachments: q("#aiep-attachments"),
        historyPanel: q("#aiep-history-panel"),
        historyList: q("#aiep-history-list"),
        historySearch: q("#aiep-history-search"),
        themeToggle: q("#aiep-theme-toggle"),
        exportBar: q(".aiep-export-bar"),
        versionFooter: q("#aiep-version-footer"),
      };
    }

    setVersionLabel() {
      if (this.els.versionFooter) {
        this.els.versionFooter.textContent = `v${config.getVersion()}`;
      }
    }

    populateAgents() {
      const active = config.getActiveAgents();
      const future = config.AGENT_REGISTRY.filter((a) => a.disabled);
      [...active, ...future].forEach((agent) => {
        const opt = document.createElement("option");
        opt.value = agent.id;
        opt.textContent = agent.label + (agent.disabled ? " (tez orada)" : "");
        opt.disabled = !!agent.disabled;
        this.els.agentSelect.appendChild(opt);
      });
    }

    async initState() {
      if (global.AIEP.migrate?.runMigrations) {
        await global.AIEP.migrate.runMigrations();
      }

      const theme = await state.loadTheme();
      this.setTheme(theme);
      const agent = await state.loadAgent();
      if (agent) {
        this.els.agentSelect.value = agent;
        this.updateAgentLabel(agent);
      }
      statusBar.renderStatusBar(this.els.status);
      this.statusInterval = statusBar.startPolling(this.els.status);

      const last = await state.loadLastReport();
      if (last?.markdown) {
        this.displayReport(last);
      }

      const scroll = await state.loadScroll();
      if (scroll) this.els.reportScroll.scrollTop = scroll;

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes.connectorSecret) {
          statusBar.pollStatus(this.els.status);
        }
      });
    }

    bindEvents() {
      if (!this.els.fab) {
        throw new Error("FAB topilmadi");
      }
      this.els.fab.dataset.aiepBound = "1";

      this.els.send?.addEventListener("click", () => this.submit());
      this.els.question?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.submit();
        }
      });

      this.els.agentSelect?.addEventListener("change", () => {
        state.saveAgent(this.els.agentSelect.value);
        this.updateAgentLabel(this.els.agentSelect.value);
      });

      this.els.reportSearch?.addEventListener("input", () => {
        if (this.currentReport?.markdown) {
          reportCards.buildReportCards(this.currentReport.markdown, this.els.reportCards, {
            searchQuery: this.els.reportSearch.value,
          });
        }
      });

      this.els.reportScroll?.addEventListener("scroll", () => {
        clearTimeout(this._scrollTimer);
        this._scrollTimer = setTimeout(() => {
          state.saveScroll(this.els.reportScroll.scrollTop);
        }, 400);
      });

      this.root.querySelector("#aiep-export-pdf")?.addEventListener("click", () => this.handleExport("pdf"));
      this.root.querySelector("#aiep-export-docx")?.addEventListener("click", () => this.handleExport("docx"));
      this.root.querySelector("#aiep-copy-md")?.addEventListener("click", () => this.handleExport("copy"));
      this.root.querySelector("#aiep-share")?.addEventListener("click", () => this.handleExport("share"));

      this.els.themeToggle?.addEventListener("click", () => this.toggleTheme());
      this.root.querySelector("#aiep-refresh-panel")?.addEventListener("click", () => this.refreshPanel());
      this.root.querySelector("#aiep-history-toggle")?.addEventListener("click", () => this.toggleHistory());

      this.els.historySearch?.addEventListener("input", () => this.refreshHistory(this.els.historySearch.value));
      if (this.els.uploadZone && this.els.fileInput) {
        this.setupUpload();
      }
    }

    setupUpload() {
      const zone = this.els.uploadZone;
      const input = this.els.fileInput;

      zone.addEventListener("click", () => input.click());
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("aiep-drag-over");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("aiep-drag-over"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("aiep-drag-over");
        this.addFiles(e.dataTransfer.files);
      });
      input.addEventListener("change", () => {
        this.addFiles(input.files);
        input.value = "";
      });
    }

    async addFiles(fileList) {
      try {
        const newAtts = await upload.processFiles(fileList);
        this.attachments.push(...newAtts);
        this.renderAttachments();
      } catch (err) {
        this.showError({ title: "Yuklash xatosi", detail: err.message, retryable: false });
      }
    }

    renderAttachments() {
      this.els.attachments.innerHTML = "";
      this.attachments.forEach((att) => {
        const chip = upload.renderAttachmentChip(
          att,
          (id) => {
            this.attachments = this.attachments.filter((a) => a.id !== id);
            this.renderAttachments();
          },
          (a) => this.previewAttachment(a)
        );
        this.els.attachments.appendChild(chip);
      });
    }

    previewAttachment(att) {
      const preview = window.open("", "_blank", "width=600,height=500");
      if (preview) {
        preview.document.write(`<pre style="font-family:system-ui;padding:16px;white-space:pre-wrap">${att.content.slice(0, 10000)}</pre>`);
        preview.document.title = att.name;
      }
    }

    setTheme(theme) {
      this.root.dataset.theme = theme;
      const isDark = theme === "dark";
      this.els.themeToggle.innerHTML = icons.icon(isDark ? "sun" : "moon", 18);
      state.saveTheme(theme);
    }

    toggleTheme() {
      const next = this.root.dataset.theme === "dark" ? "light" : "dark";
      this.setTheme(next);
    }

    openPanel() {
      if (global.AIEP?.panel?.open) {
        global.AIEP.panel.open();
        return;
      }
      this.els?.backdrop?.classList.add("aiep-open");
      this.els?.panel?.classList.add("aiep-open");
    }

    closePanel() {
      if (global.AIEP?.panel?.close) {
        global.AIEP.panel.close();
        return;
      }
      this.els?.backdrop?.classList.remove("aiep-open");
      this.els?.panel?.classList.remove("aiep-open");
    }

    async refreshPanel() {
      this.hideError();

      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = null;
      }

      statusBar.renderStatusBar(this.els.status);
      this.statusInterval = statusBar.startPolling(this.els.status);

      if (AIEP.messaging?.wakeServiceWorker) {
        await AIEP.messaging.wakeServiceWorker();
      }

      if (AIEP.migrate?.runMigrations) {
        await AIEP.migrate.runMigrations();
      }

      if (AIEP.secretStorage?.migrateConnectorSecret) {
        await AIEP.secretStorage.migrateConnectorSecret();
      }

      const agent = await state.loadAgent();
      if (agent) {
        this.els.agentSelect.value = agent;
        this.updateAgentLabel(agent);
        this.lastAgent = agent;
      }

      const last = await state.loadLastReport();
      if (last?.markdown) {
        this.displayReport(last);
      } else if (this.currentReport?.markdown) {
        this.displayReport(this.currentReport);
      }

      this.setVersionLabel();
    }

    updateAgentLabel(agentId) {
      const agent = config.getAgent(agentId);
      this.els.agentLabel.textContent = agent?.label || agentId;
    }

    showError(errObj) {
      const el = this.els.error;
      el.hidden = false;
      const retryLabel = errObj.resumeJobId ? "Davom etish" : "Qayta urinish";
      el.innerHTML = `
        <div class="aiep-error-content">
          <strong>${errObj.title}</strong>
          <p>${errObj.detail}</p>
          ${errObj.retryable ? `<button type="button" class="aiep-retry-btn">${icons.icon("refresh", 14)} ${retryLabel}</button>` : ""}
        </div>
      `;
      el.querySelector(".aiep-retry-btn")?.addEventListener("click", () => {
        el.hidden = true;
        if (errObj.resumeJobId) {
          this.submit({ resumeJobId: errObj.resumeJobId });
        } else {
          this.submit();
        }
      });
    }

    hideError() {
      this.els.error.hidden = true;
    }

    async submit(options = {}) {
      const resumeJobId = options.resumeJobId || null;
      if (this.isSubmitting) {
        this.showError({
          title: "Kutish",
          detail: global.AIEP.constants?.MESSAGES?.DUPLICATE_SUBMIT || "Tahlil allaqachon bajarilmoqda.",
          retryable: false,
        });
        return;
      }

      const question = resumeJobId ? this.lastQuestion : this.els.question.value.trim();
      if (!question) {
        this.showError({ title: "Savol kerak", detail: "Savol yozing.", retryable: false });
        return;
      }

      const totalAttachmentChars = this.attachments.reduce((n, a) => n + (a.content?.length || 0), 0);
      if (totalAttachmentChars > 120_000) {
        this.showError({
          title: "Fayl juda katta",
          detail: "Biriktirilgan fayllar hajmi chegaradan oshdi. Kamroq yoki kichikroq fayl tanlang.",
          retryable: false,
        });
        return;
      }

      this.hideError();
      this.lastQuestion = question;
      this.lastAgent = this.els.agentSelect.value;
      state.saveAgent(this.lastAgent);

      this.isSubmitting = true;
      this.abortController = new AbortController();
      statusBar.pausePolling();

      this.loadingHandle = loading.showPortDriven(this.els.reportScroll, {
        quick: !global.AIEP?.responseMode?.isFullReport(question),
      });
      this.els.send.disabled = true;

      const attachments = this.attachments.map(({ name, mime_type, content }) => ({
        name,
        mime_type,
        content,
      }));

      let envelope;
      try {
        envelope = await AIEP.messaging.runAgentViaPort({
          agent: this.lastAgent,
          question,
          attachments,
          resumeJobId,
          mode: global.AIEP?.responseMode?.modeForQuestion(question),
          signal: this.abortController.signal,
          onProgress: (stageId, stageLabel) => {
            if (this.loadingHandle?.setStage) {
              this.loadingHandle.setStage(stageId, stageLabel);
            } else if (this.loadingHandle?.overlay) {
              loading.setStage(this.loadingHandle.overlay, stageId, stageLabel);
            }
          },
        });
      } catch (error) {
        envelope = { ok: false, error: error?.message || String(error) };
      } finally {
        this.isSubmitting = false;
        this.abortController = null;
        this.els.send.disabled = false;
        statusBar.resumePolling();
        statusBar.pollStatus(this.els.status);
        if (this.loadingHandle?.overlay) loading.hide(this.loadingHandle.overlay);
        this.loadingHandle = null;
      }

      const formatted = errors.formatEnvelope(envelope);
      if (formatted) {
        this.pendingJobId = envelope.resumeJobId || envelope.details?.resumeJobId || envelope.details?.debug?.jobId || null;
        if (this.pendingJobId) formatted.resumeJobId = this.pendingJobId;
        this.showError(formatted);
        return;
      }

      this.pendingJobId = null;
      const response = envelope.data;
      const payload = response?.data?.data || response?.data || response;
      const markdown = payload?.answer || payload?.data?.answer || "Ma'lumot yetarli emas.";
      const reportMode = payload?.mode || (global.AIEP?.responseMode?.isFullReport(question) ? "full_report" : "quick_answer");
      const agent = config.getAgent(this.lastAgent);
      const report = {
        id: history.createReportId(),
        agent: this.lastAgent,
        agentLabel: agent?.label || this.lastAgent,
        question,
        markdown,
        mode: reportMode,
        timestamp: Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      };

      await history.saveReport(report);
      await state.saveLastReport(report);
      this.displayReport(report);
      this.attachments = [];
      this.renderAttachments();
    }

    displayReport(report) {
      this.currentReport = report;
      this.els.reportDate.textContent = report.date || new Date(report.timestamp).toLocaleDateString();
      this.els.reportTime.textContent = report.time || new Date(report.timestamp).toLocaleTimeString();
      this.updateAgentLabel(report.agent);

      const isQuick = report.mode === "quick_answer";
      if (isQuick) {
        reportCards.buildQuickAnswer(report.markdown, this.els.reportCards);
      } else {
        reportCards.buildReportCards(report.markdown, this.els.reportCards);
      }
      this.toggleExportUi(isQuick);
      this.hideError();
    }

    toggleExportUi(isQuick) {
      const pdf = this.root.querySelector("#aiep-export-pdf");
      const docx = this.root.querySelector("#aiep-export-docx");
      const share = this.root.querySelector("#aiep-share");
      const copy = this.root.querySelector("#aiep-copy-md");
      const searchWrap = this.root.querySelector(".aiep-report-search-wrap");
      [pdf, docx, share].forEach((el) => {
        if (el) el.hidden = isQuick;
      });
      if (copy) copy.hidden = false;
      if (searchWrap) searchWrap.hidden = isQuick;
    }

    handleExport(type) {
      if (!this.currentReport?.markdown) return;
      const meta = {
        title: "Rahbarlik hisoboti",
        agent: this.currentReport.agent,
        agentLabel: this.currentReport.agentLabel,
        date: this.currentReport.date,
        time: this.currentReport.time,
      };
      if (type === "pdf") exportUtil.exportPdf(meta, this.currentReport.markdown);
      else if (type === "docx") exportUtil.exportDocx(meta, this.currentReport.markdown);
      else if (type === "copy") exportUtil.copyMarkdown(this.currentReport.markdown);
      else if (type === "share") exportUtil.shareReport(meta, this.currentReport.markdown);
    }

    async toggleHistory() {
      const panel = this.els.historyPanel;
      panel.hidden = !panel.hidden;
      if (!panel.hidden) await this.refreshHistory();
    }

    async refreshHistory(query = "") {
      const items = query ? await history.searchReports(query) : await history.listReports();
      this.els.historyList.innerHTML = "";
      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "aiep-history-item";
        li.innerHTML = `
          <button type="button" class="aiep-history-load">
            <span class="aiep-history-agent">${item.agentLabel}</span>
            <span class="aiep-history-q">${item.question?.slice(0, 60)}</span>
            <span class="aiep-history-date">${new Date(item.timestamp).toLocaleString()}</span>
          </button>
          <button type="button" class="aiep-history-delete" title="O'chirish">${icons.icon("trash", 14)}</button>
        `;
        li.querySelector(".aiep-history-load").addEventListener("click", () => {
          this.displayReport(item);
          this.els.historyPanel.hidden = true;
        });
        li.querySelector(".aiep-history-delete").addEventListener("click", async () => {
          await history.deleteReport(item.id);
          await this.refreshHistory(query);
        });
        this.els.historyList.appendChild(li);
      });
    }
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.ExecutiveDashboard = ExecutiveDashboard;
})(typeof window !== "undefined" ? window : self);
