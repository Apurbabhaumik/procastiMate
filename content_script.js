// content_script.js - improved with logs, storage change listener, and stronger matching
const OVERLAY_ID = "procastimate-overlay-v2";

function log(...args) {
  try {
    console.log("[ProcastiMate content_script]", ...args);
  } catch (e) {}
}

function createOverlay(reason = "Blocked by ProcastiMate") {
  if (document.getElementById(OVERLAY_ID)) return;
  const div = document.createElement("div");
  div.id = OVERLAY_ID;
  Object.assign(div.style, {
    position: "fixed",
    inset: "0",
    background: "#ffffff",
    color: "#111",
    zIndex: 2147483647,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "20px",
    fontFamily: "system-ui, Arial",
  });
  div.innerHTML = `
    <div style="max-width:720px;">
      <h1 style="margin:0 0 8px">Focus time — site blocked</h1>
      <p style="margin:0 0 12px">${reason}</p>
      <button id="pm-temporary-open" style="padding:8px 12px;cursor:pointer">Temporarily open</button>
    </div>
  `;
  document.documentElement.appendChild(div);
  document.getElementById("pm-temporary-open").addEventListener("click", () => {
    div.remove();
  });
  log("Overlay created for", location.href);
}

function removeOverlay() {
  const el = document.getElementById(OVERLAY_ID);
  if (el) {
    el.remove();
    log("Overlay removed");
  }
}

function hostMatchesRule(host, rule) {
  // Normalize: strip protocol/paths if user pasted full url
  rule = (rule || "").trim().toLowerCase();
  if (!rule) return false;
  // If rule looks like a domain pattern -> test domain inclusion and exact matches
  // support: example.com, .example.com, *.example.com, facebook.com, twitter.com/path
  try {
    // If user wrote a full URL, extract hostname
    if (rule.startsWith("http://") || rule.startsWith("https://")) {
      try {
        const u = new URL(rule);
        rule = u.hostname;
      } catch (_) {}
    }
  } catch (_) {}
  // wildcard start
  rule = rule.replace("*.", "");
  // If rule starts with '.' allow subdomains and exact matches
  if (host === rule) return true;
  if (host.endsWith("." + rule)) return true;
  // last resort substring check (useful for patterns like 'facebook')
  return host.includes(rule);
}

function checkAndBlockOnce() {
  chrome.storage.local.get({ blockedSites: [], blockEnabled: true }, (data) => {
    const host = location.hostname.toLowerCase();
    log(
      "Checking host",
      host,
      "blockEnabled=",
      data.blockEnabled,
      "blockedSites=",
      data.blockedSites
    );
    if (!data.blockEnabled) {
      removeOverlay();
      return;
    }
    const shouldBlock = (data.blockedSites || []).some((rule) =>
      hostMatchesRule(host, rule)
    );
    if (shouldBlock) createOverlay();
    else removeOverlay();
  });
}

// Initial check
checkAndBlockOnce();

// Listen for messages (from popup/options) to re-check
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (
    msg &&
    (msg.type === "check_block" || msg.type === "update_block_status")
  ) {
    log("Received message", msg.type);
    checkAndBlockOnce();
  }
});

// Also listen to storage changes (so toggling in popup/options updates pages immediately)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.blockedSites || changes.blockEnabled)) {
    log("Storage changed, re-checking");
    checkAndBlockOnce();
  }
});
