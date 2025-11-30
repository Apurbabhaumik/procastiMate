const blockedTA = document.getElementById("blocked");
const saveBtn = document.getElementById("save");
const applyBtn = document.getElementById("apply");
const statsTableBody = document.querySelector("#statsTable tbody");
const resetBtn = document.getElementById("resetStats");

function humanizeSeconds(s) {
  if (!s || s <= 0) return "0s";
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs) return `${hrs}h ${mins}m`;
  if (mins) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

async function loadBlocked() {
  const data = await new Promise((res) =>
    chrome.storage.local.get({ blockedSites: [] }, res)
  );
  blockedTA.value = (data.blockedSites || []).join("\\n");
}

saveBtn.addEventListener("click", () => {
  const arr = blockedTA.value
    .split("\\n")
    .map((s) => s.trim())
    .filter(Boolean);
  chrome.storage.local.set({ blockedSites: arr }, () => alert("Saved"));
});

applyBtn.addEventListener("click", () => {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs)
      chrome.tabs.sendMessage(t.id, { type: "check_block" });
  });
});

resetBtn.addEventListener("click", async () => {
  if (!confirm("Reset all tracked site time? This cannot be undone.")) return;
  await new Promise((res) => chrome.storage.local.set({ siteStats: {} }, res));
  renderStats({});
});

async function renderStats(state) {
  statsTableBody.innerHTML = "";
  const entries = Object.entries(state || {}).sort((a, b) => b[1] - a[1]); // largest first
  if (entries.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="2">No stats recorded yet.</td>`;
    statsTableBody.appendChild(row);
    return;
  }
  for (const [host, seconds] of entries) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${host}</td><td>${humanizeSeconds(seconds)}</td>`;
    statsTableBody.appendChild(tr);
  }
}

async function loadStats() {
  const data = await new Promise((res) =>
    chrome.storage.local.get({ siteStats: {} }, res)
  );
  renderStats(data.siteStats || {});
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.siteStats) {
      loadStats();
    }
  });
}

loadBlocked();
loadStats();
setupStorageListener();
