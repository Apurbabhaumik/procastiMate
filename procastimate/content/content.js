const OVERLAY_ID = "procastimate-overlay-v2";
function log(...args){ try{ console.log("[ProcastiMate]",...args); } catch(e){} }
function createOverlay(reason = "Blocked by ProcastiMate") {
  if (document.getElementById(OVERLAY_ID)) return;
  const div = document.createElement("div");
  div.id = OVERLAY_ID;
  Object.assign(div.style, {
    position: "fixed", inset: "0", background: "#ffffff", color: "#111", zIndex: 2147483647,
    display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px",
    fontFamily: "system-ui, Arial"
  });
  div.innerHTML = `
    <div style="max-width:720px;">
      <h1 style="margin:0 0 8px">Focus time — site blocked</h1>
      <p style="margin:0 0 12px">${reason}</p>
      <button id="pm-temporary-open" style="padding:8px 12px;cursor:pointer">Temporarily open</button>
    </div>
  `;
  document.documentElement.appendChild(div);
  document.getElementById("pm-temporary-open").addEventListener("click", () => div.remove());
  log("Overlay created for", location.href);
}
function removeOverlay(){ const el = document.getElementById(OVERLAY_ID); if (el){ el.remove(); log("Overlay removed"); } }
function hostMatchesRule(host, rule){
  rule = (rule || "").trim().toLowerCase(); if (!rule) return false;
  if (rule.startsWith("http://") || rule.startsWith("https://")){
    try{ rule = new URL(rule).hostname; } catch(e){}
  }
  rule = rule.replace("*.", "");
  if (host === rule) return true;
  if (host.endsWith("." + rule)) return true;
  return host.includes(rule);
}
function checkAndBlockOnce(){
  chrome.storage.local.get({ blockedSites: [], blockEnabled: true, timerState: null }, (data) => {
    const host = location.hostname.toLowerCase();
    log("Checking host", host, "blockEnabled=", data.blockEnabled, "blockedSites=", data.blockedSites);
    if (!data.blockEnabled) { removeOverlay(); return; }
    const isWorkRunning = data.timerState && data.timerState.running && data.timerState.mode === "work";
    const shouldBlock = (data.blockedSites || []).some(rule => hostMatchesRule(host, rule));
    if (shouldBlock && isWorkRunning) createOverlay(); else removeOverlay();
  });
}
checkAndBlockOnce();
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === "check_block" || msg.type === "update_block_status" || msg.type === "timer_update") {
    checkAndBlockOnce();
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.blockedSites || changes.blockEnabled || changes.timerState)) checkAndBlockOnce();
});
