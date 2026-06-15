import { useState, useEffect } from "react";
import { apiFetch } from "../config";

/* ── Brand logo ── */
function XposeLogo({ size = "md", dark = false }) {
  const textColor = dark ? "text-gray-900" : "text-white";
  const sizes = {
    sm: { x: "text-2xl", rest: "text-xl"  },
    md: { x: "text-3xl", rest: "text-2xl" },
    lg: { x: "text-5xl", rest: "text-4xl" },
  };
  const s = sizes[size] || sizes.md;
  return (
    <span className={`font-sans tracking-tight ${textColor} select-none`}>
      <span className={`${s.x} font-semibold`}>X</span>
      <span className={`${s.rest} font-light`}>pose</span>
      <span className={`${s.rest} font-light`}>link</span>
    </span>
  );
}

/* ── Ambient blob ── */
function Blob({ style, delay = 0, size = 500, className = "" }) {
  return (
    <div
      className={`blob absolute rounded-full pointer-events-none ${className}`}
      style={{ width: size, height: size, animationDelay: `${delay}s`, ...style }}
    />
  );
}

/* ── Toast ── */
function Toast({ text, type }) {
  if (!text) return null;
  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium shadow-xl border backdrop-blur-sm ${
      type === "error"
        ? "bg-red-50/90 text-red-700 border-red-200"
        : "bg-green-50/90 text-green-700 border-green-200"
    }`}>
      <span>{type === "error" ? "✕" : "✓"}</span>
      {text}
    </div>
  );
}

/* ── Main component ── */
const GUEST_TOKEN_KEY = "xposelink_guest_tokens";
const GUEST_MAX       = 3;

function loadGuestTokens() {
  const raw = localStorage.getItem(GUEST_TOKEN_KEY);
  if (raw === null) return GUEST_MAX; // default until server sync
  return Math.max(0, parseInt(raw, 10) || 0);
}

function deductGuestToken(current) {
  const next = Math.max(0, current - 1);
  localStorage.setItem(GUEST_TOKEN_KEY, String(next));
  return next;
}

export default function LandingPage({ onLoginClick, onSignUpClick }) {
  const [guestTokens, setGuestTokens]     = useState(() => loadGuestTokens());
  const [busySection, setBusySection]     = useState("");
  const [shortenForm, setShortenForm]     = useState({ url: "" });
  const [shortenResult, setShortenResult] = useState(null);
  const [shortenSecurity, setShortenSecurity] = useState(null);
  const [unshortenUrl, setUnshortenUrl]   = useState("");
  const [unshortenResult, setUnshortenResult] = useState(null);
  const [unshortenSecurity, setUnshortenSecurity] = useState(null);
  const [toast, setToast]                 = useState({ text: "", type: "" });
  const [ripple, setRipple]               = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Probe /api/users/me with the HTTPOnly cookie to detect login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const outOfTokens = !isLoggedIn && guestTokens <= 0;

  useEffect(() => {
    apiFetch("/api/users/me")
      .then((r) => r.ok)
      .then((ok) => setIsLoggedIn(ok))
      .catch(() => {});
  }, []);

  /* Sync guest token count from server on mount so localStorage can never get stale */
  useEffect(() => {
    if (isLoggedIn) return; // logged-in users don't use guest quota
    apiFetch("/api/guest/quota")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.quota?.remaining != null) {
          const serverRemaining = data.quota.remaining;
          localStorage.setItem(GUEST_TOKEN_KEY, String(serverRemaining));
          setGuestTokens(serverRemaining);
        }
      })
      .catch(() => {}); // silent — localStorage value is the fallback
  }, [isLoggedIn]);

  /* ── URL typing animation ── */
  const BASE            = "https://";
  const SAFE_FULL       = "https://shortenurl.com";
  const MALICIOUS_FULL  = "https://malicious.web.com";
  const BRAND_TEXT      = "Xposelink";

  const [urlText, setUrlText] = useState("");
  const [urlPhase, setUrlPhase] = useState("typing_base");

  useEffect(() => {
    let timer;
    switch (urlPhase) {
      case "typing_base":
        if (urlText.length < BASE.length) {
          timer = setTimeout(() => setUrlText(BASE.slice(0, urlText.length + 1)), 85);
        } else {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setUrlPhase("typing_safe");
        }
        break;
      case "typing_safe":
        if (urlText.length < SAFE_FULL.length) {
          timer = setTimeout(() => setUrlText(SAFE_FULL.slice(0, urlText.length + 1)), 85);
        } else {
          timer = setTimeout(() => setUrlPhase("pause_safe"), 1600);
        }
        break;
      case "pause_safe":
        timer = setTimeout(() => setUrlPhase("deleting_to_base"), 1600);
        break;
      case "deleting_to_base":
        if (urlText.length > BASE.length) {
          timer = setTimeout(() => setUrlText(urlText.slice(0, -1)), 50);
        } else {
          timer = setTimeout(() => setUrlPhase("typing_malicious"), 420);
        }
        break;
      case "typing_malicious":
        if (urlText.length < MALICIOUS_FULL.length) {
          timer = setTimeout(() => setUrlText(MALICIOUS_FULL.slice(0, urlText.length + 1)), 85);
        } else {
          timer = setTimeout(() => setUrlPhase("pause_malicious"), 1600);
        }
        break;
      case "pause_malicious":
        timer = setTimeout(() => setUrlPhase("deleting_all"), 1600);
        break;
      case "deleting_all":
        if (urlText.length > 0) {
          timer = setTimeout(() => setUrlText(urlText.slice(0, -1)), 45);
        } else {
          timer = setTimeout(() => setUrlPhase("typing_brand"), 550);
        }
        break;
      case "typing_brand":
        if (urlText.length < BRAND_TEXT.length) {
          timer = setTimeout(() => setUrlText(BRAND_TEXT.slice(0, urlText.length + 1)), 100);
        } else {
          timer = setTimeout(() => setUrlPhase("pause_brand"), 2200);
        }
        break;
      case "pause_brand":
        timer = setTimeout(() => setUrlPhase("deleting_brand"), 2200);
        break;
      case "deleting_brand":
        if (urlText.length > 0) {
          timer = setTimeout(() => setUrlText(urlText.slice(0, -1)), 60);
        } else {
          timer = setTimeout(() => setUrlPhase("typing_base"), 600);
        }
        break;
      default: break;
    }
    return () => clearTimeout(timer);
  }, [urlText, urlPhase]);

  const isMaliciousPhase =
    urlPhase === "typing_malicious" ||
    urlPhase === "pause_malicious"  ||
    (urlPhase === "deleting_all" && urlText.length > BASE.length);

  const isBrandPhase =
    urlPhase === "typing_brand" ||
    urlPhase === "pause_brand"  ||
    urlPhase === "deleting_brand";

  const renderUrl = () => {
    if (isBrandPhase) {
      return <span className="gradient-text font-semibold">{urlText}</span>;
    }
    if (isMaliciousPhase) {
      const safe = urlText.slice(0, BASE.length);
      const danger = urlText.slice(BASE.length);
      return (
        <>
          <span className="text-white/70">{safe}</span>
          <span className="text-red-400">{danger}</span>
        </>
      );
    }
    return <span className="text-white/80">{urlText}</span>;
  };

  const statusLabel = isBrandPhase
    ? { text: "Protected by Xposelink", color: "text-blue-300" }
    : isMaliciousPhase
    ? { text: "Potentially dangerous, do not visit", color: "text-red-400" }
    : urlPhase === "deleting_all" && urlText.length === 0
    ? { text: "", color: "" }
    : { text: "Connection secure", color: "text-emerald-400" };

  const handleTryFree = () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 650);
    document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" });
  };

  const showToast = (text, type) => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "" }), 4000);
  };

  const handleShorten = async (e) => {
    e.preventDefault();
    if (outOfTokens) { showToast("No tokens left. Create a free account to continue.", "error"); return; }
    setBusySection("shorten");
    setShortenResult(null);
    setShortenSecurity(null);
    try {
      const res = await apiFetch("/api/links/shorten", {
        method: "POST",
        body: JSON.stringify({ url: shortenForm.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to shorten");
      setShortenResult(data.data);
      if (data.security) setShortenSecurity(data.security);
      if (!isLoggedIn) setGuestTokens((t) => deductGuestToken(t));
      showToast("Link shortened successfully", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusySection("");
    }
  };

  const handleUnshorten = async (e) => {
    e.preventDefault();
    if (outOfTokens) { showToast("No tokens left. Create a free account to continue.", "error"); return; }
    setBusySection("unshorten");
    setUnshortenResult(null);
    setUnshortenSecurity(null);
    try {
      const res = await apiFetch("/api/links/unshorten", {
        method: "POST",
        body: JSON.stringify({ shortUrl: unshortenUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to unshorten");
      setUnshortenResult(data.data);
      if (data.security) setUnshortenSecurity(data.security);
      if (!isLoggedIn) setGuestTokens((t) => deductGuestToken(t));
      showToast("URL resolved successfully", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusySection("");
    }
  };

  return (
    /*
     * Light canvas — single continuous gradient from top (post-hero) to footer.
     * Hero overrides with its own dark bg. All other sections are transparent
     * so the page gradient + their own blobs flow through seamlessly.
     */
    <div
      className="min-h-screen text-gray-900 flex flex-col overflow-x-hidden"
      style={{ background: "#ffffff" }}
    >

      {/* ═══════════════════════ HEADER ═══════════════════════ */}
      <header
        className="sticky top-0 z-50 w-full"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a2d5a 100%)" }}
      >
        {/* Equal spacing: logo left | nav centered | auth right */}
        <div className="w-full px-5 sm:px-10 py-5 flex items-center justify-between">

          <a href="#" className="shrink-0">
            <XposeLogo size="md" />
          </a>

          {/* Nav — centered, evenly spaced (desktop only) */}
          <nav className="hidden lg:flex items-center gap-14 absolute left-1/2 -translate-x-1/2">

            {/* Features dropdown */}
            <div className="dropdown-trigger relative">
              <button className="nav-link flex items-center gap-1.5 text-white/80 hover:text-white text-base font-medium bg-transparent border-none cursor-pointer py-1 transition-colors">
                Features
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="dropdown absolute top-full left-0 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 min-w-56 py-2 overflow-hidden">
                <a href="#tools" className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 no-underline font-medium group transition-colors">
                  <span className="w-8 h-8 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-base transition-colors">🔗</span>
                  Shorten Link
                </a>
                <a href="#tools" className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-600 no-underline font-medium group transition-colors">
                  <span className="w-8 h-8 rounded-xl bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center text-base transition-colors">🔍</span>
                  Unshorten Link
                </a>
              </div>
            </div>

            {/* Extensions — Pro only */}
            <a href="#extension" className="nav-link flex items-center gap-1.5 text-white/80 hover:text-white text-base font-medium no-underline py-1 transition-colors">
              Extensions
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(124,58,237,0.25)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.35)" }}>
                Pro
              </span>
            </a>

            <a href="#plans"   className="nav-link text-white/80 hover:text-white text-base font-medium no-underline py-1 transition-colors">Plans</a>
            <a href="#support" className="nav-link text-white/80 hover:text-white text-base font-medium no-underline py-1 transition-colors">Support</a>

          </nav>

          {/* Auth — desktop */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <button onClick={onLoginClick}
              className="text-white/80 hover:text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-white/10 border-none cursor-pointer bg-transparent transition-colors">
              Login
            </button>
            <button onClick={onSignUpClick}
              className="btn-shimmer text-white text-sm font-semibold px-5 py-2 rounded-xl border-none cursor-pointer">
              Sign up
            </button>
          </div>

          {/* Hamburger — mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            className="lg:hidden shrink-0 text-white/90 bg-transparent border-none cursor-pointer p-1"
          >
            {mobileMenuOpen ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-5 pb-5 flex flex-col gap-1 border-t border-white/10">
            <a href="#tools" onClick={() => setMobileMenuOpen(false)}
              className="text-white/80 hover:text-white text-base font-medium py-3 no-underline border-b border-white/5">Shorten / Unshorten</a>
            <a href="#extension" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-white/80 hover:text-white text-base font-medium py-3 no-underline border-b border-white/5">
              Extensions
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(124,58,237,0.25)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.35)" }}>Pro</span>
            </a>
            <a href="#plans" onClick={() => setMobileMenuOpen(false)}
              className="text-white/80 hover:text-white text-base font-medium py-3 no-underline border-b border-white/5">Plans</a>
            <a href="#support" onClick={() => setMobileMenuOpen(false)}
              className="text-white/80 hover:text-white text-base font-medium py-3 no-underline border-b border-white/5">Support</a>
            <div className="flex items-center gap-3 mt-3">
              <button onClick={() => { setMobileMenuOpen(false); onLoginClick(); }}
                className="flex-1 text-white/90 text-sm font-medium px-4 py-2.5 rounded-xl border border-white/15 cursor-pointer bg-transparent">
                Login
              </button>
              <button onClick={() => { setMobileMenuOpen(false); onSignUpClick(); }}
                className="btn-shimmer flex-1 text-white text-sm font-semibold px-5 py-2.5 rounded-xl border-none cursor-pointer">
                Sign up
              </button>
            </div>
          </div>
        )}
      </header>

      <Toast text={toast.text} type={toast.type} />

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      {/* overflow-visible — blobs bleed into tools below */}
      <section
        className="relative w-full flex flex-col items-center justify-center pt-20 pb-36 px-5 sm:px-10 z-10 overflow-visible"
        style={{
          background: `
            radial-gradient(ellipse 90% 60% at 20% 30%, rgba(66,133,244,0.18) 0%, transparent 65%),
            radial-gradient(ellipse 70% 50% at 80% 70%, rgba(124,58,237,0.15) 0%, transparent 65%),
            radial-gradient(ellipse 50% 40% at 60% 10%, rgba(6,182,212,0.10) 0%, transparent 60%),
            linear-gradient(160deg, #080d1a 0%, #0f172a 55%, #0c0a22 100%)
          `,
        }}
      >
        {/* Grid texture inside hero */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Blobs — overflow into tools section */}
        <Blob size={700} delay={0}  className="top-[-80px] right-[-120px]"
          style={{ background: "radial-gradient(circle, rgba(66,133,244,0.13) 0%, transparent 65%)" }} />
        <Blob size={600} delay={-3} className="bottom-[-220px] left-[-80px]"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.11) 0%, transparent 65%)" }} />
        <Blob size={450} delay={-6} className="top-[35%] left-[38%]"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 65%)" }} />

        {/* Static title */}
        <div className="animate-fade-up text-center w-full relative z-10">
          <h1 className="font-thin tracking-tight text-white/90 leading-[1.08] whitespace-nowrap"
            style={{ fontSize: "clamp(2rem, 7.8vw, 13rem)" }}>
            Shorten &amp; Reveal
          </h1>
          <h1 className="font-thin tracking-tight leading-[1.08] whitespace-nowrap"
            style={{ fontSize: "clamp(2rem, 7.8vw, 13rem)" }}>
            <span className="gradient-text font-light">Trust</span>
            <span className="text-white/90"> Every Link</span>
          </h1>
        </div>

        {/* URL demo — browser address bar */}
        <div className="animate-fade-up-delay-2 w-full max-w-4xl relative z-10 mt-7">
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: isMaliciousPhase ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.09)",
              backdropFilter: "blur(20px)",
              transition: "border-color 0.5s ease",
            }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 px-5 pt-2.5 pb-2 border-b border-white/[0.05]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
            </div>

            {/* Address bar */}
            <div className="px-5 py-3">
              <div
                className="flex items-center rounded-xl px-4 py-3 border"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderColor: isMaliciousPhase ? "rgba(248,113,113,0.20)" : "rgba(255,255,255,0.07)",
                  transition: "border-color 0.5s ease",
                }}
              >
                {/* Fixed-width status dot — never shifts the text */}
                <span
                  className="shrink-0 w-4 flex items-center justify-center mr-3"
                  style={{ transition: "color 0.4s ease" }}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{
                      background: isBrandPhase
                        ? "linear-gradient(135deg,#4285f4,#7c3aed)"
                        : isMaliciousPhase
                        ? "rgba(248,113,113,0.9)"
                        : "rgba(52,211,153,0.9)",
                      transition: "background 0.5s ease",
                    }}
                  />
                </span>

                {/* Typed URL — monospace so characters don't shift */}
                <span className="font-mono text-sm flex-1 min-w-0">
                  {renderUrl()}
                  <span className="typing-cursor text-white/40" />
                </span>
              </div>

              {/* Status label */}
              <p
                className={`font-mono text-xs mt-3 pl-1 transition-colors duration-500 ${statusLabel.color}`}
                style={{ minHeight: "1.1em" }}
              >
                {statusLabel.text}
              </p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="animate-fade-up-delay-2 mt-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 relative z-10 w-full sm:w-auto px-4 sm:px-0">
          <button onClick={handleTryFree}
            className="btn-shimmer relative overflow-hidden text-white px-8 py-3.5 rounded-2xl font-semibold text-sm border-none cursor-pointer active:scale-95 transition-transform w-full sm:w-auto">
            Try it free →
            {ripple && <span className="animate-ripple absolute inset-0 rounded-2xl bg-white/30 pointer-events-none" />}
            </button>
          <button onClick={onSignUpClick}
            className="btn-shimmer text-white px-8 py-3.5 rounded-2xl font-semibold text-sm border-none cursor-pointer active:scale-95 w-full sm:w-auto">
            Create account
            </button>
        </div>

        <p className="animate-fade-up-delay-2 mt-4 text-xs text-white/20 relative z-10">
          Free · No credit card required · 3 uses to start
        </p>


      </section>

      {/* ═══════════════════════ TOOLS ═══════════════════════ */}
      <section id="tools" className="relative w-full py-24 px-5 sm:px-10 overflow-visible"
        style={{
          background: "#ffffff",
          borderTopLeftRadius: "50% 36px",
          borderTopRightRadius: "50% 36px",
          marginTop: -38,
          position: "relative",
          zIndex: 20,
          scrollMarginTop: "-115px",
          paddingTop: "100px",
          paddingBottom: "300px"
        }}>

        {/* Blobs anchor into plans below */}
        <Blob size={520} delay={-2} className="bottom-[-180px] left-[-60px]"
          style={{ background: "radial-gradient(circle, rgba(66,133,244,0.035) 0%, transparent 65%)" }} />
        <Blob size={460} delay={-5} className="bottom-[-160px] right-[-40px]"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.03) 0%, transparent 65%)" }} />

        <div className="w-full relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-3">Core Features</p>
            <h2 className="text-3xl sm:text-5xl font-light text-gray-800 tracking-tight">Two tools, zero friction</h2>
            {/* Guest token badge — hidden when logged in */}
            {!isLoggedIn && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                {[...Array(GUEST_MAX)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                    style={{ background: i < guestTokens ? "#4285f4" : "#e5e7eb" }}
                  />
                ))}
                <span className="text-xs text-gray-400 ml-1">
                  {guestTokens > 0
                    ? `${guestTokens} free tr${guestTokens === 1 ? "y" : "ies"} remaining`
                    : "No tries left."}
                </span>
                {guestTokens <= 0 && (
                  <button
                    type="button"
                    onClick={onSignUpClick}
                    className="text-xs font-semibold text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0"
                  >
                    create a free account →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Exhausted overlay CTA */}
          {outOfTokens && (
            <div
              className="mb-8 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{ background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.18)" }}
            >
              <div>
                <p className="text-gray-800 font-semibold text-sm">You've used all 3 free tries</p>
                <p className="text-gray-400 text-xs mt-0.5">Sign up for free to keep using Shorten and Unshorten.</p>
              </div>
              <button
                type="button"
                onClick={onSignUpClick}
                className="btn-shimmer shrink-0 text-sm font-semibold text-white px-5 py-2.5 rounded-xl border-none cursor-pointer"
              >
                Create free account
            </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* ── Shorten ── */}
            <div className="tool-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100/80">
              <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #4285f4, transparent)" }} />
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-lg">🔗</div>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 leading-none">Shorten Link</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Turn long URLs into clean short links</p>
                  </div>
                </div>

                <form onSubmit={handleShorten} className="flex flex-col gap-3">
                  <input type="url"
                    placeholder="https://very-long-url.com/example"
                    value={shortenForm.url}
                    onChange={(e) => setShortenForm({ ...shortenForm, url: e.target.value })}
                    required
                    className="xp-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400"
                  />
                  <button type="submit" disabled={busySection === "shorten" || outOfTokens}
                    className={`w-full text-white py-3 rounded-xl font-semibold text-sm border-none cursor-pointer transition-all disabled:cursor-not-allowed ${outOfTokens || busySection === "shorten" ? "" : "btn-shimmer"}`}
                    style={outOfTokens || busySection === "shorten" ? { background: "#9ca3af" } : {}}>
                    {busySection === "shorten" ? "Shortening..." : outOfTokens ? "No tries left" : "Shorten Link"}
                  </button>
                </form>

                {shortenResult && (
                  <div className="mt-5 rounded-2xl border border-gray-100 overflow-hidden">

                    {/* Security verdict banner */}
                    {shortenSecurity && (
                      <div className={`px-4 py-2.5 flex items-center gap-2 ${
                        shortenSecurity.verdict === "malicious"
                          ? "bg-red-50 border-b border-red-100"
                          : "bg-emerald-50 border-b border-emerald-100"
                      }`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          shortenSecurity.verdict === "malicious" ? "bg-red-400" : "bg-emerald-400"
                        }`} />
                        <span className={`text-xs font-semibold uppercase tracking-widest ${
                          shortenSecurity.verdict === "malicious" ? "text-red-600" : "text-emerald-600"
                        }`}>
                          {shortenSecurity.verdict === "malicious" ? "Dangerous URL" : "Safe URL"}
                        </span>
                        <span className="ml-auto text-[10px] font-medium text-gray-400">
                          Risk score: {shortenSecurity.riskScore}/100
                        </span>
                      </div>
                    )}

                    <div className="p-4 bg-white">
                      {/* Original URL */}
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Original URL</p>
                      <p className="text-xs text-gray-500 mb-3 font-mono leading-relaxed"
                        style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                        {shortenResult.originalUrl}
                      </p>

                      {/* Short URL */}
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Short link</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(shortenResult.shortUrl).then(() => showToast("Copied!", "success"))}
                          className="shrink-0 text-[10px] font-semibold text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-colors"
                        >
                          Copy
            </button>
                      </div>
                      <a href={shortenResult.shortUrl} target="_blank" rel="noreferrer"
                        className="block text-blue-600 font-semibold text-sm hover:underline no-underline mb-1"
                        style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                        {shortenResult.shortUrl}
                      </a>

                      {/* Risk score bar */}
                      {shortenSecurity && (
                        <div className="mt-3">
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                shortenSecurity.verdict === "malicious" ? "bg-red-400" : "bg-emerald-400"
                              }`}
                              style={{ width: `${shortenSecurity.riskScore}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Threat indicators */}
                      {shortenSecurity?.indicators?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5">Threat indicators</p>
                          {shortenSecurity.indicators.map((ind, i) => (
                            <p key={i} className="text-[11px] text-red-500 flex items-start gap-1.5">
                              <span className="shrink-0 mt-0.5">·</span>{ind}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Unshorten ── */}
            <div className="tool-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100/80">
              <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #7c3aed, transparent)" }} />
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center text-lg">🔍</div>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 leading-none">Unshorten Link</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Reveal the real URL behind a short link</p>
                  </div>
                </div>

                <form onSubmit={handleUnshorten} className="flex flex-col gap-3">
                  <input type="text"
                    placeholder="https://bit.ly/abc123"
                    value={unshortenUrl}
                    onChange={(e) => setUnshortenUrl(e.target.value)}
                    required
                    className="xp-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400"
                  />
                  <button type="submit" disabled={busySection === "unshorten" || outOfTokens}
                    className={`w-full text-white py-3 rounded-xl font-semibold text-sm border-none cursor-pointer transition-all disabled:cursor-not-allowed ${outOfTokens || busySection === "unshorten" ? "" : "btn-shimmer"}`}
                    style={outOfTokens || busySection === "unshorten" ? { background: "#9ca3af" } : {}}>
                    {busySection === "unshorten" ? "Resolving..." : outOfTokens ? "No tries left" : "Reveal Original URL"}
            </button>
                </form>

                {unshortenResult && (
                  <div className="mt-5 rounded-2xl border border-gray-100 overflow-hidden">

                    {/* Security verdict banner */}
                    {unshortenSecurity && (
                      <div className={`px-4 py-2.5 flex items-center gap-2 ${
                        unshortenSecurity.verdict === "malicious"
                          ? "bg-red-50 border-b border-red-100"
                          : "bg-emerald-50 border-b border-emerald-100"
                      }`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          unshortenSecurity.verdict === "malicious" ? "bg-red-400" : "bg-emerald-400"
                        }`} />
                        <span className={`text-xs font-semibold uppercase tracking-widest ${
                          unshortenSecurity.verdict === "malicious" ? "text-red-600" : "text-emerald-600"
                        }`}>
                          {unshortenSecurity.verdict === "malicious" ? "Dangerous destination" : "Safe destination"}
                        </span>
                        <span className="ml-auto text-[10px] font-medium text-gray-400">
                          Risk score: {unshortenSecurity.riskScore}/100
                        </span>
                      </div>
                    )}

                    <div className="p-4 bg-white">
                      {/* Real destination */}
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Real destination</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(unshortenResult.originalUrl).then(() => showToast("Copied!", "success"))}
                          className="shrink-0 text-[10px] font-semibold text-violet-500 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-colors"
                        >
                          Copy
            </button>
                      </div>
                      <a href={unshortenResult.originalUrl} target="_blank" rel="noreferrer"
                        className="block text-violet-700 font-medium text-xs break-all hover:underline no-underline leading-relaxed mb-3"
                        style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                        {unshortenResult.originalUrl}
                      </a>

                      {/* Risk score bar */}
                      {unshortenSecurity && (
                        <div className="mb-3">
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                unshortenSecurity.verdict === "malicious" ? "bg-red-400" : "bg-emerald-400"
                              }`}
                              style={{ width: `${unshortenSecurity.riskScore}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Redirect chain */}
                      {unshortenResult.redirectChain?.length > 1 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Redirect path</p>
                          {unshortenResult.redirectChain.map((url, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 mb-1">
                              <span className="text-[10px] text-gray-300 mt-0.5 shrink-0">{idx + 1}</span>
                              <span className="text-[11px] text-gray-400 font-mono break-all">{url}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Threat indicators */}
                      {unshortenSecurity?.indicators?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5">Threat indicators</p>
                          {unshortenSecurity.indicators.map((ind, i) => (
                            <p key={i} className="text-[11px] text-red-500 flex items-start gap-1.5">
                              <span className="shrink-0 mt-0.5">·</span>{ind}
                            </p>
                          ))}
                        </div>
                      )}

                      <p className="text-[10px] text-gray-300 mt-2">
                        via {unshortenResult.source}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-gray-400 text-sm mt-12">
            Want unlimited access and custom aliases?{" "}
            <button onClick={onSignUpClick}
              className="gradient-text font-semibold hover:underline bg-transparent border-none cursor-pointer">
              Create a free account →
            </button>
          </p>
        </div>
      </section>

      {/* ═══════════════════════ EXTENSION ═══════════════════════ */}
      <section id="extension" className="relative flex flex-col items-center px-5 sm:px-10 text-center z-10 overflow-visible" style={{ background: "#ffffff", minHeight: "calc(100vh - 72px)", paddingTop: "10px", paddingBottom: "200px", scrollMarginTop: "20px" }}>
        <Blob size={580} delay={-4} className="top-[-150px] right-[5%]"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.04) 0%, transparent 65%)" }} />
        <Blob size={460} delay={-1} className="top-[-80px] left-[15%]"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.03) 0%, transparent 65%)" }} />
        <Blob size={440} delay={-6} className="bottom-[-160px] right-[25%]"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 65%)" }} />

        <div className="relative z-10 w-full max-w-5xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6"
            style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
            Pro
          </span>
          <h2 className="text-3xl sm:text-5xl font-light text-gray-800 mb-12 tracking-tight">Browser Extension</h2>
          <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 mb-8">
            <img
              src="/image1.png"
              alt="Xposelink extension popup"
              className="rounded-2xl shadow-lg object-cover w-full md:w-[45%] md:max-w-[600px]"
              style={{ border: "1px solid rgba(0,0,0,0.07)" }}
            />
            <img
              src="/image2.png"
              alt="Xposelink extension in action"
              className="rounded-2xl shadow-lg object-cover w-full md:w-[45%] md:max-w-[600px]"
              style={{ border: "1px solid rgba(0,0,0,0.07)" }}
            />
          </div>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed text-base sm:text-xl mt-10">
            Know before you click. Xposelink scans every link in real time, detecting malware, phishing, and unsafe content before you ever land on the page.{" "}
            <a href="#plans" className="text-violet-500 font-medium underline underline-offset-2 hover:text-violet-600 transition-colors cursor-pointer">Available on Pro and above.</a>
          </p>
        </div>
      </section>

      {/* ═══════════════════════ PLANS ═══════════════════════ */}
      <section id="plans" className="relative flex flex-col items-center px-6 text-center z-10 overflow-visible" style={{ background: "#ffffff", minHeight: "calc(100vh - 72px)", paddingTop: "60px", paddingBottom: "180px", scrollMarginTop: "-60px"}}>
        <Blob size={600} delay={-2} className="top-[-140px] left-[5%]"
          style={{ background: "radial-gradient(circle, rgba(66,133,244,0.04) 0%, transparent 65%)" }} />
        <Blob size={500} delay={-7} className="top-[-100px] right-[10%]"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.035) 0%, transparent 65%)" }} />
        <Blob size={480} delay={-4} className="bottom-[-160px] left-[30%]"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 65%)" }} />

        <div className="relative z-10 w-full">
          <h2 className="text-3xl sm:text-5xl font-light text-gray-800 mb-4 tracking-tight">Simple, transparent pricing</h2>
          <p className="text-gray-400 max-w-md mx-auto leading-relaxed mb-8">Upgrade anytime for unlimited access and Pro features.</p>

          <div className="flex flex-col md:flex-row justify-center items-stretch gap-6 max-w-4xl mx-auto">

            {/* Free — blue */}
            <div className="tool-card flex-1 rounded-2xl shadow-sm p-8 flex flex-col text-left"
              style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", border: "1px solid rgba(66,133,244,0.25)" }}>
              <span className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#4285f4" }}>Free</span>
              <div className="mb-1">
                <span className="text-4xl font-semibold text-gray-800">Rp 0</span>
                <span className="text-gray-400 text-sm ml-1">/ month</span>
              </div>
              <p className="text-gray-500 text-sm mb-6">Try the basics, no credit card required.</p>
              <ul className="flex flex-col gap-3 mb-8 text-sm text-gray-600">
                {[
                  "10 tokens / month (shorten, unshorten & security)",
                  "Standard short links only",
                  "No custom alias",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: "rgba(66,133,244,0.15)", color: "#4285f4" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onSignUpClick}
                className="mt-auto w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, #4285f4, #60a5fa)", color: "#fff", border: "none", cursor: "pointer" }}
              >
                Get started free
            </button>
            </div>

            {/* Pro — violet */}
            <div
              className="tool-card flex-1 rounded-2xl p-8 flex flex-col text-left relative overflow-hidden shadow-sm"
              style={{
                background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                border: "1px solid rgba(124,58,237,0.25)",
              }}
            >
              <span
                className="absolute top-5 right-5 text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)" }}
              >
                Most popular
              </span>

              <span className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#7c3aed" }}>Pro</span>
              <div className="mb-1">
                <span className="text-4xl font-semibold text-gray-800">Rp 40k</span>
                <span className="text-gray-400 text-sm ml-1">/ month</span>
              </div>
              <p className="text-gray-500 text-sm mb-6">More tokens and Pro-only features.</p>
              <ul className="flex flex-col gap-3 mb-8 text-sm text-gray-600">
                {[
                  "50 tokens / month (shorten + unshorten)",
                  "Unlimited security checks",
                  "Custom alias for your links",
                  "Pro browser extension",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: "rgba(124,58,237,0.15)", color: "#7c3aed" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onSignUpClick}
                className="mt-auto w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.25)" }}
              >
                Get Pro
            </button>
            </div>

            {/* Team — teal */}
            <div className="tool-card flex-1 rounded-2xl p-8 flex flex-col text-left relative overflow-hidden shadow-sm"
              style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)", border: "1px solid rgba(20,184,166,0.25)" }}>
              <span className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#0d9488" }}>Team</span>
              <div className="mb-1">
                <span className="text-4xl font-semibold text-gray-800">Rp 80k</span>
                <span className="text-gray-400 text-sm ml-1">/ month</span>
              </div>
              <p className="text-gray-500 text-sm mb-6">Highest quota for heavy users.</p>
              <ul className="flex flex-col gap-3 mb-8 text-sm text-gray-600">
                {[
                  "100 tokens / month (shorten + unshorten)",
                  "Everything in Pro",
                  "Higher monthly limit for busy workflows",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: "rgba(20,184,166,0.15)", color: "#0d9488" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onSignUpClick}
                className="mt-auto w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, #0d9488, #2dd4bf)", border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(20,184,166,0.25)" }}
              >
                Get Team
            </button>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════ Support ═══════════════════════ */}
      <section id="support" className="relative w-full px-5 sm:px-10 z-10" style={{ background: "#ffffff", paddingTop: "110px", paddingBottom: "80px", scrollMarginTop: "-135px" }}>
        <Blob size={560} delay={-3} className="top-[-140px] left-[20%]" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 65%)" }} />
        <Blob size={420} delay={-6} className="top-[-80px] right-[8%]" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.03) 0%, transparent 65%)" }} />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-3">Help Center</p>
            <h2 className="text-3xl sm:text-5xl font-light text-gray-800 tracking-tight">Got questions?</h2>
            <p className="text-gray-400 mt-4 max-w-md mx-auto leading-relaxed">Quick answers about Xposelink features and plans.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { emoji: "🎟️", q: "How many free uses do I get?", a: "A free account gets 10 tokens per month, shared between shortening and security checks. Unshorten is always free." },
              { emoji: "✏️", q: "What is a custom alias?", a: "Pro and Team users can set a custom short code, e.g. turning a long URL into xposelink.com/my-event." },
              { emoji: "🛡️", q: "How does the security check work?", a: "We cross-check every URL against VirusTotal (90+ engines), PhishTank / OpenPhish community phishing feeds, and our own heuristic engine for adult and gambling content. A match in any source raises the risk score." },
              { emoji: "🧩", q: "How do I install the extension?", a: "The extension requires a Pro or Team plan. Load it unpacked in Chrome (chrome://extensions → Load unpacked) or any Chromium browser." },
              { emoji: "💳", q: "How do I change my plan?", a: "Open the Dashboard and click your plan badge to upgrade. Changes take effect immediately." },
              { emoji: "🔗", q: "Can I track my short link clicks?", a: "Yes — open My Links in the Dashboard to see click counts, top countries, devices, and a 30-day chart per link." },
            ].map(({ emoji, q, a }) => (
              <div key={q} className="rounded-2xl p-6 border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl mb-3">{emoji}</div>
                <p className="text-gray-800 font-semibold text-sm mb-2">{q}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-5"
            style={{ background: "#f8faff", border: "1px solid rgba(66,133,244,0.15)" }}>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center text-xl flex-shrink-0">
                🎫
              </div>
              <div>
                <p className="text-gray-800 font-semibold text-sm">Still need help?</p>
                <p className="text-gray-400 text-xs mt-0.5">Log in to submit a support ticket. Our team responds within 24h.</p>
              </div>
            </div>
            <div className="flex gap-2.5 shrink-0">
              <button type="button" onClick={onLoginClick}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 cursor-pointer transition-colors">
                Log in
            </button>
              <button type="button" onClick={onSignUpClick}
                className="btn-shimmer px-5 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer">
                Create account
            </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer
        className="w-full py-5 px-5 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 z-10"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a2d5a 100%)" }}
      >
        <XposeLogo size="sm" />
        <p className="text-white/30 text-xs text-center order-last sm:order-none">© {new Date().getFullYear()} Xposelink. All rights reserved.</p>
        <div className="flex items-center gap-5">
          {/* Instagram */}
          <a href="https://instagram.com" target="_blank" rel="noreferrer"
            className="text-white/40 hover:text-white/70 transition-colors" aria-label="Instagram">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
            </svg>
          </a>
          {/* Facebook */}
          <a href="https://facebook.com" target="_blank" rel="noreferrer"
            className="text-white/40 hover:text-white/70 transition-colors" aria-label="Facebook">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
          </a>
          {/* GitHub */}
          <a href="https://github.com/cipaimian/Xposelink" target="_blank" rel="noreferrer"
            className="text-white/40 hover:text-white/70 transition-colors" aria-label="GitHub">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
          </a>
        </div>
      </footer>

    </div>
  );
}
