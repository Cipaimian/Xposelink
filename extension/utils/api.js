// Xposelink — extension API wrappers
// Loaded via importScripts() in background.js
// Exposes: xposeSecurity, xposeUnshorten, xposeShorten, fetchOgMetadata, xposeMe

const DEFAULT_API_BASE = "http://xposelink.site";

async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get({ apiBase: DEFAULT_API_BASE, vtApiKey: "" }, (sync) => {
      resolve({
        apiBase: sync.apiBase.replace(/\/$/, ""),
        vtApiKey: sync.vtApiKey || "",
      });
    });
  });
}

function jsonHeaders(extra = {}) {
  return { "Content-Type": "application/json", ...extra };
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

async function getAuthToken() {
  const { apiBase } = await getConfig();
  return new Promise((resolve) => {
    try {
      const url = new URL(apiBase);
      chrome.cookies.get({ url: url.href, name: "xposelink_token" }, (cookie) => {
        resolve(cookie?.value || null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function xposeMe() {
  const { apiBase } = await getConfig();
  const token = await getAuthToken();
  const headers = token ? { "Authorization": `Bearer ${token}` } : {};

  const res = await fetch(`${apiBase}/api/users/me`, {
    headers,
    signal: withTimeout(8000),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function xposeSecurity(url) {
  const { apiBase } = await getConfig();
  const token = await getAuthToken();
  const headers = { ...jsonHeaders() };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${apiBase}/api/security/check`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
    signal: withTimeout(15000),
  });
  if (!res.ok) throw new Error(`Security check failed (${res.status})`);
  const payload = await res.json();
  return payload.data || payload;
}

// internal=true marks the call as part of the automatic click-interception scan,
// which should not cost a token (the backend only honors skipQuota for Pro+ tiers).
async function xposeUnshorten(url, { internal = false } = {}) {
  const { apiBase } = await getConfig();
  const token = await getAuthToken();
  const headers = { ...jsonHeaders() };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${apiBase}/api/links/unshorten`, {
    method: "POST",
    headers,
    body: JSON.stringify({ shortUrl: url, skipQuota: internal }),
    signal: withTimeout(15000),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || `Unshorten failed (${res.status})`);
  return payload;
}

async function xposeShorten(url) {
  const { apiBase } = await getConfig();
  const token = await getAuthToken();
  const headers = { ...jsonHeaders() };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${apiBase}/api/links/shorten`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
    signal: withTimeout(10000),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || `Shorten failed (${res.status})`);
  return payload;
}

async function fetchOgMetadata(url) {
  try {
    const signal = withTimeout(5000);
    const res = await fetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal,
    });
    if (!res.ok) return null;
    const html = await res.text();

    const getOg = (prop) => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']{1,400})["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']{1,400})["'][^>]+property=["']og:${prop}["']`, "i"),
        new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']{1,400})["']`, "i"),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) return m[1].trim();
      }
      return null;
    };

    return {
      title:       getOg("title") || html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() || null,
      description: getOg("description"),
      image:       getOg("image"),
    };
  } catch {
    return null;
  }
}
