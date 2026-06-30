/**
 * Extension popup — connector secret settings only.
 */

const STORAGE_SECRET_KEY = "connectorSecret";

const secretInput = document.getElementById("secret");
const saveBtn = document.getElementById("save");
const clearBtn = document.getElementById("clear");
const statusEl = document.getElementById("status");

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#2e7d32";
}

chrome.storage.local.get([STORAGE_SECRET_KEY], (result) => {
  if (result[STORAGE_SECRET_KEY]) {
    secretInput.value = result[STORAGE_SECRET_KEY];
    showStatus("Secret saved.");
  }
});

saveBtn.addEventListener("click", () => {
  const value = secretInput.value.trim();
  chrome.storage.local.set({ [STORAGE_SECRET_KEY]: value }, () => {
    showStatus(value ? "Secret saved." : "Secret cleared.");
  });
});

clearBtn.addEventListener("click", () => {
  secretInput.value = "";
  chrome.storage.local.remove(STORAGE_SECRET_KEY, () => {
    showStatus("Secret cleared.");
  });
});
