const timerEl = document.getElementById("timer");
const modeEl = document.getElementById("mode");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");
const workMinsInput = document.getElementById("workMins");
const breakMinsInput = document.getElementById("breakMins");
const blockEnabled = document.getElementById("blockEnabled");
const todayTotalEl = document.getElementById("todayTotal");
const progressCircle = document.getElementById("progressCircle");

let timerInterval = null;
let remainingSeconds = 25 * 60;
let mode = "work";
let running = false;

const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52
progressCircle.style.strokeDasharray = `${CIRCUMFERENCE}`;
function setProgress(percent) {
  const offset = Math.round(CIRCUMFERENCE * (1 - percent));
  progressCircle.style.strokeDashoffset = offset;
}

function format(s) {
  return (
    String(Math.floor(s / 60)).padStart(2, "0") +
    ":" +
    String(s % 60).padStart(2, "0")
  );
}

function loadSettings() {
  chrome.storage.local.get(
    {
      workMins: 25,
      breakMins: 5,
      blockEnabled: true,
      timerState: null,
    },
    (data) => {
      workMinsInput.value = data.workMins;
      breakMinsInput.value = data.breakMins;
      blockEnabled.checked = data.blockEnabled;
      if (data.timerState) {
        ({ remainingSeconds, mode, running } = data.timerState);
        updateDisplay();
        if (running) startTimer();
      } else {
        remainingSeconds = data.workMins * 60;
        updateDisplay();
      }
    }
  );
  updateTodayTotal();
}

function saveSettings() {
  chrome.storage.local.set({
    workMins: Number(workMinsInput.value),
    breakMins: Number(breakMinsInput.value),
    blockEnabled: blockEnabled.checked,
    timerState: { remainingSeconds, mode, running },
  });
}

function updateDisplay() {
  modeEl.textContent = mode === "work" ? "Work" : "Break";
  timerEl.textContent = format(remainingSeconds);
  const total =
    mode === "work"
      ? Number(workMinsInput.value) * 60
      : Number(breakMinsInput.value) * 60;
  const percent = total > 0 ? 1 - remainingSeconds / total : 0;
  setProgress(percent);
  saveSettings();
}

function tick() {
  if (remainingSeconds > 0) {
    remainingSeconds--;
    updateDisplay();
  } else {
    if (mode === "work") {
      mode = "break";
      remainingSeconds = Number(breakMinsInput.value) * 60;
      chrome.notifications.create({
        type: "basic",
        iconUrl: "../assets/icons/128.png",
        title: "Break time!",
        message: "Take a short break.",
      });
    } else {
      mode = "work";
      remainingSeconds = Number(workMinsInput.value) * 60;
      chrome.notifications.create({
        type: "basic",
        iconUrl: "../assets/icons/128.png",
        title: "Back to work",
        message: "Start your next Pomodoro.",
      });
    }
    updateDisplay();
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs)
        chrome.tabs.sendMessage(t.id, { type: "timer_update" });
    });
    updateTodayTotal();
  }
}

function startTimer() {
  if (running) return;
  running = true;
  timerInterval = setInterval(tick, 1000);
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs)
      chrome.tabs.sendMessage(t.id, { type: "timer_update" });
  });
  updateDisplay();
}

function pauseTimer() {
  running = false;
  clearInterval(timerInterval);
  timerInterval = null;
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs)
      chrome.tabs.sendMessage(t.id, { type: "timer_update" });
  });
  updateDisplay();
}

function resetTimer() {
  mode = "work";
  remainingSeconds = Number(workMinsInput.value) * 60;
  pauseTimer();
  updateDisplay();
}

function updateTodayTotal() {
  const key = new Date().toISOString().slice(0, 10);
  chrome.storage.local.get({ siteDaily: {} }, (data) => {
    const daily = data.siteDaily || {};
    const byHost = daily[key] || {};
    const seconds = Object.values(byHost).reduce((a, b) => a + (b || 0), 0);
    const mins = Math.round(seconds / 60);
    todayTotalEl.textContent = `Today: ${mins}m`;
  });
}

startBtn.addEventListener("click", () => {
  startTimer();
  saveSettings();
  updateTodayTotal();
});
pauseBtn.addEventListener("click", () => {
  pauseTimer();
  saveSettings();
  updateTodayTotal();
});
resetBtn.addEventListener("click", () => {
  resetTimer();
  saveSettings();
  updateTodayTotal();
});
workMinsInput.addEventListener("change", () => {
  remainingSeconds = Number(workMinsInput.value) * 60;
  saveSettings();
  updateDisplay();
});
breakMinsInput.addEventListener("change", () => {
  saveSettings();
});
blockEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ blockEnabled: blockEnabled.checked });
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs)
      chrome.tabs.sendMessage(t.id, { type: "update_block_status" });
  });
});

loadSettings();
