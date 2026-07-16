/**
 * Unified messaging — wake SW, sendMessage (short), Port (long RUN_AGENT).
 */
(function (global) {
  "use strict";

  const C = global.AIEP?.constants;
  const LOG = "[AIEP messaging]";
  const PORT_LOG = "[AIEP port]";

  function constantsReady() {
    return Boolean(C?.TIMEOUT && C?.MESSAGES);
  }

  function isContextValid() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function newRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function classifyTransportError(message) {
    if (!message) return C.MESSAGES.AGENT_FAILED;
    if (C.PORT_CLOSED_RE.test(message)) return C.MESSAGES.PORT_DISCONNECTED;
    if (/timed out|timeout/i.test(message)) return C.MESSAGES.TIMEOUT;
    if (/receiving end does not exist/i.test(message)) return C.MESSAGES.WORKER_UNAVAILABLE;
    if (/failed to fetch|networkerror/i.test(message)) return C.MESSAGES.SERVER_WAKING;
    return message;
  }

  function wakeServiceWorker(maxAttempts) {
    const attempts = maxAttempts || C.TIMEOUT.WAKE_MAX_ATTEMPTS;
    return new Promise((resolve) => {
      if (!isContextValid()) {
        resolve({ awake: false, error: C.MESSAGES.CONTEXT_INVALID });
        return;
      }

      let attempt = 0;
      function tryPing() {
        attempt += 1;
        chrome.runtime.sendMessage({ type: "PING" }, (envelope) => {
          const err = chrome.runtime.lastError;
          if (!err && envelope?.ok === true) {
            resolve({ awake: true });
            return;
          }
          if (attempt < attempts) {
            setTimeout(tryPing, C.TIMEOUT.WAKE_BACKOFF_MS * attempt);
            return;
          }
          resolve({
            awake: false,
            error: classifyTransportError(err?.message || envelope?.error),
          });
        });
      }
      tryPing();
    });
  }

  function rawSendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (envelope) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: classifyTransportError(chrome.runtime.lastError.message),
            data: null,
          });
          return;
        }
        if (!envelope) {
          resolve({ ok: false, error: C.MESSAGES.WORKER_UNAVAILABLE, data: null });
          return;
        }
        resolve(envelope);
      });
    });
  }

  async function sendToBackground(message) {
    if (!constantsReady()) {
      return { ok: false, error: "Kengaytma modullari yuklanmadi — sahifani yangilang.", data: null };
    }

    if (!isContextValid()) {
      return { ok: false, error: C.MESSAGES.CONTEXT_INVALID, data: null };
    }

    if (message?.type === "RUN_AGENT") {
      return { ok: false, error: "Agent tahlili uchun runAgentViaPort() ishlating.", data: null };
    }

    const wake = await wakeServiceWorker();
    if (!wake.awake) {
      return { ok: false, error: wake.error || C.MESSAGES.WORKER_UNAVAILABLE, data: null };
    }

    const envelope = await rawSendMessage(message);
    if (envelope.ok === false) {
      return { ok: false, error: envelope.error || C.MESSAGES.WORKER_UNAVAILABLE, data: null };
    }

    return { ok: true, error: null, data: envelope.data ?? null };
  }

  /**
   * Long-lived port for agent analysis with cancel support.
   */
  async function runAgentViaPort({ agent, question, attachments = [], onProgress, signal, resumeJobId, mode }) {
    if (!constantsReady()) {
      return { ok: false, error: "Kengaytma modullari yuklanmadi — sahifani yangilang.", data: null, details: null, requestId: null };
    }

    if (!isContextValid()) {
      return { ok: false, error: C.MESSAGES.CONTEXT_INVALID, data: null, details: null, requestId: null };
    }

    const wake = await wakeServiceWorker();
    if (!wake.awake) {
      return { ok: false, error: wake.error || C.MESSAGES.WORKER_UNAVAILABLE, data: null, details: null, requestId: null };
    }

    const requestId = newRequestId();
    const requestMode = mode || (global.AIEP?.responseMode?.modeForQuestion(question) ?? "quick_answer");
    const isFull = requestMode === "full_report";
    const portTimeout = isFull ? C.TIMEOUT.PORT_CLIENT_FULL_MS : C.TIMEOUT.PORT_CLIENT_QUICK_MS;

    return new Promise((resolve) => {
      let settled = false;
      let port;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
        try {
          port?.disconnect();
        } catch {
          /* ignore */
        }
        resolve({ ...result, requestId });
      };

      const onAbort = () => {
        try {
          port?.postMessage({ type: "CANCEL_REQUEST", requestId });
        } catch {
          /* ignore */
        }
        finish({
          ok: false,
          error: "So'rov bekor qilindi.",
          data: null,
          details: { error: { type: "aborted" } },
        });
      };

      if (signal?.aborted) {
        finish({ ok: false, error: "So'rov bekor qilindi.", data: null, details: null });
        return;
      }
      signal?.addEventListener("abort", onAbort);

      const timer = setTimeout(() => {
        console.warn(PORT_LOG, "client timeout", requestId);
        try {
          port?.postMessage({ type: "CANCEL_REQUEST", requestId });
        } catch {
          /* ignore */
        }
        finish({ ok: false, error: C.MESSAGES.TIMEOUT, data: null, details: { error: { type: "timeout" } } });
      }, portTimeout);

      try {
        port = chrome.runtime.connect({ name: C.PORT_NAME });
        console.log(PORT_LOG, "connected", requestId);
      } catch (err) {
        finish({ ok: false, error: classifyTransportError(err.message), data: null, details: null });
        return;
      }

      port.onMessage.addListener((msg) => {
        if (msg.requestId && msg.requestId !== requestId) return;

        if (msg.type === "progress") {
          const stage = msg.stage || C.stageLabel(msg.stageId);
          if (onProgress) onProgress(msg.stageId || stage, stage);
          return;
        }
        if (msg.type === "success") {
          finish({ ok: true, error: null, data: msg.data, details: null });
          return;
        }
        if (msg.type === "error") {
          finish({
            ok: false,
            error: msg.error || C.MESSAGES.AGENT_FAILED,
            data: null,
            details: msg.details || null,
            resumeJobId: msg.resumeJobId || msg.details?.resumeJobId || msg.details?.debug?.jobId || null,
          });
        }
      });

      port.onDisconnect.addListener(() => {
        if (settled) return;
        const err = classifyTransportError(chrome.runtime.lastError?.message || "");
        console.warn(PORT_LOG, "early disconnect", requestId, err);
        finish({ ok: false, error: err, data: null, details: { error: { type: "disconnect" } } });
      });

      port.postMessage({
        type: "RUN_AGENT",
        requestId,
        agent,
        question,
        attachments,
        resumeJobId: resumeJobId || null,
        mode: requestMode,
      });
    });
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.messaging = {
    isContextValid,
    wakeServiceWorker,
    sendToBackground,
    runAgentViaPort,
    newRequestId,
    get MESSAGES() {
      return C?.MESSAGES || {};
    },
  };
})(typeof window !== "undefined" ? window : self);
