// PhishingFeedService — maintains an in-memory cache of known phishing URLs.
//
// Sources (in order of preference):
//   1. PhishTank (community-verified, requires free API key registered at phishtank.com)
//   2. OpenPhish (free public feed, no key required — used as default fallback)
//
// Both feeds refresh hourly. The service is non-blocking: API failures fall back
// to whatever was last cached (or empty Set on first failure).
//
// Lookups are O(1) for exact URL match and O(1) for hostname match.

const { PHISHTANK_API_KEY } = require("../config");

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 20_000;

function phishTankUrl(apiKey) {
  // PhishTank's online-valid feed; ASCII to keep it small (~3 MB)
  return `https://data.phishtank.com/data/${apiKey}/online-valid.csv`;
}

const OPENPHISH_URL = "https://openphish.com/feed.txt";

async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

class PhishingFeedService {
  constructor() {
    this.urls = new Set();      // exact URL match (lowercased)
    this.hosts = new Set();     // hostname match (catches URL variants)
    this.source = "none";       // "phishtank" | "openphish" | "none"
    this.lastRefresh = null;    // timestamp
    this.entryCount = 0;
    this._timer = null;
  }

  // Parse the PhishTank CSV. Format: phish_id,url,phish_detail_url,submission_time,verified,verification_time,online,target
  parsePhishTankCsv(text) {
    const out = [];
    const lines = text.split("\n");
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // URLs can contain commas, so split carefully — second field is the URL,
      // wrapped in quotes only if it contains a comma. Easiest: split on first comma.
      const firstComma = line.indexOf(",");
      if (firstComma < 0) continue;
      const rest = line.slice(firstComma + 1);
      const nextComma = rest.indexOf(",");
      if (nextComma < 0) continue;
      let url = rest.slice(0, nextComma).trim();
      // Strip surrounding quotes if present
      if (url.startsWith('"') && url.endsWith('"')) url = url.slice(1, -1);
      if (url.startsWith("http")) out.push(url);
    }
    return out;
  }

  // Parse the OpenPhish feed (plain text, one URL per line)
  parseOpenPhishText(text) {
    return text.split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"));
  }

  async _fetchFeed() {
    // Try PhishTank first if key is configured
    if (PHISHTANK_API_KEY) {
      try {
        const res = await fetchWithTimeout(phishTankUrl(PHISHTANK_API_KEY), {
          headers: {
            // PhishTank requires a unique User-Agent per their TOS
            "User-Agent": `phishtank/${PHISHTANK_API_KEY}`,
          },
        });
        if (res.ok) {
          const text = await res.text();
          return { source: "phishtank", urls: this.parsePhishTankCsv(text) };
        }
        console.warn(`[PhishingFeedService] PhishTank fetch failed (${res.status}), falling back to OpenPhish`);
      } catch (err) {
        console.warn(`[PhishingFeedService] PhishTank error: ${err.message} — falling back to OpenPhish`);
      }
    }

    // OpenPhish public feed (no key)
    try {
      const res = await fetchWithTimeout(OPENPHISH_URL);
      if (res.ok) {
        const text = await res.text();
        return { source: "openphish", urls: this.parseOpenPhishText(text) };
      }
      console.warn(`[PhishingFeedService] OpenPhish fetch failed (${res.status})`);
    } catch (err) {
      console.warn(`[PhishingFeedService] OpenPhish error: ${err.message}`);
    }

    return null;
  }

  async refresh() {
    const result = await this._fetchFeed();
    if (!result) return; // keep last good cache

    const newUrls = new Set();
    const newHosts = new Set();

    for (const raw of result.urls) {
      const url = raw.toLowerCase();
      newUrls.add(url);
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (host) newHosts.add(host);
      } catch {
        // skip malformed
      }
    }

    this.urls = newUrls;
    this.hosts = newHosts;
    this.source = result.source;
    this.lastRefresh = new Date().toISOString();
    this.entryCount = newUrls.size;
    console.log(`[PhishingFeedService] Loaded ${this.entryCount} URLs from ${this.source}`);
  }

  // Synchronous check. Returns null if not matched, or { matched: true, type, source }
  check(urlString) {
    if (!this.entryCount) return null;
    let parsed;
    try { parsed = new URL(urlString); }
    catch { return null; }

    const normalized = urlString.toLowerCase();
    if (this.urls.has(normalized)) {
      return { matched: true, type: "exact", source: this.source };
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (this.hosts.has(host)) {
      return { matched: true, type: "host", source: this.source };
    }

    return null;
  }

  // Start periodic refresh. Runs an immediate fetch in the background, then
  // every REFRESH_INTERVAL_MS. Safe to call multiple times (clears prior timer).
  start() {
    if (this._timer) clearInterval(this._timer);
    // Fire-and-forget initial load so server startup isn't blocked
    this.refresh().catch((err) => console.warn("[PhishingFeedService] Initial refresh failed:", err.message));
    this._timer = setInterval(() => {
      this.refresh().catch((err) => console.warn("[PhishingFeedService] Periodic refresh failed:", err.message));
    }, REFRESH_INTERVAL_MS);
  }

  // For health checks / admin UI
  stats() {
    return {
      source: this.source,
      entryCount: this.entryCount,
      lastRefresh: this.lastRefresh,
    };
  }
}

module.exports = PhishingFeedService;
