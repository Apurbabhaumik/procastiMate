/* background/background.js
   Tracker with per-day site time (siteDaily) and totals (siteStats)
*/

const tracker = {
  current: {
    tabId: null,
    windowId: null,
    hostname: null,
    startTs: null,
    visible: false,
  },

  async init() {
    await this.getStorage({ siteStats: {}, siteDaily: {} }); // ensure keys exist
    chrome.tabs.onActivated.addListener((info) => this.onTabActivated(info));
    chrome.windows.onFocusChanged.addListener((winId) =>
      this.onWindowFocusChanged(winId)
    );
    chrome.tabs.onRemoved.addListener((tabId) => this.onTabRemoved(tabId));
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
      this.onTabUpdated(tabId, changeInfo, tab)
    );

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg) return;
      if (msg.type === "visibility_change" && sender.tab) {
        this.onVisibilityChange(sender.tab.id, !!msg.visible);
      }
      if (msg.type === "request_stats") {
        this.getStorage({ siteStats: {}, siteDaily: {} }).then((d) =>
          sendResponse(d)
        );
        return true;
      }
    });

    // set initial active tab
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      const tab = tabs && tabs[0];
      if (tab) this.startForTab(tab.id, tab.windowId, tab.url, true);
    } catch (e) {
      /* ignore */
    }
  },

  getStorage(keys) {
    return new Promise((res) => chrome.storage.local.get(keys, res));
  },
  setStorage(obj) {
    return new Promise((res) => chrome.storage.local.set(obj, res));
  },

  getHostnameFromUrl(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (e) {
      return null;
    }
  },

  async onTabActivated(info) {
    try {
      const tab = await chrome.tabs.get(info.tabId);
      if (!tab) return;
      const win = await chrome.windows.get(tab.windowId);
      const windowFocused = win && win.focused;
      this.startForTab(tab.id, tab.windowId, tab.url, !!windowFocused);
    } catch (e) {}
  },

  async onWindowFocusChanged(winId) {
    if (winId === chrome.windows.WINDOW_ID_NONE) {
      this.pauseCurrent();
      return;
    }
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId: winId });
      const tab = tabs && tabs[0];
      if (tab) this.startForTab(tab.id, tab.windowId, tab.url, true);
    } catch (e) {}
  },

  onTabRemoved(tabId) {
    if (this.current.tabId === tabId) this.stopCurrentAndRecord();
  },

  onTabUpdated(tabId, changeInfo, tab) {
    if (this.current.tabId === tabId && changeInfo.url) {
      this.stopCurrentAndRecord();
      this.startForTab(tab.id, tab.windowId, tab.url, true);
    }
  },

  onVisibilityChange(tabId, visible) {
    if (this.current.tabId !== tabId) return;
    if (visible && !this.current.visible) {
      this.current.visible = true;
      this.current.startTs = Date.now();
    } else if (!visible && this.current.visible) {
      this.current.visible = false;
      this.stopCurrentAndRecord(true);
    }
  },

  startForTab(tabId, windowId, url, visible) {
    const hostname = this.getHostnameFromUrl(url);
    if (!hostname) {
      this.pauseCurrent();
      return;
    }
    if (this.current.tabId === tabId && this.current.hostname === hostname) {
      this.current.visible = !!visible;
      if (this.current.visible && !this.current.startTs)
        this.current.startTs = Date.now();
      return;
    }
    this.stopCurrentAndRecord();
    this.current = {
      tabId,
      windowId,
      hostname,
      startTs: visible ? Date.now() : null,
      visible: !!visible,
    };
    console.log(
      "ProcastiMate tracker: started",
      hostname,
      "visible=",
      !!visible
    );
  },

  pauseCurrent() {
    if (this.current && this.current.startTs && this.current.visible) {
      this.stopCurrentAndRecord(true);
    } else {
      this.current.startTs = null;
      this.current.visible = false;
    }
  },

  async stopCurrentAndRecord(keepMeta = false) {
    if (!this.current || !this.current.startTs) return;
    const now = Date.now();
    const elapsedMs = now - this.current.startTs;
    const seconds = Math.floor(elapsedMs / 1000);
    if (seconds > 0 && this.current.hostname) {
      await this.addSecondsToHost(this.current.hostname, seconds);
      console.log(
        `ProcastiMate tracker: recorded ${seconds}s for ${this.current.hostname}`
      );
    }
    if (keepMeta) {
      this.current.startTs = null;
      this.current.visible = false;
    } else {
      this.current = {
        tabId: null,
        windowId: null,
        hostname: null,
        startTs: null,
        visible: false,
      };
    }
  },

  // Adds seconds to both siteStats (total) and siteDaily (per-date)
  async addSecondsToHost(hostname, seconds) {
    const data = await this.getStorage({ siteStats: {}, siteDaily: {} });
    const stats = data.siteStats || {};
    if (!stats[hostname]) stats[hostname] = 0;
    stats[hostname] += seconds;

    const daily = data.siteDaily || {};
    const d = new Date();
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!daily[key]) daily[key] = {};
    if (!daily[key][hostname]) daily[key][hostname] = 0;
    daily[key][hostname] += seconds;

    await this.setStorage({ siteStats: stats, siteDaily: daily });
  },

  async resetStats() {
    await this.setStorage({ siteStats: {}, siteDaily: {} });
  },
};

tracker.init().catch((err) => console.error("Tracker init failed", err));
