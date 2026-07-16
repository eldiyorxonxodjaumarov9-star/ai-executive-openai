/**
 * Rahbarlik AI — MV3 background service worker
 * Port-linked keepalive, request registry, abort on disconnect.
 */
console.log("[AIEP background] service worker started");

importScripts("js/constants.js", "js/migrate.js", "js/secret-storage.js", "js/response-mode.js");

const C = self.AIEP.constants;
const { API_BASE, PORT_NAME, TIMEOUT, MESSAGES, stageLabel, JOB_STAGE_MAP } = C;
const LOG = "[AIEP background]";
const PORT_LOG = "[AIEP port]";

/** @type {Map<string, { abort: AbortController, port: chrome.runtime.Port|null }>} */
const activeRequests = new Map();
let keepAliveRefCount = 0;
let keepAliveTimer = null;

function log(...args) {
  console.log(LOG, ...args);
}

function portLog(...args) {
  console.log(PORT_LOG, ...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function newRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function acquireKeepAlive() {
  keepAliveRefCount += 1;
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError);
  }, TIMEOUT.KEEPALIVE_INTERVAL_MS);
  try {
    chrome.alarms?.create("aiep-keepalive", { periodInMinutes: 1 });
  } catch {
    /* alarms permission optional */
  }
}

function releaseKeepAlive() {
  keepAliveRefCount = Math.max(0, keepAliveRefCount - 1);
  if (keepAliveRefCount > 0) return;
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  try {
    chrome.alarms?.clear("aiep-keepalive");
  } catch {
    /* ignore */
  }
}

async function loadSecret() {
  const secret = await self.AIEP.secretStorage.getConnectorSecret();
  log("connectorSecret:", secret ? `yes (${secret.length} chars)` : "no");
  return secret;
}

function buildHeaders(secret, contentType = "application/json") {
  const headers = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (secret) headers["X-Connector-Secret"] = secret;
  return headers;
}

async function fetchWithTimeout(url, options = {}, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      const e = new Error("So'rov bekor qilindi");
      e.code = "ABORTED";
      throw e;
    }
    externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err.name === "AbortError") {
      const e = new Error(MESSAGES.TIMEOUT);
      e.code = externalSignal?.aborted ? "ABORTED" : "TIMEOUT";
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function requestBackend(url, options = {}, timeoutMs = TIMEOUT.HEALTH_MS, signal) {
  const response = await fetchWithTimeout(url, options, timeoutMs, signal);
  const body = await response.text();
  log("RESPONSE", response.status, url);
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
    url,
  };
}

async function checkHealth(timeoutMs = TIMEOUT.HEALTH_MS, signal) {
  const url = `${API_BASE}/health`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await requestBackend(url, { method: "GET" }, timeoutMs, signal);
      if (result.ok) return result;
      if (attempt < 3) await sleep(TIMEOUT.COLD_START_MS * attempt);
    } catch (err) {
      if (err.code === "ABORTED") throw err;
      lastError = err;
      if (attempt < 3) await sleep(TIMEOUT.COLD_START_MS * attempt);
    }
  }
  if (lastError) throw lastError;
  throw new Error("Server holati tekshirilmadi");
}

function errorPayload(type, message, extra = {}) {
  return {
    success: false,
    error: { type, message, ...extra },
    debug: { via: "background.js", ...extra.debug },
    resumeJobId: extra.resumeJobId || extra.debug?.jobId || null,
  };
}

function parseApiDetail(body) {
  if (!body) return { code: null, message: null };
  try {
    const parsed = JSON.parse(body);
    const detail = parsed?.detail;
    if (detail && typeof detail === "object") {
      return { code: detail.code || null, message: detail.message || null };
    }
    if (typeof detail === "string") {
      return { code: null, message: detail };
    }
    return {
      code: parsed?.error_code || parsed?.code || null,
      message: parsed?.error || parsed?.message || null,
    };
  } catch {
    return { code: null, message: null };
  }
}

function httpErrorPayload(result, secretSet) {
  const { status, body, url } = result;
  const { code, message } = parseApiDetail(body);

  if (status === 404) {
    const isChat = String(url || "").includes("/chat/agent");
    return errorPayload(
      "endpoint_not_found",
      isChat
        ? "Chat endpoint topilmadi — server yangilanganini tekshiring (POST /chat/agent)."
        : "Endpoint topilmadi.",
      { debug: { secretSet, status, url, code } }
    );
  }

  if (status === 422) {
    return errorPayload(
      "validation_error",
      message || "So'rov formati noto'g'ri — savol bo'sh yoki juda uzun.",
      { debug: { secretSet, status, url } }
    );
  }

  if (status === 401) {
    return errorPayload(
      "auth",
      secretSet
        ? "Ulanish kaliti noto'g'ri — sozlamalarni tekshiring."
        : MESSAGES.SECRET_MISSING,
      { debug: { secretSet, status, url } }
    );
  }

  if (code === "agent_invalid") {
    return errorPayload(
      "agent_invalid",
      message || "Agent nomi noto'g'ri.",
      { debug: { secretSet, status, url, code } }
    );
  }

  if (code === "crm_error") {
    return errorPayload(
      "crm_error",
      message || "CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring.",
      { debug: { secretSet, status, url, code } }
    );
  }

  if (code === "ai_timeout" || code === "claude_timeout") {
    return errorPayload(
      "ai_timeout",
      message || "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.",
      { debug: { secretSet, status, url, code } }
    );
  }

  if (code === "ai_error" || code === "claude_error") {
    return errorPayload(
      "ai_error",
      message || "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.",
      { debug: { secretSet, status, url, code } }
    );
  }

  if (status === 504) {
    return errorPayload(
      "ai_timeout",
      message || "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.",
      { debug: { secretSet, status, url } }
    );
  }

  if (status >= 500) {
    return errorPayload(
      "internal_error",
      message || "Server ichki xatosi — keyinroq qayta urinib ko'ring.",
      { debug: { secretSet, status, url, code } }
    );
  }

  return {
    success: false,
    error: {
      type: "http",
      url,
      status,
      statusText: result.statusText,
      body,
      code,
      message,
    },
    debug: { secretSet, via: "background.js" },
  };
}

function sendProgress(port, stageId) {
  if (!port) return;
  try {
    port.postMessage({ type: "progress", stageId, stage: stageLabel(stageId) });
  } catch {
    /* port may be closed */
  }
}

function mapJobStage(jobStage) {
  return JOB_STAGE_MAP[jobStage] || "report";
}

function timeoutPayload(phase, { secretSet, jobId, startedAt }) {
  const elapsedSec = Math.round((Date.now() - (startedAt || Date.now())) / 1000);
  let message = MESSAGES.TIMEOUT;
  if (phase === "start") message = MESSAGES.TIMEOUT_START;
  else if (phase === "poll" && jobId) message = MESSAGES.TIMEOUT_POLL;
  else if (jobId) message = MESSAGES.TIMEOUT_WITH_JOB;

  return errorPayload("timeout", message, {
    debug: { secretSet, jobId, phase, elapsedSec },
    resumeJobId: jobId || null,
  });
}

async function pollJobUntilDone(jobId, secret, secretSet, { signal, port, progress, startedAt }) {
  const deadline = Date.now() + TIMEOUT.POLL_MAX_MS;
  let pollCount = 0;
  let consecutivePollErrors = 0;

  portLog("polling job", jobId);

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      return errorPayload("aborted", "So'rov bekor qilindi.", { debug: { secretSet, jobId } });
    }

    await sleep(TIMEOUT.POLL_INTERVAL_MS);
    pollCount += 1;

    if (pollCount % 4 === 0) progress("hint");

    const pollUrl = `${API_BASE}/tools/agent/jobs/${encodeURIComponent(jobId)}`;
    let pollResult;

    try {
      pollResult = await requestBackend(
        pollUrl,
        { method: "GET", headers: buildHeaders(secret, null) },
        TIMEOUT.POLL_MS,
        signal
      );
      consecutivePollErrors = 0;
    } catch (err) {
      if (err.code === "ABORTED") {
        return errorPayload("aborted", "So'rov bekor qilindi.", { debug: { secretSet, jobId } });
      }
      if (err.code === "TIMEOUT") {
        consecutivePollErrors += 1;
        portLog("poll fetch timeout", jobId, "streak", consecutivePollErrors);
        if (consecutivePollErrors >= TIMEOUT.POLL_ERROR_MAX) {
          return timeoutPayload("poll", { secretSet, jobId, startedAt });
        }
        continue;
      }
      throw err;
    }

    if (!pollResult.ok) {
      if (pollResult.status === 404) {
        return errorPayload(
          "agent",
          "Vazifa topilmadi — server qayta ishga tushgan bo'lishi mumkin. Yangi tahlil boshlang.",
          { debug: { secretSet, jobId, status: 404 } }
        );
      }
      if (pollResult.status >= 500) {
        consecutivePollErrors += 1;
        if (consecutivePollErrors >= TIMEOUT.POLL_ERROR_MAX) {
          return timeoutPayload("poll", { secretSet, jobId, startedAt });
        }
        continue;
      }
      return httpErrorPayload(pollResult, secretSet);
    }

    let pollData;
    try {
      pollData = JSON.parse(pollResult.body);
    } catch {
      consecutivePollErrors += 1;
      continue;
    }

    if (!pollData?.success) continue;

    const job = pollData.data || {};
    progress(mapJobStage(job.stage || "llm"));

    if (job.status === "completed" && job.result) {
      progress("recommend");
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      portLog("job completed", jobId, "elapsedSec", elapsedSec);
      return {
        success: true,
        data: job.result,
        debug: { secretSet, via: "background.js", jobId, elapsedSec },
      };
    }

    if (job.status === "failed") {
      return {
        success: false,
        error: {
          type: "agent",
          message: job.error || MESSAGES.AGENT_FAILED,
        },
        data: pollData,
        debug: { secretSet, via: "background.js", jobId },
      };
    }
  }

  return timeoutPayload("deadline", { secretSet, jobId, startedAt });
}

async function runQuickChatRequest(agent, question, { onProgress, requestId, signal, port }) {
  const startedAt = Date.now();
  const progress = (stageId) => {
    if (onProgress) onProgress(stageId);
    sendProgress(port, stageId);
  };

  progress("validate");

  const secret = await loadSecret();
  const secretSet = Boolean(secret);
  if (!secretSet) {
    return errorPayload("auth", MESSAGES.SECRET_MISSING, { debug: { secretSet: false } });
  }

  const headers = buildHeaders(secret);
  portLog("RUN_QUICK", requestId, "agent:", agent);

  try {
    progress("crm");
    const url = `${API_BASE}/chat/agent/${encodeURIComponent(agent)}`;
    let result;
    try {
      result = await requestBackend(
        url,
        { method: "POST", headers, body: JSON.stringify({ question: question.trim() }) },
        TIMEOUT.QUICK_MS,
        signal
      );
    } catch (err) {
      if (err.code === "TIMEOUT") {
        return errorPayload(
          "timeout",
          "Javob 60 soniyadan oshdi — savolni qisqartiring yoki «to'liq hisobot» deb so'rang.",
          { debug: { secretSet, phase: "quick", elapsedSec: Math.round((Date.now() - startedAt) / 1000) } }
        );
      }
      throw err;
    }

    if (!result.ok) return httpErrorPayload(result, secretSet);

    progress("answer");

    let data;
    try {
      data = JSON.parse(result.body);
    } catch {
      return httpErrorPayload(result, secretSet);
    }

    if (!data?.success) {
      const errCode = data?.error_code || data?.code;
      const errMsg = data?.error || data?.message || MESSAGES.AGENT_FAILED;
      portLog("quick chat API error", errCode, errMsg);
      const errType =
        errCode === "crm_error"
          ? "crm_error"
          : errCode === "ai_timeout" || errCode === "claude_timeout"
            ? "ai_timeout"
            : errCode === "ai_error" || errCode === "claude_error"
              ? "ai_error"
              : errCode === "agent_invalid"
                ? "agent_invalid"
                : "agent";
      return errorPayload(errType, errMsg, {
        debug: { secretSet, via: "background.js", mode: "quick_answer", code: errCode },
      });
    }

    progress("done");
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    portLog("quick answer done", requestId, "elapsedSec", elapsedSec);

    return {
      success: true,
      data: {
        success: true,
        tool: "quick_chat",
        data: {
          agent: data.agent,
          agent_display_name: data.agent_display_name,
          mode: "quick_answer",
          question: data.question,
          answer: data.answer,
          crm_summary: data.crm_summary,
        },
      },
      debug: { secretSet, via: "background.js", mode: "quick_answer", elapsedSec },
    };
  } catch (err) {
    if (err.code === "ABORTED") {
      return errorPayload("aborted", "So'rov bekor qilindi.", { debug: { secretSet } });
    }
    return {
      success: false,
      error: {
        type: "network",
        message: err.message || MESSAGES.NETWORK,
      },
      debug: { secretSet, via: "background.js", mode: "quick_answer" },
    };
  }
}

async function runAgentRequest(agent, question, attachments, { onProgress, requestId, signal, port, resumeJobId }) {
  const startedAt = Date.now();
  const progress = (stageId) => {
    if (onProgress) onProgress(stageId);
    sendProgress(port, stageId);
  };

  progress("connect");

  const secret = await loadSecret();
  const secretSet = Boolean(secret);

  if (!secretSet) {
    return errorPayload("auth", MESSAGES.SECRET_MISSING, {
      debug: { secretSet: false },
    });
  }

  const headers = buildHeaders(secret);
  portLog("RUN_AGENT async", requestId, "agent:", agent, "resume:", resumeJobId || "no");

  try {
    let jobId = resumeJobId || null;

    if (!jobId) {
      progress("wake");
      try {
        await checkHealth(TIMEOUT.HEALTH_MS, signal);
      } catch (err) {
        if (err.code === "TIMEOUT") {
          return timeoutPayload("start", { secretSet, jobId: null, startedAt });
        }
        throw err;
      }
      await sleep(TIMEOUT.COLD_START_MS);

      const startUrl = `${API_BASE}/tools/agent/${encodeURIComponent(agent)}?async=1`;
      const payload = { question, attachments: attachments || [], request_id: requestId };

      progress("crm");

      let startResult;
      try {
        startResult = await requestBackend(
          startUrl,
          { method: "POST", headers, body: JSON.stringify(payload) },
          TIMEOUT.JOB_START_MS,
          signal
        );
      } catch (err) {
        if (err.code === "TIMEOUT") {
          portLog("job start timeout", requestId);
          return timeoutPayload("start", { secretSet, jobId: null, startedAt });
        }
        throw err;
      }

      if (!startResult.ok) return httpErrorPayload(startResult, secretSet);

      let startData;
      try {
        startData = JSON.parse(startResult.body);
      } catch {
        return httpErrorPayload(startResult, secretSet);
      }

      if (!startData?.success) {
        return {
          success: false,
          error: {
            type: "agent",
            message: startData?.error || MESSAGES.AGENT_FAILED,
          },
          data: startData,
          debug: { secretSet, via: "background.js" },
        };
      }

      jobId = startData?.data?.job_id;
      if (!jobId) {
        return errorPayload("agent", "Server vazifa identifikatorini qaytarmadi — backend yangilanganmi?", {
          debug: { secretSet },
        });
      }

      portLog("job started", jobId, "startMs", Date.now() - startedAt);
    } else {
      portLog("resume polling", jobId);
      progress("report");
    }

    progress("report");
    progress("hint");

    return await pollJobUntilDone(jobId, secret, secretSet, {
      signal,
      port,
      progress,
      startedAt,
    });
  } catch (err) {
    if (err.code === "ABORTED") {
      return errorPayload("aborted", "So'rov bekor qilindi.", { debug: { secretSet } });
    }
    if (err.code === "TIMEOUT") {
      return timeoutPayload("poll", { secretSet, jobId: resumeJobId, startedAt });
    }
    return {
      success: false,
      error: {
        type: "network",
        url: `${API_BASE}/tools/agent/${agent}`,
        message: err.message || MESSAGES.NETWORK,
      },
      debug: { secretSet, via: "background.js" },
    };
  }
}

async function testHealth() {
  acquireKeepAlive();
  try {
    const result = await checkHealth(TIMEOUT.HEALTH_MS);
    return {
      success: true,
      status: result.status,
      body: result.body,
      url: result.url,
      debug: { via: "background.js" },
    };
  } catch (err) {
    const isTimeout = err.code === "TIMEOUT";
    return {
      success: false,
      error: {
        type: isTimeout ? "timeout" : "network",
        url: `${API_BASE}/health`,
        message: isTimeout ? MESSAGES.TIMEOUT : err.message || MESSAGES.NETWORK,
      },
      debug: { via: "background.js" },
    };
  } finally {
    releaseKeepAlive();
  }
}

async function checkStatus() {
  let backend = "offline";
  let crm = "unknown";

  if (activeRequests.size > 0) {
    return { backend: "online", crm: "unknown", busy: true };
  }

  acquireKeepAlive();
  try {
    try {
      const health = await requestBackend(`${API_BASE}/health`, { method: "GET" }, TIMEOUT.HEALTH_MS);
      if (health.ok) backend = "online";
      else if (health.status === 503 || health.status === 502) backend = "sleeping";
    } catch (err) {
      if (err.code === "TIMEOUT") backend = "sleeping";
      else backend = "sleeping";
    }

    if (backend === "online") {
      try {
        const secret = await loadSecret();
        const summary = await requestBackend(
          `${API_BASE}/tools/bitrix/summary`,
          { method: "GET", headers: buildHeaders(secret) },
          TIMEOUT.HEALTH_MS
        );
        crm = summary.ok ? "connected" : "error";
      } catch {
        crm = "error";
      }
    }

    return { backend, crm, busy: false };
  } finally {
    releaseKeepAlive();
  }
}

function cancelRequest(requestId) {
  const entry = activeRequests.get(requestId);
  if (entry) {
    entry.abort.abort();
    activeRequests.delete(requestId);
  }
}

async function handleMessage(message) {
  switch (message?.type) {
    case "PING":
      return { pong: true, ts: Date.now() };
    case "TEST_HEALTH":
      return testHealth();
    case "CHECK_STATUS":
      return checkStatus();
    case "CANCEL_REQUEST":
      cancelRequest(message.requestId);
      return { cancelled: true };
    default:
      throw new Error(`Unknown message type: ${message?.type}`);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let responded = false;
  const respondOnce = (payload) => {
    if (responded) return;
    responded = true;
    sendResponse(payload);
  };

  (async () => {
    try {
      const result = await handleMessage(message, sender);
      respondOnce({ ok: true, data: result });
    } catch (error) {
      respondOnce({
        ok: false,
        error: error?.message || String(error),
      });
    }
  })();

  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;

  portLog("port connected");
  acquireKeepAlive();

  port.onMessage.addListener((message) => {
    if (message?.type === "CANCEL_REQUEST") {
      cancelRequest(message.requestId);
      return;
    }
    if (message?.type !== "RUN_AGENT") return;

    const requestId = message.requestId || newRequestId();
    const abort = new AbortController();
    activeRequests.set(requestId, { abort, port });

    const mode =
      message.mode ||
      (self.AIEP?.responseMode?.modeForQuestion(message.question) ?? "quick_answer");
    const isFull = mode === "full_report";

    portLog("route", isFull ? "POST /tools/agent (full)" : "POST /chat/agent (quick)", message.agent);

    (async () => {
      try {
        const result = isFull
          ? await runAgentRequest(
              message.agent,
              message.question,
              message.attachments,
              {
                requestId,
                signal: abort.signal,
                port,
                resumeJobId: message.resumeJobId || null,
                onProgress: (stageId) => sendProgress(port, stageId),
              }
            )
          : await runQuickChatRequest(message.agent, message.question, {
              requestId,
              signal: abort.signal,
              port,
              onProgress: (stageId) => sendProgress(port, stageId),
            });

        if (result.success) {
          port.postMessage({ type: "success", requestId, data: result });
        } else {
          port.postMessage({
            type: "error",
            requestId,
            error: result.error?.message || MESSAGES.AGENT_FAILED,
            details: result,
            resumeJobId: result.resumeJobId || result.debug?.jobId || result.error?.resumeJobId || null,
          });
        }
      } catch (err) {
        port.postMessage({
          type: "error",
          requestId,
          error: err.message || MESSAGES.AGENT_FAILED,
          details: null,
        });
      } finally {
        activeRequests.delete(requestId);
        if (activeRequests.size === 0) releaseKeepAlive();
      }
    })();
  });

  port.onDisconnect.addListener(() => {
    portLog("port disconnected");
    for (const [id, entry] of activeRequests.entries()) {
      if (entry.port === port) {
        entry.abort.abort();
        activeRequests.delete(id);
      }
    }
    if (activeRequests.size === 0) releaseKeepAlive();
  });
});

async function onLifecycle(reason) {
  log("lifecycle:", reason);
  await self.AIEP.migrate.runMigrations();
}

chrome.runtime.onInstalled.addListener((details) => {
  onLifecycle(details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  onLifecycle("startup");
});

onLifecycle("boot");
log("listeners registered");
