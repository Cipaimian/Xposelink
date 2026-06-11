// Xposelink Security — Background service worker
// Handles: URL analysis, context menus, clipboard bridge, session polling

importScripts("utils/url-analyzer.js", "utils/virustotal.js", "utils/api.js");

const PRO_TIERS = ["pro", "team", "admin"];
const SESSION_REFRESH_MS = 5 * 60 * 1000; // re-probe every 5 minutes

// ── Cached VT key (avoid async storage reads inside message handlers) ─────────
let _vtApiKey = "";
chrome.storage.sync.get({ vtApiKey: "" }, (d) => { _vtApiKey = d.vtApiKey || ""; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "vtApiKey" in changes) _vtApiKey = changes.vtApiKey.newValue || "";
});

// ── Session polling — caches {loggedIn, tier, isPro} for content.js ───────────
async function refreshSession() {
  try {
    const me = await xposeMe();
    const tier = me?.quota?.tier || null;
    const session = {
      loggedIn: Boolean(me?.user),
      tier,
      isPro: tier ? PRO_TIERS.includes(tier) : false,
      checkedAt: Date.now(),
    };
    await chrome.storage.local.set({ xposelink_session: session });
    return session;
  } catch {
    const session = { loggedIn: false, tier: null, isPro: false, checkedAt: Date.now() };
    await chrome.storage.local.set({ xposelink_session: session });
    return session;
  }
}

// Run on startup, install, and on a periodic alarm
chrome.runtime.onInstalled.addListener(() => { refreshSession(); });
chrome.runtime.onStartup.addListener(() => { refreshSession(); });
chrome.alarms.create("xposelink-session-refresh", { periodInMinutes: SESSION_REFRESH_MS / 60000 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "xposelink-session-refresh") refreshSession();
});

// ── Context menus ─────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "lg-unshorten", title: "🔗 Unshorten Link",       contexts: ["link", "selection"] });
    chrome.contextMenus.create({ id: "lg-shorten",   title: "✂️ Shorten Link",          contexts: ["link", "selection"] });
    chrome.contextMenus.create({ id: "lg-scan",      title: "🔍 Scan with Xposelink",   contexts: ["link"] });
  });
});

// ── Message handler (from content.js / popup.js) ─────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE_URL") {
    xposeMe().then((me) => {
      if (!me?.user) {
        sendResponse({ error: "Sign in to Xposelink to scan links." });
        return;
      }
      const tier = me.quota?.tier;
      if (!PRO_TIERS.includes(tier)) {
        sendResponse({ error: `Link scanning requires a Pro plan. Your account is on ${tier || "Free"}.`, code: "UPGRADE_REQUIRED" });
        return;
      }
      analyzeUrlFull(msg.url)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
    }).catch(() => sendResponse({ error: "Cannot reach Xposelink backend." }));
    return true;
  }

  if (msg.type === "REFRESH_SESSION") {
    refreshSession().then(sendResponse);
    return true;
  }
});

// ── Full analysis ─────────────────────────────────────────────────────────────
async function analyzeUrlFull(url) {
  const heuristic = analyzeUrl(url);

  const vtPromise = _vtApiKey
    ? vtCheckUrl(url, _vtApiKey)
    : Promise.resolve(null);

  const [vtRes, secRes, unsRes, ogRes] = await Promise.allSettled([
    vtPromise,
    xposeSecurity(url),
    xposeUnshorten(url, { internal: true }),
    fetchOgMetadata(url),
  ]);

  const virustotal = vtRes.status  === "fulfilled" ? vtRes.value   : null;
  const security   = secRes.status === "fulfilled" ? secRes.value  : null;
  const unshorten  = unsRes.status === "fulfilled" ? unsRes.value  : null;
  const og         = ogRes.status  === "fulfilled" ? ogRes.value   : null;

  const resolvedUrl =
    unshorten?.data?.originalUrl ||
    unshorten?.originalUrl ||
    url;

  return { originalUrl: url, resolvedUrl, virustotal, security, heuristic, og };
}

// ── Context menu clicks ───────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.linkUrl || info.selectionText?.trim();
  if (!url || !tab?.id) return;

  // Gate by Pro+ tier — refresh cached session first to handle stale state
  const session = await refreshSession();
  if (!session.loggedIn) {
    sendToast(tab.id, "Sign in to Xposelink", "Log in on the dashboard to use this feature.", "error");
    return;
  }
  if (!session.isPro) {
    sendToast(tab.id, "Pro plan required", `The Xposelink extension requires a Pro plan (you're on ${session.tier || "Free"}).`, "error");
    return;
  }

  if (info.menuItemId === "lg-unshorten") {
    setBadge("...", "#7c3aed");
    try {
      const result   = await xposeUnshorten(url);
      const finalUrl = result?.data?.originalUrl || result?.originalUrl || url;
      await chrome.storage.local.set({ xposelink_last_unshorten: { input: url, output: finalUrl, ok: true, ts: Date.now() } });
      setBadge("✓", "#10b981");
      sendCopy(tab.id, finalUrl);
      sendToast(tab.id, `🔗 Resolved: ${trunc(finalUrl, 55)}`, "Copied to clipboard!");
    } catch (e) {
      await chrome.storage.local.set({ xposelink_last_unshorten: { input: url, error: e.message, ok: false, ts: Date.now() } });
      setBadge("!", "#ef4444");
      sendToast(tab.id, "Could not unshorten link", e.message, "error");
    }
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 6000);
  }

  if (info.menuItemId === "lg-shorten") {
    setBadge("...", "#7c3aed");
    try {
      const result   = await xposeShorten(url);
      const shortUrl = result?.data?.shortUrl || result?.shortUrl;
      if (!shortUrl) throw new Error("No short URL returned. Are you signed in?");
      await chrome.storage.local.set({ xposelink_last_shorten: { input: url, output: shortUrl, ok: true, ts: Date.now() } });
      setBadge("✓", "#10b981");
      sendCopy(tab.id, shortUrl);
      sendToast(tab.id, `✂️ Shortened: ${trunc(shortUrl, 55)}`, "Copied to clipboard!");
    } catch (e) {
      await chrome.storage.local.set({ xposelink_last_shorten: { input: url, error: e.message, ok: false, ts: Date.now() } });
      setBadge("!", "#ef4444");
      sendToast(tab.id, "Could not shorten link", e.message, "error");
    }
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 6000);
  }

  if (info.menuItemId === "lg-scan") {
    await chrome.storage.local.set({ xposelink_pending_url: url });
    chrome.windows.create({
      url:    chrome.runtime.getURL("popup.html"),
      type:   "popup",
      width:  380,
      height: 520,
    });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function sendToast(tabId, text, subtext, toastType = "success") {
  chrome.tabs.sendMessage(tabId, { type: "SHOW_TOAST", text, subtext, toastType }).catch(() => {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/logo48.png"),
      title: text,
      message: subtext || "",
      priority: 1,
    });
  });
}

function sendCopy(tabId, text) {
  chrome.tabs.sendMessage(tabId, { type: "COPY_TEXT", text }).catch(() => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: (t) => navigator.clipboard.writeText(t).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }),
      args: [text],
    }).catch(() => {});
  });
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function trunc(str, len) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}
