// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    { workMins: 25, breakMins: 5, blockEnabled: true, blockedSites: [] },
    (s) => {
      // default settings already in popup.js, but keep initial here if needed
    }
  );
});

// Example: react to alarms (if you set alarms elsewhere)
chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.notifications.create({
    type: "basic",
    title: "ProcastiMate",
    message: `Alarm: ${alarm.name}`,
  });
});

// Optional: when extension icon clicked, ensure content scripts are injected to all tabs
chrome.action.onClicked.addListener((tab) => {
  // nothing: popup handles actions. But we could inject content script if needed
});
