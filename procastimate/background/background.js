chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ workMins:25, breakMins:5, blockEnabled:true, blockedSites:[] }, (s) => {
    // defaults present
  });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.notifications.create({ type:"basic", title:"ProcastiMate", message: `Alarm: ${alarm.name}` });
});
