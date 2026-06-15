// Xposelink — Popup script (scanner + settings)

const DEFAULT_API = "http://xposelink.site";

const $ = id => document.getElementById(id);

const urlInput        = $("url-input");
const scanBtn         = $("scan-btn");
const resultArea      = $("result-area");
const toggleEnabled   = $("toggle-enabled");
const toggleIntercept = $("toggle-intercept");
const inputAllowlist  = $("input-allowlist");
const inputVtKey      = $("input-vt-key");
const saveSettingsBtn = $("save-settings");
const dashboardLink   = $("dashboard-link");
const tierBadge       = $("tier-badge");
const authStatus      = $("auth-status");
const refreshAuthBtn  = $("refresh-auth");

let apiBase = DEFAULT_API;

const TIER_STYLES = {
  free:  { bg: "rgba(96,165,250,0.18)", fg: "#93c5fd", border: "rgba(96,165,250,0.35)" },
  pro:   { bg: "rgba(167,139,250,0.20)", fg: "#c4b5fd", border: "rgba(167,139,250,0.40)" },
  team:  { bg: "rgba(45,212,191,0.20)",  fg: "#5eead4", border: "rgba(45,212,191,0.40)" },
  admin: { bg: "rgba(251,191,36,0.20)",  fg: "#fcd34d", border: "rgba(251,191,36,0.40)" },
};

function setTierBadge(tier) {
  if (!tierBadge) return;
  if (!tier) {
    tierBadge.style.display = "none";
    return;
  }
  const s = TIER_STYLES[tier] || TIER_STYLES.free;
  tierBadge.textContent = tier;
  tierBadge.style.display = "inline-block";
  tierBadge.style.background = s.bg;
  tierBadge.style.color = s.fg;
  tierBadge.style.border = `1px solid ${s.border}`;
}

// ── Ask background.js to refresh session (it probes /api/users/me via cookie) ──
function refreshBackgroundSession() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "REFRESH_SESSION" }, (s) => resolve(s || null));
  });
}

async function refreshAuthState() {
  if (authStatus) authStatus.textContent = "Checking…";
  setTierBadge(null);
  scanBtn.disabled = true;

  const session = await refreshBackgroundSession();
  if (!session?.loggedIn) {
    if (authStatus) {
      authStatus.innerHTML = `Not signed in.<br/><span style="font-size:11px;opacity:0.6">Log in on the <a href="${esc(dashboardLink.href)}" target="_blank">dashboard</a>, then click Refresh.</span>`;
    }
    resultArea.innerHTML = `<div class="error-msg" style="text-align:center">
      Sign in to Xposelink to use the scanner.<br/>
      <span style="font-size:11px;opacity:0.6">Open the dashboard, sign in, then click Refresh below.</span>
    </div>`;
    return;
  }

  const tier = session.tier || "free";
  setTierBadge(tier);

  if (authStatus) {
    authStatus.innerHTML = `Signed in (${esc(tier)})`;
  }

  if (!session.isPro) {
    resultArea.innerHTML = `<div class="error-msg">
      Your account is on the <strong>${esc(tier)}</strong> plan.<br/>
      <span style="font-size:11px;opacity:0.7">The extension scanner and auto link-check require <strong>Pro</strong> or higher.</span>
      <a href="${esc(dashboardLink.href)}" target="_blank" style="display:inline-block;margin-top:8px;padding:6px 12px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;border-radius:8px;text-decoration:none;font-size:11px;font-weight:600">Upgrade to Pro →</a>
    </div>`;
    scanBtn.disabled = true;
  } else {
    resultArea.innerHTML = "";
    scanBtn.disabled = false;
  }
}

// ── Load settings on open ────────────────────────────────────────────────
chrome.storage.sync.get(
  { enabled: true, interceptClicks: true, allowlist: "", vtApiKey: "" },
  (d) => {
    toggleEnabled.checked   = d.enabled;
    toggleIntercept.checked = d.interceptClicks;
    inputAllowlist.value    = d.allowlist;
    inputVtKey.value        = d.vtApiKey || "";
    apiBase = DEFAULT_API;
    dashboardLink.href = DEFAULT_API.replace(":3000", ":5173").replace("/api", "");

    refreshAuthState();
  }
);

// ── Show last unshorten result if recent (within 30s) ─────────────────────────
chrome.storage.local.get("xposelink_last_unshorten", ({ xposelink_last_unshorten: r }) => {
  if (!r || Date.now() - r.ts > 30000) return;
  const banner = $("unshorten-banner");
  banner.style.display = "block";
  if (r.ok) {
    banner.innerHTML = `
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;opacity:.5;margin-bottom:4px">Last Unshorten Result</div>
      <div style="font-size:11px;opacity:.5;word-break:break-all;margin-bottom:2px">${esc(r.input)}</div>
      <div style="font-size:11px;color:#34d399;word-break:break-all">↳ ${esc(r.output)}</div>
      <button id="copy-unshorten" style="margin-top:6px;font-size:11px;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.3);color:#34d399;padding:3px 10px;border-radius:6px;cursor:pointer">Copy URL</button>`;
    banner.querySelector("#copy-unshorten").addEventListener("click", () => {
      navigator.clipboard.writeText(r.output).then(() => {
        banner.querySelector("#copy-unshorten").textContent = "Copied!";
      });
    });
  } else {
    banner.innerHTML = `
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;opacity:.5;margin-bottom:4px">Last Unshorten Result</div>
      <div style="font-size:11px;color:#f87171">Failed: ${esc(r.error || "Unknown error")}</div>`;
  }
  chrome.storage.local.remove("xposelink_last_unshorten");
});

// ── Show last shorten result if recent (within 30s) ───────────────────────────
chrome.storage.local.get("xposelink_last_shorten", ({ xposelink_last_shorten: r }) => {
  if (!r || Date.now() - r.ts > 30000) return;
  const banner = $("shorten-banner");
  banner.style.display = "block";
  if (r.ok) {
    banner.innerHTML = `
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;opacity:.5;margin-bottom:4px">Last Shorten Result</div>
      <div style="font-size:11px;opacity:.5;word-break:break-all;margin-bottom:2px">${esc(r.input)}</div>
      <div style="font-size:11px;color:#34d399;word-break:break-all">↳ ${esc(r.output)}</div>
      <button id="copy-shorten" style="margin-top:6px;font-size:11px;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.3);color:#34d399;padding:3px 10px;border-radius:6px;cursor:pointer">Copy URL</button>`;
    banner.querySelector("#copy-shorten").addEventListener("click", () => {
      navigator.clipboard.writeText(r.output).then(() => {
        banner.querySelector("#copy-shorten").textContent = "Copied!";
      });
    });
  } else {
    banner.innerHTML = `
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;opacity:.5;margin-bottom:4px">Last Shorten Result</div>
      <div style="font-size:11px;color:#f87171">Failed: ${esc(r.error || "Unknown error")}</div>`;
  }
  chrome.storage.local.remove("xposelink_last_shorten");
});

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// Auto-fill URL from context menu or active tab
chrome.storage.local.get("xposelink_pending_url", ({ xposelink_pending_url }) => {
  if (xposelink_pending_url) {
    urlInput.value = xposelink_pending_url;
    chrome.storage.local.remove("xposelink_pending_url");
    setTimeout(doScan, 600); // wait for auth probe to finish
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("about:")) {
        urlInput.value = tab.url;
      }
    });
  }
});

// ── Scanner ────────────────────────────────────────────────────────────────
scanBtn.addEventListener("click", doScan);
urlInput.addEventListener("keydown", e => { if (e.key === "Enter") doScan(); });
if (refreshAuthBtn) refreshAuthBtn.addEventListener("click", refreshAuthState);

async function doScan() {
  const url = urlInput.value.trim();
  if (!url) return;

  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning…";
  resultArea.innerHTML = `<div style="color:rgba(255,255,255,0.28);font-size:12px;padding:6px 0;text-align:center">Scanning…</div>`;

  try {
    const res = await fetch(`${apiBase}/api/extension/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showError(data.message || `Server error (${res.status})`);
      return;
    }

    renderResult(url, data.data || data);
  } catch {
    showError("Cannot reach the Xposelink backend. Is the server running?");
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "Scan";
  }
}

function renderResult(url, data) {
  const verdict    = data.verdict    ?? "safe";
  const score      = data.riskScore  ?? 0;
  const provider   = data.provider   ?? "heuristic";
  const indicators = data.indicators ?? [];

  const barColor =
    verdict === "malicious"     ? "#ef4444" :
    verdict === "inappropriate" ? "#f97316" :
    score > 30                  ? "#f59e0b" : "#10b981";

  const verdictText =
    verdict === "inappropriate"
      ? (data.category === "adult" ? "Adult Content" : "Gambling")
      : verdict;

  const hasPhish = provider.includes("phishtank") || provider.includes("openphish");
  const hasVT    = provider.includes("virustotal");
  const providerText = [
    hasVT && "VirusTotal",
    "Heuristic",
    hasPhish && (provider.includes("phishtank") ? "PhishTank" : "OpenPhish"),
  ].filter(Boolean).join(" + ");
  const providerColor = hasPhish
    ? "rgba(239,68,68,0.15)"
    : hasVT ? "rgba(255,112,0,0.15)" : "rgba(255,255,255,0.06)";
  const providerFg    = hasPhish
    ? "#fca5a5"
    : hasVT ? "#fb923c" : "rgba(255,255,255,0.3)";

  const indHtml = indicators.length
    ? indicators.map(i => `<span class="indicator">${esc(i)}</span>`).join("")
    : `<span class="indicator ok">No threats detected</span>`;

  resultArea.innerHTML = `
    <div class="result-card">
      <div class="verdict-row">
        <span class="verdict ${verdict}">${esc(verdictText)}</span>
        <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${providerColor};color:${providerFg};border:1px solid ${providerColor.replace('0.15', '0.25')}">${providerText}</span>
        <span class="risk-score">Risk ${score}/100</span>
      </div>
      <div class="bar-wrap"><div class="bar" style="width:${score}%;background:${barColor}"></div></div>
      <div class="indicators">${indHtml}</div>
      <div class="url-preview">${esc(url.length > 80 ? url.slice(0, 80) + "…" : url)}</div>
    </div>`;
}

function showError(msg) {
  resultArea.innerHTML = `<div class="error-msg">${esc(msg)}</div>`;
}

// ── Toggles auto-save immediately ─────────────────────────────────────────
toggleEnabled.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: toggleEnabled.checked });
});
toggleIntercept.addEventListener("change", () => {
  chrome.storage.sync.set({ interceptClicks: toggleIntercept.checked });
});

// ── Save other settings ────────────────────────────────────────────────────
saveSettingsBtn.addEventListener("click", () => {
  chrome.storage.sync.set({
    enabled:         toggleEnabled.checked,
    interceptClicks: toggleIntercept.checked,
    allowlist:       inputAllowlist.value.trim(),
    vtApiKey:        inputVtKey.value.trim(),
  }, () => {
    saveSettingsBtn.textContent = "Saved ✓";
    setTimeout(() => { saveSettingsBtn.textContent = "Save Settings"; }, 1500);
    refreshAuthState();
  });
});
