const blockedTA = document.getElementById("blocked");
const saveBtn = document.getElementById("save");
const applyBtn = document.getElementById("apply");
function load(){ chrome.storage.local.get({blockedSites:[]}, (data) => { blockedTA.value = (data.blockedSites || []).join("\n"); }); }
saveBtn.addEventListener("click", () => {
  const arr = blockedTA.value.split("\n").map(s => s.trim()).filter(Boolean);
  chrome.storage.local.set({blockedSites: arr}, () => alert("Saved"));
});
applyBtn.addEventListener("click", () => {
  chrome.tabs.query({}, (tabs) => { for (const t of tabs) chrome.tabs.sendMessage(t.id, {type:"check_block"}); });
});
load();
