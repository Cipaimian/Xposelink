// LinkGuard — Content script
// Intercepts link clicks, renders Shadow DOM popup, shows toasts

(() => {
  // ── Settings ──────────────────────────────────────────────────────────────
  // Click interception is gated by tier — only Pro / Team / Admin users get
  // automatic link-scan popups. Free / unauthenticated users are silently skipped.
  let cfg = { enabled: true, interceptClicks: true, allowlist: [], loggedIn: false, isPro: false };

  function loadCfg() {
    chrome.storage.sync.get({ enabled: true, interceptClicks: true, allowlist: "" }, (d) => {
      cfg.enabled         = d.enabled;
      cfg.interceptClicks = d.interceptClicks;
      cfg.allowlist       = d.allowlist ? d.allowlist.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    });
    chrome.storage.local.get(["xposelink_session"], (d) => {
      const s = d.xposelink_session || {};
      cfg.loggedIn = Boolean(s.loggedIn);
      cfg.isPro    = Boolean(s.isPro);
    });
  }
  loadCfg();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      if ("enabled"         in changes) cfg.enabled         = changes.enabled.newValue;
      if ("interceptClicks" in changes) cfg.interceptClicks = changes.interceptClicks.newValue;
      if ("allowlist"       in changes) cfg.allowlist       = changes.allowlist.newValue
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    }
    if (area === "local" && "xposelink_session" in changes) {
      const s = changes.xposelink_session.newValue || {};
      cfg.loggedIn = Boolean(s.loggedIn);
      cfg.isPro    = Boolean(s.isPro);
    }
  });

  // ── State ─────────────────────────────────────────────────────────────────
  let pendingClick = null;   // { href, time }
  let pendingTimer = null;
  let popupHost    = null;   // outer div attached to <html>
  let popupShadow  = null;   // ShadowRoot
  let popupCard    = null;   // the .lg-popup card element

  // ── Click interception (capturing phase) ──────────────────────────────────
  document.addEventListener("click", handleClick, true);

  function handleClick(e) {
    // Click interception is a Pro-tier feature. Free / signed-out users browse normally.
    if (!cfg.enabled || !cfg.interceptClicks || !cfg.loggedIn || !cfg.isPro) return;

    const link = e.target.closest("a");
    if (!link) return;

    const href = link.href;
    if (!href || href.startsWith("javascript:") || href === "") return;

    // Skip pure same-page anchor links
    try {
      const u = new URL(href);
      if (u.origin === location.origin && u.pathname === location.pathname && u.hash && !u.search) return;
    } catch { return; }

    // Skip allowlisted domains
    try {
      const host = new URL(href).hostname.toLowerCase().replace(/^www\./, "");
      const root = host.split(".").slice(-2).join(".");
      if (cfg.allowlist.some(d => host === d || host.endsWith(`.${d}`) || root === d)) return;
    } catch {}

    const now = Date.now();

    // ── Double-click → navigate directly ──────────────────────────────────
    if (pendingClick && pendingClick.href === href && now - pendingClick.time < 400) {
      clearTimeout(pendingTimer);
      pendingClick = null;
      pendingTimer = null;
      removePopup();
      navigateTo(href, link.target === "_blank" || e.ctrlKey || e.metaKey);
      return;
    }

    // ── First click → prevent and wait 300ms ──────────────────────────────
    e.preventDefault();
    e.stopPropagation();

    const openInNewTab = link.target === "_blank" || e.ctrlKey || e.metaKey;
    const rect = link.getBoundingClientRect();

    pendingClick = { href, time: now };
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingClick = null;
      pendingTimer = null;
      removePopup();
      showLoadingPopup(rect, href, openInNewTab);
      try {
        chrome.runtime.sendMessage({ type: "ANALYZE_URL", url: href }, (result) => {
          if (chrome.runtime.lastError) {
            updatePopup({ error: "Xposelink backend unavailable" }, href, openInNewTab);
            return;
          }
          updatePopup(result || { error: "No response from background" }, href, openInNewTab);
        });
      } catch {
        // Extension context invalidated (tab open before extension reload) — reload tab to fix
        updatePopup({ error: "Reload this page to re-activate Xposelink." }, href, openInNewTab);
      }
    }, 300);
  }

  // ── Messages from background ───────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SHOW_TOAST") showToast(msg.text, msg.subtext, msg.toastType);
    if (msg.type === "COPY_TEXT") {
      navigator.clipboard.writeText(msg.text).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = msg.text;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      });
    }
  });

  // ── Shadow DOM setup ───────────────────────────────────────────────────────
  function ensureHost() {
    if (popupHost) return;
    popupHost = document.createElement("div");
    popupHost.setAttribute("data-linkguard", "1");
    popupHost.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0;pointer-events:none;";
    document.documentElement.appendChild(popupHost);
    popupShadow = popupHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = SHADOW_CSS;
    popupShadow.appendChild(style);
  }

  // ── Loading popup ──────────────────────────────────────────────────────────
  function showLoadingPopup(rect, href, openInNewTab) {
    ensureHost();
    removeCard();

    popupCard = document.createElement("div");
    popupCard.className = "lg-popup";
    popupCard.innerHTML = `
      <div class="lg-header">
        <span class="lg-brand">X<span class="lg-brand-light">pose</span><span class="lg-brand-link">link</span></span>
        <button class="lg-close">✕</button>
      </div>
      <div class="lg-body">
        <div class="lg-label">🔗 Destination</div>
        <div class="lg-url lg-url--dim">${esc(trunc(href, 65))}</div>
        <div class="lg-loading">
          <div class="lg-spinner"></div>
          <span>Analyzing link…</span>
        </div>
      </div>`;

    placeCard(popupCard, rect);
    popupShadow.appendChild(popupCard);
    popupHost.style.pointerEvents = "auto";

    popupCard.querySelector(".lg-close").addEventListener("click", removePopup);
    document.addEventListener("keydown", onEscape);
    document.addEventListener("click", onOutsideClick, true);
  }

  // ── Result popup ───────────────────────────────────────────────────────────
  function updatePopup(result, href, openInNewTab) {
    if (!popupCard || !popupShadow.contains(popupCard)) return;

    const resolvedUrl  = result?.resolvedUrl || href;
    const virustotal   = result?.virustotal;
    const security     = result?.security;
    const heuristic    = result?.heuristic;
    const og           = result?.og;

    // Determine display values — priority: VT direct > backend security > local heuristic
    let ratingClass, ratingText, score, indicators;

    if (virustotal) {
      score       = virustotal.riskScore ?? 0;
      indicators  = virustotal.indicators ?? [];
      ratingClass = toRatingClass(virustotal.verdict, score);
      ratingText  = toRatingText(virustotal.verdict, null, score);

      // If backend also flagged adult/gambling content, surface that on top of VT verdict
      if (security?.verdict === "inappropriate") {
        ratingClass = "suspicious";
        ratingText  = security.category === "adult" ? "🟠 Adult Content" : "🟠 Gambling";
        indicators  = [...(security.indicators ?? []), ...indicators];
      }
    } else if (security) {
      score       = security.riskScore ?? 0;
      indicators  = security.indicators ?? [];
      ratingClass = toRatingClass(security.verdict, score);
      ratingText  = toRatingText(security.verdict, security.category, score);
    } else if (heuristic) {
      score       = heuristic.score ?? 50;
      indicators  = (heuristic.indicators || []).map(i => typeof i === "string" ? { type: "warn", text: i } : i);
      ratingClass = heuristic.rating === "dangerous" ? "dangerous" : heuristic.rating === "suspicious" ? "suspicious" : heuristic.rating === "caution" ? "caution" : "safe";
      ratingText  = { safe: "🟢 Safe", caution: "🟡 Caution", suspicious: "🟠 Suspicious", dangerous: "🔴 Dangerous" }[heuristic.rating] || "⚪ Unknown";
    } else {
      score = 50; ratingClass = "caution"; ratingText = "⚪ Unknown"; indicators = [];
    }

    const barColors = { safe: "#10b981", caution: "#f59e0b", suspicious: "#f97316", dangerous: "#ef4444" };
    const barColor  = barColors[ratingClass] || "#94a3b8";

    let hostname = "";
    try { hostname = new URL(resolvedUrl).hostname.replace(/^www\./, ""); } catch {}

    const sourceLabel = virustotal
      ? (security ? "VirusTotal + Xposelink" : "VirusTotal")
      : (security ? "VirusTotal + Heuristic" : "Local Heuristic");

    const resolvedBlock = resolvedUrl !== href ? `
      <div class="lg-resolved">↳ Resolves to: <span class="lg-resolved-url">${esc(trunc(resolvedUrl, 55))}</span></div>` : "";

    const faviconUrl = hostname ? `https://www.google.com/s2/favicons?domain=${esc(hostname)}&sz=16` : "";

    let ogBlock = "";
    if (og?.title || hostname) {
      ogBlock = `<div class="lg-og">
        ${og?.image ? `<img class="lg-og-banner" src="${esc(og.image)}" alt="" onerror="this.style.display='none'" />` : ""}
        ${hostname ? `<div class="lg-og-meta">
          ${faviconUrl ? `<img class="lg-og-favicon" src="${faviconUrl}" alt="" />` : ""}
          <span class="lg-og-domain">${esc(hostname)}</span>
        </div>` : ""}
        ${og?.title ? `<div class="lg-og-title">${esc(trunc(og.title, 70))}</div>` : ""}
        ${og?.description ? `<div class="lg-og-desc">${esc(trunc(og.description, 120))}</div>` : ""}
      </div>`;
    }

    const indHtml = indicators.slice(0, 6).map(ind => {
      const text = typeof ind === "string" ? ind : (ind.text || String(ind));
      const type = typeof ind === "object" ? (ind.type || "warn") : "warn";
      return `<span class="lg-ind lg-ind--${type}">${esc(text)}</span>`;
    }).join("");

    popupCard.innerHTML = `
      <div class="lg-header">
        <span class="lg-brand">X<span class="lg-brand-light">pose</span><span class="lg-brand-link">link</span></span>
        <button class="lg-close">✕</button>
      </div>
      <div class="lg-body">
        <div class="lg-label">🔗 Destination</div>
        <div class="lg-url">${esc(trunc(resolvedUrl, 65))}</div>
        ${resolvedBlock}
        ${ogBlock}
        <div class="lg-security-header">
          <span class="lg-label" style="margin:0">Security</span>
          <span class="lg-source">${esc(sourceLabel)}</span>
        </div>
        <div class="lg-rating-row">
          <span class="lg-rating lg-rating--${ratingClass}">${ratingText}</span>
          <span class="lg-score">${score}/100</span>
        </div>
        <div class="lg-bar-wrap"><div class="lg-bar" style="width:${score}%;background:${barColor}"></div></div>
        ${indHtml ? `<div class="lg-inds">${indHtml}</div>` : ""}
      </div>
      <div class="lg-footer">
        <button class="lg-btn lg-btn--cancel">Cancel</button>
        <button class="lg-btn lg-btn--go">Go to link →</button>
      </div>`;

    popupCard.querySelector(".lg-close").addEventListener("click", removePopup);
    popupCard.querySelector(".lg-btn--cancel").addEventListener("click", removePopup);
    popupCard.querySelector(".lg-btn--go").addEventListener("click", () => {
      removePopup();
      navigateTo(resolvedUrl, openInNewTab);
    });
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(text, subtext, type = "success") {
    ensureHost();
    popupShadow.querySelectorAll(".lg-toast").forEach(t => t.remove());

    const toast = document.createElement("div");
    toast.className = `lg-toast lg-toast--${type}`;
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;";
    toast.innerHTML = `
      <div class="lg-toast-text">${esc(text)}</div>
      ${subtext ? `<div class="lg-toast-sub">${esc(subtext)}</div>` : ""}`;

    popupShadow.appendChild(toast);
    popupHost.style.pointerEvents = "auto";

    setTimeout(() => {
      toast.classList.add("lg-toast--out");
      setTimeout(() => {
        toast.remove();
        if (!popupCard) popupHost.style.pointerEvents = "none";
      }, 300);
    }, 4000);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function placeCard(card, rect) {
    const W = window.innerWidth, H = window.innerHeight;
    const PW = 400, PH = 320;
    let top  = rect.bottom + 8;
    let left = rect.left;
    if (left + PW > W - 12) left = W - PW - 12;
    if (left < 12) left = 12;
    if (rect.bottom + PH + 12 > H) top = rect.top - PH - 8;
    card.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:400px;max-width:calc(100vw - 24px);`;
  }

  function removeCard() {
    if (popupCard && popupShadow?.contains(popupCard)) popupShadow.removeChild(popupCard);
    popupCard = null;
    if (popupHost) popupHost.style.pointerEvents = "none";
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("click", onOutsideClick, true);
  }

  function removePopup() {
    removeCard();
    clearTimeout(pendingTimer);
    pendingClick = null;
    pendingTimer = null;
  }

  function onEscape(e) { if (e.key === "Escape") removePopup(); }

  function onOutsideClick(e) {
    if (!popupCard) return;
    if (!e.composedPath().includes(popupHost)) removePopup();
  }

  function navigateTo(href, newTab) {
    if (newTab) window.open(href, "_blank", "noopener,noreferrer");
    else window.location.href = href;
  }

  function toRatingClass(verdict, score) {
    if (verdict === "malicious")     return "dangerous";
    if (verdict === "inappropriate") return "suspicious";
    if (verdict === "suspicious")    return "caution";
    if (verdict === "safe")          return score >= 70 ? "safe" : "caution";
    return "caution";
  }

  function toRatingText(verdict, category, score) {
    if (verdict === "malicious")     return "🔴 Malicious";
    if (verdict === "inappropriate") return category === "adult" ? "🟠 Adult Content" : "🟠 Gambling";
    if (verdict === "suspicious")    return "🟡 Suspicious";
    if (verdict === "safe")          return score >= 70 ? "🟢 Safe" : "🟡 Caution";
    return "⚪ Unknown";
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function trunc(str, len) {
    return str.length > len ? str.slice(0, len) + "…" : str;
  }

  // ── Shadow DOM CSS ─────────────────────────────────────────────────────────
  const SHADOW_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .lg-popup {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #e2e8f0;
      background: #1e293b;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.65), 0 4px 20px rgba(0,0,0,0.35);
      overflow: hidden;
      animation: fadein 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadein {
      from { opacity:0; transform:translateY(-12px) scale(0.95); }
      to   { opacity:1; transform:translateY(0)     scale(1);    }
    }

    .lg-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 11px 14px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .lg-brand { font-weight: 700; font-size: 15px; letter-spacing: -0.4px; }
    .lg-brand-light { font-weight: 300; font-size: 12px; letter-spacing: 0.1px; }
    .lg-brand-link  { font-weight: 300; font-size: 10px; letter-spacing: 0.1px; opacity: 0.7; }
    .lg-close {
      all: unset;
      cursor: pointer;
      width: 22px; height: 22px;
      background: rgba(255,255,255,0.07);
      border-radius: 50%;
      font-size: 10px;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.4);
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .lg-close:hover { background: rgba(255,255,255,0.14); color: #fff; }

    .lg-body {
      padding: 12px 14px;
      display: flex; flex-direction: column; gap: 8px;
      max-height: 58vh; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
    }

    .lg-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.28); }

    .lg-url { font-size: 12px; color: #94a3b8; word-break: break-all; font-family: "SF Mono","Fira Code",monospace; }
    .lg-url--dim { color: rgba(255,255,255,0.2); }

    .lg-resolved { font-size: 11px; color: rgba(255,255,255,0.3); }
    .lg-resolved-url { color: #60a5fa; }

    .lg-loading { display: flex; align-items: center; gap: 10px; padding: 8px 0; color: rgba(255,255,255,0.3); font-size: 12px; }
    .lg-spinner {
      width: 16px; height: 16px; flex-shrink: 0;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: #7c3aed;
      border-radius: 50%;
      animation: spin 0.65s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .lg-og {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      overflow: hidden;
    }
    .lg-og-banner {
      width: 100%; height: 140px;
      object-fit: cover; display: block;
      background: rgba(255,255,255,0.04);
    }
    .lg-og-meta {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px 3px;
    }
    .lg-og-favicon { width: 14px; height: 14px; flex-shrink: 0; border-radius: 2px; }
    .lg-og-domain  { font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.38); }
    .lg-og-title {
      font-size: 12px; font-weight: 600; color: #e2e8f0;
      padding: 0 10px 3px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .lg-og-desc {
      font-size: 11px; color: rgba(255,255,255,0.35);
      padding: 0 10px 10px;
      overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    .lg-security-header { display: flex; align-items: center; justify-content: space-between; }
    .lg-source { font-size: 10px; color: rgba(255,255,255,0.2); font-style: italic; }

    .lg-rating-row { display: flex; align-items: center; gap: 8px; }
    .lg-rating { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
    .lg-rating--safe       { background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.25); }
    .lg-rating--caution    { background: rgba(245,158,11,0.15);  color: #fcd34d; border: 1px solid rgba(245,158,11,0.25); }
    .lg-rating--suspicious { background: rgba(249,115,22,0.15);  color: #fdba74; border: 1px solid rgba(249,115,22,0.25); }
    .lg-rating--dangerous  { background: rgba(239,68,68,0.15);   color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }

    .lg-score { font-size: 11px; color: rgba(255,255,255,0.28); margin-left: auto; }

    .lg-bar-wrap { height: 3px; background: rgba(255,255,255,0.07); border-radius: 4px; overflow: hidden; }
    .lg-bar { height: 3px; border-radius: 4px; transition: width 0.4s ease; }

    .lg-inds { display: flex; flex-wrap: wrap; gap: 4px; }
    .lg-ind { font-size: 10px; padding: 2px 8px; border-radius: 20px; }
    .lg-ind--good { background: rgba(16,185,129,0.12); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
    .lg-ind--warn { background: rgba(245,158,11,0.1);  color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }
    .lg-ind--bad  { background: rgba(239,68,68,0.12);  color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }

    .lg-footer {
      display: flex; gap: 8px;
      padding: 10px 14px 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .lg-btn {
      all: unset;
      flex: 1;
      padding: 9px 12px;
      border-radius: 10px;
      font-size: 12px; font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: opacity 0.15s;
    }
    .lg-btn:hover { opacity: 0.82; }
    .lg-btn--cancel { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.5); }
    .lg-btn--go { background: linear-gradient(135deg, #7c3aed, #a78bfa); color: #fff; }

    /* Toast */
    .lg-toast {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1e293b;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 12px 16px;
      color: #e2e8f0;
      font-size: 13px;
      min-width: 220px;
      max-width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      animation: slidein 0.25s ease;
    }
    .lg-toast--error { border-color: rgba(239,68,68,0.3); }
    .lg-toast--out   { animation: slideout 0.25s ease forwards; }
    @keyframes slidein  { from { opacity:0; transform:translateX(20px); } to   { opacity:1; transform:translateX(0); } }
    @keyframes slideout { from { opacity:1; transform:translateX(0); }   to   { opacity:0; transform:translateX(20px); } }
    .lg-toast-text { font-weight: 600; }
    .lg-toast-sub  { font-size: 11px; color: rgba(255,255,255,0.38); margin-top: 2px; }
  `;

})();
