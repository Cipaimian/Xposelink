// LinkGuard — Heuristic URL safety scoring
// Loaded via importScripts() in background.js
// Exposes: analyzeUrl(urlString) → { score, rating, indicators, isShortened }

const TRUSTED_DOMAINS = [
  "google.com", "github.com", "youtube.com", "twitter.com", "x.com",
  "facebook.com", "instagram.com", "linkedin.com", "microsoft.com", "apple.com",
  "amazon.com", "wikipedia.org", "stackoverflow.com", "reddit.com", "npmjs.com",
  "cloudflare.com", "vercel.com", "netlify.com", "stripe.com", "paypal.com",
  "shopify.com", "dropbox.com", "notion.so", "figma.com", "medium.com",
  "twitch.tv", "discord.com", "slack.com", "zoom.us", "atlassian.com",
];

const KNOWN_SHORTENERS = [
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "buff.ly",
  "is.gd", "rb.gy", "cutt.ly", "v.gd", "short.io", "tiny.cc",
  "bl.ink", "rebrand.ly", "shorturl.at", "snip.ly", "clck.ru",
  "l.ead.me", "u.to", "linktr.ee",
];

function analyzeUrl(urlString) {
  let score = 50;
  const indicators = [];
  let isShortened = false;

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return {
      score: 0,
      rating: "dangerous",
      indicators: [{ type: "bad", text: "Invalid or malformed URL" }],
      isShortened: false,
    };
  }

  const hostname    = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const rootDomain  = hostname.split(".").slice(-2).join(".");
  const pathSegs    = parsed.pathname.split("/").filter(Boolean);

  // ── Protocol ────────────────────────────────────────────────────────────────
  if (parsed.protocol === "https:") {
    score += 20;
    indicators.push({ type: "good", text: "HTTPS connection" });
  } else if (parsed.protocol === "http:") {
    indicators.push({ type: "warn", text: "Unencrypted HTTP connection" });
  } else if (parsed.protocol === "javascript:" || parsed.protocol === "data:") {
    score -= 40;
    indicators.push({ type: "bad", text: `Dangerous protocol: ${parsed.protocol}` });
  } else {
    score -= 20;
    indicators.push({ type: "warn", text: `Unusual protocol: ${parsed.protocol}` });
  }

  // ── Domain reputation ────────────────────────────────────────────────────────
  if (TRUSTED_DOMAINS.includes(rootDomain)) {
    score += 20;
    indicators.push({ type: "good", text: "Known trusted domain" });
  }
  if (hostname.length > 30) {
    score -= 10;
    indicators.push({ type: "warn", text: "Unusually long domain name" });
  }
  const hyphenCount = (hostname.match(/-/g) || []).length;
  if (hyphenCount > 3) {
    score -= 10;
    indicators.push({ type: "warn", text: "Multiple hyphens in domain (typosquatting risk)" });
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    score -= 15;
    indicators.push({ type: "bad", text: "Raw IP address used as domain" });
  }

  // ── URL structure ────────────────────────────────────────────────────────────
  if (parsed.username || urlString.includes("@")) {
    score -= 20;
    indicators.push({ type: "bad", text: "Credential phishing pattern detected (@)" });
  }
  if (/%[0-9a-f]{2}/i.test(hostname)) {
    score -= 10;
    indicators.push({ type: "bad", text: "URL-encoded characters in domain" });
  }
  if (pathSegs.length > 5) {
    score -= 5;
    indicators.push({ type: "warn", text: "Deep URL path structure" });
  }
  if (urlString.length > 200) {
    score -= 5;
    indicators.push({ type: "warn", text: "Unusually long URL" });
  }

  // ── Shortener detection ──────────────────────────────────────────────────────
  if (KNOWN_SHORTENERS.includes(hostname) || KNOWN_SHORTENERS.some(s => hostname.endsWith(`.${s}`))) {
    isShortened = true;
    indicators.push({ type: "warn", text: "URL was shortened. Final destination unknown" });
  }

  score = Math.max(0, Math.min(100, score));

  const rating =
    score >= 80 ? "safe" :
    score >= 50 ? "caution" :
    score >= 20 ? "suspicious" : "dangerous";

  return { score, rating, indicators, isShortened };
}
