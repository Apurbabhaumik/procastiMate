const timerEl = document.getElementById("timer");
const modeEl = document.getElementById("mode");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");
const workMinsInput = document.getElementById("workMins");
const breakMinsInput = document.getElementById("breakMins");
const blockEnabled = document.getElementById("blockEnabled");

let timerInterval = null;
let remainingSeconds = 25 * 60;
let mode = "work"; // 'work' or 'break'
let running = false;

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
  saveSettings();
}

function tick() {
  if (remainingSeconds > 0) {
    remainingSeconds--;
    updateDisplay();
  } else {
    // switch modes
    if (mode === "work") {
      mode = "break";
      remainingSeconds = Number(breakMinsInput.value) * 60;
      chrome.notifications.create({
        type: "basic",
        iconUrl: "../icons/128.png",
        title: "Break time!",
        message: "Take a short break.",
      });
    } else {
      mode = "work";
      remainingSeconds = Number(workMinsInput.value) * 60;
      chrome.notifications.create({
        type: "basic",
        iconUrl: "../icons/128.png",
        title: "Back to work",
        message: "Start your next Pomodoro.",
      });
    }
    updateDisplay();
  }
}

function startTimer() {
  if (running) return;
  running = true;
  timerInterval = setInterval(tick, 1000);
  updateDisplay();
}

function pauseTimer() {
  running = false;
  clearInterval(timerInterval);
  timerInterval = null;
  updateDisplay();
}

function resetTimer() {
  mode = "work";
  remainingSeconds = Number(workMinsInput.value) * 60;
  pauseTimer();
  updateDisplay();
}

startBtn.addEventListener("click", () => {
  startTimer();
  saveSettings();
});
pauseBtn.addEventListener("click", () => {
  pauseTimer();
  saveSettings();
});
resetBtn.addEventListener("click", () => {
  resetTimer();
  saveSettings();
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
  // Optional: notify content scripts to update
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      chrome.tabs.sendMessage(t.id, { type: "update_block_status" });
    }
  });
});

loadSettings();
