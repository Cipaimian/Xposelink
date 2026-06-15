// VirusTotal API v3 — direct URL reputation check
// Loaded via importScripts() in background.js
// Exposes: vtCheckUrl(url, apiKey) → { verdict, riskScore, indicators, provider, vtStats }

const VT_BASE = "https://www.virustotal.com/api/v3";

function _vtUrlId(url) {
  try {
    return btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  } catch {
    return btoa(unescape(encodeURIComponent(url))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
}

function _vtSignal(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

function _vtParseAttributes(attributes) {
  const stats = attributes.last_analysis_stats || {};
  const { malicious = 0, suspicious = 0, harmless = 0, undetected = 0, timeout = 0 } = stats;
  const total = malicious + suspicious + harmless + undetected + timeout;

  if (total === 0) {
    return {
      verdict: "safe",
      riskScore: 15,
      indicators: [{ type: "warn", text: "No scan data. URL not yet analysed by VirusTotal" }],
      provider: "virustotal",
      vtStats: stats,
    };
  }

  const indicators = [];

  if (malicious > 0) {
    indicators.push({ type: "bad", text: `Flagged malicious by ${malicious} / ${total} engines` });
  }
  if (suspicious > 0) {
    indicators.push({ type: "warn", text: `Flagged suspicious by ${suspicious} / ${total} engines` });
  }
  if (malicious === 0 && suspicious === 0) {
    indicators.push({ type: "good", text: `Clean. ${harmless} engines found no threats` });
  }

  const catMap = attributes.categories || {};
  const catList = [...new Set(Object.values(catMap))].slice(0, 3);
  if (catList.length > 0) {
    indicators.push({ type: "good", text: `Category: ${catList.join(", ")}` });
  }

  const reputation = attributes.reputation ?? null;
  if (reputation !== null) {
    if (reputation > 0) indicators.push({ type: "good", text: `Community reputation: +${reputation}` });
    else if (reputation < 0) indicators.push({ type: "bad", text: `Community reputation: ${reputation}` });
  }

  let verdict, riskScore;
  if (malicious >= 3) {
    verdict = "malicious";
    riskScore = Math.min(100, 70 + malicious * 2);
  } else if (malicious >= 1 || suspicious >= 4) {
    verdict = "suspicious";
    riskScore = Math.min(69, 45 + malicious * 10 + suspicious * 3);
  } else if (suspicious >= 1) {
    verdict = "suspicious";
    riskScore = Math.min(44, 25 + suspicious * 8);
  } else {
    verdict = "safe";
    riskScore = Math.max(0, Math.round((undetected / total) * 12));
  }

  return { verdict, riskScore, indicators, provider: "virustotal", vtStats: stats };
}

async function vtCheckUrl(url, apiKey) {
  const headers = { "x-apikey": apiKey, Accept: "application/json" };

  // 1. Try cached report by URL ID (base64url of the URL)
  const urlId = _vtUrlId(url);
  const reportRes = await fetch(`${VT_BASE}/urls/${urlId}`, {
    headers,
    signal: _vtSignal(10000),
  });

  if (reportRes.ok) {
    const body = await reportRes.json();
    return _vtParseAttributes(body.data?.attributes || {});
  }

  if (reportRes.status === 401) throw new Error("VirusTotal API key invalid or expired");
  if (reportRes.status === 429) throw new Error("VirusTotal rate limit reached. Try again later");

  // 2. Not cached (404) — submit the URL for scanning
  if (reportRes.status === 404) {
    const body = new URLSearchParams({ url });
    const submitRes = await fetch(`${VT_BASE}/urls`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: _vtSignal(12000),
    });

    if (submitRes.status === 401) throw new Error("VirusTotal API key invalid or expired");
    if (submitRes.status === 429) throw new Error("VirusTotal rate limit reached. Try again later");
    if (!submitRes.ok) throw new Error(`VirusTotal submission failed (${submitRes.status})`);

    const submitted = await submitRes.json();
    const analysisId = submitted.data?.id;
    if (!analysisId) throw new Error("VirusTotal returned no analysis ID");

    // 3. Fetch analysis result (may be queued/in-progress)
    const analysisRes = await fetch(`${VT_BASE}/analyses/${analysisId}`, {
      headers,
      signal: _vtSignal(12000),
    });

    if (!analysisRes.ok) {
      return {
        verdict: "safe",
        riskScore: 10,
        indicators: [{ type: "warn", text: "Submitted to VirusTotal. Scan results pending" }],
        provider: "virustotal",
        vtStats: {},
      };
    }

    const analysis = await analysisRes.json();
    const attrs = analysis.data?.attributes || {};

    if (attrs.status === "queued" || attrs.status === "in-progress") {
      return {
        verdict: "safe",
        riskScore: 10,
        indicators: [{ type: "warn", text: "VirusTotal scan in progress. Check again shortly" }],
        provider: "virustotal",
        vtStats: attrs.stats || {},
      };
    }

    return _vtParseAttributes({ last_analysis_stats: attrs.stats || {}, categories: {} });
  }

  throw new Error(`VirusTotal error (${reportRes.status})`);
}
