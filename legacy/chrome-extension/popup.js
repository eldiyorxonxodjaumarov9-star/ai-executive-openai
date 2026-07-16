/**
 * Kengaytma sozlamalari — ulanish kaliti, server tekshiruvi, yangilash.
 */

const secretInput = document.getElementById("secret");
const saveBtn = document.getElementById("save");
const clearBtn = document.getElementById("clear");
const testBtn = document.getElementById("test-backend");
const updateBtn = document.getElementById("update-extension");
const openExtensionsBtn = document.getElementById("open-extensions");
const updateInstructions = document.getElementById("update-instructions");
const statusEl = document.getElementById("status");
const testResultEl = document.getElementById("test-result");
const workerStatusEl = document.getElementById("worker-status");
const versionEl = document.getElementById("popup-version");

const { secretStorage } = AIEP;

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#2e7d32";
}

function showTestResult(text, ok) {
  testResultEl.textContent = text;
  testResultEl.className = ok ? "ok" : "err";
}

function setWorkerStatus(text, ok) {
  if (!workerStatusEl) return;
  workerStatusEl.textContent = text;
  workerStatusEl.style.color = ok ? "#2e7d32" : "#b42318";
}

function showVersion() {
  try {
    versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  } catch {
    versionEl.textContent = "v2.1.0";
  }
}

async function loadSecretIntoForm() {
  if (AIEP.migrate?.runMigrations) {
    await AIEP.migrate.runMigrations();
  }
  const secret = await secretStorage.getConnectorSecret();
  if (secret) {
    secretInput.value = secret;
    showStatus("Kalit saqlandi (yangilanishdan keyin ham saqlanadi).");
  }
}

async function checkWorkerOnOpen() {
  if (!AIEP.messaging.isContextValid()) {
    setWorkerStatus("Kengaytma konteksti noto'g'ri — qayta yuklang", false);
    return;
  }
  setWorkerStatus("Xizmat tekshirilmoqda…", true);
  const wake = await AIEP.messaging.wakeServiceWorker();
  setWorkerStatus(wake.awake ? "Xizmat: tayyor" : "Xizmat: mavjud emas", wake.awake);
}

saveBtn.addEventListener("click", async () => {
  const value = secretInput.value.trim();
  await secretStorage.saveConnectorSecret(value);
  showStatus(value ? "Kalit doimiy saqlandi." : "Kalit tozalandi.");
});

clearBtn.addEventListener("click", async () => {
  secretInput.value = "";
  await secretStorage.clearConnectorSecret();
  showStatus("Kalit tozalandi.");
});

updateBtn.addEventListener("click", () => {
  updateInstructions.classList.add("visible");
  openExtensionsBtn.hidden = false;
  showStatus("chrome://extensions sahifasida Qayta yuklash tugmasini bosing.", false);
});

openExtensionsBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions" });
});

testBtn.addEventListener("click", async () => {
  showStatus("Xizmat uyg'onmoqda…");
  showTestResult("", false);
  testBtn.disabled = true;

  const envelope = await AIEP.messaging.sendToBackground({ type: "TEST_HEALTH" });
  testBtn.disabled = false;

  const formatted = AIEP.errors?.formatEnvelope(envelope);
  if (formatted) {
    showStatus(formatted.title, true);
    setWorkerStatus("Xizmat: mavjud emas", false);
    showTestResult(formatted.detail, false);
    return;
  }

  setWorkerStatus("Xizmat: tayyor", true);
  const response = envelope.data;

  if (response?.success) {
    showStatus("Server ulandi.");
    showTestResult("Server muvaffaqiyatli javob berdi.", true);
    return;
  }

  showStatus("Tekshiruv muvaffaqiyatsiz.", true);
  showTestResult(AIEP.errors?.sanitizeTechnical?.(response?.error?.message) || "Server javob bermadi.", false);
});

showVersion();
loadSecretIntoForm();
checkWorkerOnOpen();
