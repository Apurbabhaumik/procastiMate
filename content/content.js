const blockedTA = document.getElementById("blocked");
const saveBtn = document.getElementById("save");
const applyBtn = document.getElementById("apply");
const resetBtn = document.getElementById("resetStats");
const statsTableBody = document.querySelector("#statsTable tbody");
const ctx = document.getElementById("weeklyChart").getContext("2d");

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
  blockedTA.value = (data.blockedSites || []).join("\n");
}

saveBtn.addEventListener("click", () => {
  const arr = blockedTA.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  chrome.storage.local.set({ blockedSites: arr }, () => {
    saveBtn.textContent = "Saved";
    setTimeout(() => (saveBtn.textContent = "Save"), 900);
  });
});

applyBtn.addEventListener("click", () => {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs)
      chrome.tabs.sendMessage(t.id, { type: "check_block" });
  });
});

resetBtn.addEventListener("click", async () => {
  if (!confirm("Reset all tracked site time? This cannot be undone.")) return;
  await new Promise((res) =>
    chrome.storage.local.set({ siteStats: {}, siteDaily: {} }, res)
  );
  loadStatsAndChart();
});

function renderStatsTable(siteStats) {
  statsTableBody.innerHTML = "";
  const entries = Object.entries(siteStats || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    statsTableBody.innerHTML =
      '<tr><td colspan="2">No stats recorded yet.</td></tr>';
    return;
  }
  for (const [host, seconds] of entries) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${host}</td><td>${humanizeSeconds(seconds)}</td>`;
    statsTableBody.appendChild(tr);
  }
}

// Chart: last 7 days totals (sum of siteDaily per day)
let chartInstance = null;
function drawChart(last7) {
  const labels = last7.map((d) => d.label);
  const data = last7.map((d) => Math.round(d.seconds / 60)); // convert to minutes for chart
  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
    return;
  }
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Focus minutes",
          data,
          backgroundColor: "rgba(11,102,194,0.85)",
        },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

async function loadStatsAndChart() {
  const data = await new Promise((res) =>
    chrome.storage.local.get({ siteStats: {}, siteDaily: {} }, res)
  );
  renderStatsTable(data.siteStats || {});

  // Build last 7 days array (including today)
  const daily = data.siteDaily || {};
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const byHost = daily[key] || {};
    const seconds = Object.values(byHost).reduce((a, b) => a + (b || 0), 0);
    arr.push({ key, label, seconds });
  }
  drawChart(arr);
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.siteDaily || changes.siteStats)) {
      loadStatsAndChart();
    }
  });
}

loadBlocked();
loadStatsAndChart();
setupStorageListener();
