// SafeBrowsingService — uses Google Safe Browsing API for real-time URL checking
// Checks URLs for: phishing, malware, unwanted software, social engineering

const { GOOGLE_SAFE_BROWSING_API_KEY } = require("../config");

const API_BASE = "https://safebrowsing.googleapis.com/v4";
const REQUEST_TIMEOUT_MS = 10_000;

class SafeBrowsingService {
  constructor() {
    this.apiKey = GOOGLE_SAFE_BROWSING_API_KEY;
    this.lastError = null;
  }

  // Check if Google Safe Browsing API is available
  isAvailable() {
    return !!this.apiKey;
  }

  async check(urlString) {
    if (!this.apiKey) return null;

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(`${API_BASE}/threatMatches:find?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "xposelink", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: urlString }],
          },
        }),
        signal: ctrl.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[SafeBrowsingService] API error (${res.status})`);
        return null;
      }

      const data = await res.json().catch(() => null);
      if (!data) return null;

      // Google returns matches if the URL is flagged, empty list if safe
      if (!data.matches || data.matches.length === 0) {
        return null; // Safe, no threats detected
      }

      // URL matched one or more threat types
      const match = data.matches[0];
      const threatType = match.threatType;
      const platformType = match.platformType;

      // Map Google threat types to our verdict
      const threatMap = {
        MALWARE: { verdict: "malicious", category: "malware", riskScore: 90 },
        SOCIAL_ENGINEERING: { verdict: "malicious", category: "phishing", riskScore: 85 },
        UNWANTED_SOFTWARE: { verdict: "suspicious", category: "unwanted", riskScore: 70 },
        POTENTIALLY_HARMFUL_APPLICATION: { verdict: "suspicious", category: "harmful", riskScore: 65 },
      };

      const threat = threatMap[threatType] || { verdict: "suspicious", category: "threat", riskScore: 60 };

      const indicators = [];
      if (match.cacheDuration) {
        indicators.push(`Google flagged as ${threatType.replace(/_/g, " ").toLowerCase()}`);
      }

      return {
        matched: true,
        verdict: threat.verdict,
        category: threat.category,
        riskScore: threat.riskScore,
        indicators,
        provider: "google-safe-browsing",
        threatType,
        platformType,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        console.warn("[SafeBrowsingService] Request timeout");
      } else {
        console.warn("[SafeBrowsingService] Request failed:", err.message);
      }
      this.lastError = err.message;
      return null;
    }
  }

  stats() {
    return {
      available: this.isAvailable(),
      lastError: this.lastError,
    };
  }
}

module.exports = SafeBrowsingService;
