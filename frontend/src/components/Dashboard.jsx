import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { API_BASE_URL } from "../config";

/* ── Icons (inline SVG) ── */
const Icon = {
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  link: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  unlink: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  zap: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  history: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14"/>
      <path d="M3.05 11a9 9 0 1 0 .5-4.5"/>
      <polyline points="3 3 3 9 9 9"/>
    </svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
      <circle cx="19" cy="19" r="3"/><line x1="19" y1="16" x2="19" y2="22"/><line x1="16" y1="19" x2="22" y2="19"/>
    </svg>
  ),
  list: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  chart: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  support: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  qr: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
      <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/><line x1="14" y1="14" x2="14" y2="14"/><line x1="17" y1="14" x2="17" y2="14"/><line x1="20" y1="14" x2="20" y2="14"/><line x1="14" y1="17" x2="14" y2="17"/><line x1="17" y1="17" x2="20" y2="20"/>
    </svg>
  ),
};

/* ── Logo ── */
function XposeLogo() {
  return (
    <span className="font-sans tracking-tight text-white select-none">
      <span className="text-2xl font-semibold">X</span>
      <span className="text-xl font-light">pose</span>
      <span className="text-xl font-light">link</span>
    </span>
  );
}

/* ── Nav items ── */
const NAV = [
  { id: "home",      label: "Home",           icon: Icon.home    },
  { id: "shorten",   label: "Shorten",        icon: Icon.link    },
  { id: "unshorten", label: "Unshorten",      icon: Icon.unlink  },
  { id: "security",  label: "Security Check", icon: Icon.shield  },
  { id: "mylinks",   label: "My Links",       icon: Icon.list    },
  { id: "history",   label: "History",        icon: Icon.history  },
  { id: "support",   label: "Support",        icon: Icon.support  },
  { id: "settings",  label: "Settings",       icon: Icon.settings },
];

/* ── Shared styles ── */
const card = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  padding: 24,
};

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 14,
  color: "#fff",
  outline: "none",
};

const resultCard = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 18,
  marginTop: 18,
};

/* ── Toast ── */
function Toast({ toast }) {
  if (!toast.text) return null;
  return (
    <div
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-xl flex items-center gap-2"
      style={{
        background: toast.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
        border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
        color: toast.type === "error" ? "#fca5a5" : "#6ee7b7",
        backdropFilter: "blur(12px)",
      }}
    >
      <span>{toast.type === "error" ? "✕" : "✓"}</span>
      {toast.text}
    </div>
  );
}

/* ── Plan selection modal ── */
const PLAN_CARDS = [
  {
    id: "free",
    label: "Free",
    price: "Rp 0",
    desc: "Try the basics, no credit card required.",
    accent: "#4285f4",
    bg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    border: "rgba(66,133,244,0.3)",
    checkBg: "rgba(66,133,244,0.15)",
    btnBg: "linear-gradient(135deg, #4285f4, #60a5fa)",
    features: ["10 tokens / month (shorten, unshorten + security)", "Standard short links only", "No custom alias"],
  },
  {
    id: "pro",
    label: "Pro",
    price: "Rp 40.000",
    desc: "Unlimited access for power users.",
    accent: "#7c3aed",
    bg: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
    border: "rgba(124,58,237,0.3)",
    checkBg: "rgba(124,58,237,0.15)",
    btnBg: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    btnShadow: "0 4px 20px rgba(124,58,237,0.25)",
    popular: true,
    features: ["50 tokens / month (shorten + unshorten)", "Unlimited security checks", "Custom alias for your links", "Pro browser extension"],
  },
  {
    id: "team",
    label: "Team",
    price: "Rp 80.000",
    desc: "For teams that need shared access.",
    accent: "#0d9488",
    bg: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
    border: "rgba(20,184,166,0.3)",
    checkBg: "rgba(20,184,166,0.15)",
    btnBg: "linear-gradient(135deg, #0d9488, #2dd4bf)",
    btnShadow: "0 4px 20px rgba(20,184,166,0.25)",
    features: ["100 tokens / month (shorten + unshorten)", "Everything in Pro", "Higher monthly limit for busy workflows"],
  },
];

const TIER_RANK = { free: 0, pro: 1, team: 2, admin: 3 };

function PlanModal({ currentTier, onSelect, onDowngrade, onClose, busy }) {
  const [mounted, setMounted] = useState(false);

  // Trigger entrance animation one frame after mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Play exit animation then unmount
  const handleClose = () => {
    setMounted(false);
    setTimeout(onClose, 260);
  };

  const backdropStyle = {
    background: mounted ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    transition: "background 0.25s ease",
  };
  const headerStyle = {
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0px)" : "translateY(-14px)",
    transition: "opacity 0.28s ease, transform 0.28s ease",
  };
  const cardsStyle = {
    opacity: mounted ? 1 : 0,
    transform: mounted ? "scale(1) translateY(0px)" : "scale(0.94) translateY(20px)",
    transition: "opacity 0.30s ease 0.06s, transform 0.30s ease 0.06s",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 gap-6"
      style={backdropStyle}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between w-full max-w-5xl px-1" style={headerStyle}>
        <div>
          <p className="text-white text-xl font-semibold leading-tight">Choose a plan</p>
          <p className="text-white/40 text-sm mt-0.5">Changes apply immediately.</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-5xl" style={cardsStyle}>
        {PLAN_CARDS.map((plan) => {
          const isCurrent = currentTier === plan.id || (currentTier === "subscribed" && plan.id === "pro");
          const isLocked = (TIER_RANK[plan.id] ?? 0) < (TIER_RANK[currentTier] ?? 0);
          return (
            <div
              key={plan.id}
              className="rounded-2xl p-8 flex flex-col relative shadow-2xl"
              style={{ background: plan.bg, border: `1px solid ${plan.border}` }}
            >
              {plan.popular && (
                <span className="absolute top-5 right-5 text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)" }}>
                  Popular
                </span>
              )}
              <span className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: plan.accent }}>{plan.label}</span>
              <div className="mb-2">
                <span className="font-bold text-gray-800" style={{ fontSize: "2rem", lineHeight: 1.1 }}>{plan.price}</span>
                <span className="text-gray-400 text-sm ml-2">/ month</span>
              </div>
              <p className="text-gray-500 text-sm mb-5 leading-relaxed">{plan.desc}</p>
              <ul className="flex flex-col gap-3 mb-7 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: plan.checkBg, color: plan.accent, fontSize: 11 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="w-full rounded-xl py-3.5 text-center text-sm font-semibold"
                  style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,0,0,0.08)" }}>
                  Current plan
                </div>
              ) : isLocked ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDowngrade(plan.id)}
                  className="w-full rounded-xl py-2.5 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.4)", border: "1px dashed rgba(0,0,0,0.18)", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? "Processing..." : "🔒 Downgrade (mock/dev only)"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(plan.id)}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: plan.btnBg, border: "none", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, boxShadow: plan.btnShadow }}
                >
                  {busy ? "Processing..." : "Upgrade Now"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Chart: two-line date tick  "04 / Apr" ── */
function ChartDateTick({ x, y, payload }) {
  const parts = String(payload?.value ?? "").slice(5).split("-"); // "YYYY-MM-DD" → ["MM","DD"]
  const day   = parts[1] ?? "";
  const month = parts[0] ? new Date(`2000-${parts[0]}-01`).toLocaleString("en", { month: "short" }) : "";
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={9}>
        <tspan x="0" dy="0.8em">{day}</tspan>
        <tspan x="0" dy="1.3em">{month}</tspan>
      </text>
    </g>
  );
}

/* ── Per-user activity stats (server-side) ── */
const EMPTY_STATS = { shorten: 0, unshorten: 0, security: 0, malicious: 0 };

export default function Dashboard({ currentUser, onLogout }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activePage, setActivePage] = useState("home");
  const [busySection, setBusySection] = useState("");
  const [toast, setToast] = useState({ text: "", type: "" });
  const [quota, setQuota] = useState(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [history, setHistory] = useState([]);
  const [chartDays, setChartDays] = useState(14);
  const [hiddenLines, setHiddenLines] = useState(new Set());
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [shortenForm, setShortenForm] = useState({ url: "", customAlias: "" });
  const [shortenResult, setShortenResult] = useState(null);
  const [unshortenUrl, setUnshortenUrl] = useState("");
  const [unshortenResult, setUnshortenResult] = useState(null);
  const [securityUrl, setSecurityUrl] = useState("");
  const [securityResult, setSecurityResult] = useState(null);
  const [myLinks, setMyLinks] = useState([]);
  const [myLinksSearch, setMyLinksSearch] = useState("");
  const [myLinksLoading, setMyLinksLoading] = useState(false);

  // Admin state
  const [adminTab, setAdminTab] = useState("users");
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLinks, setAdminLinks] = useState([]);
  const [adminTxs, setAdminTxs] = useState([]);
  const [adminTickets, setAdminTickets] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [replyForm, setReplyForm] = useState({ ticketId: null, text: "" });
  const [replyBusy, setReplyBusy] = useState(false);

  // Link edit modal
  const [editModal, setEditModal] = useState(null); // { id, originalUrl, shortUrl }
  const [editForm, setEditForm] = useState({ originalUrl: "" });
  const [editBusy, setEditBusy] = useState(false);

  // Link analytics modal
  const [analyticsModal, setAnalyticsModal] = useState(null); // analytics data

  // QR code modal
  const [qrModal, setQrModal] = useState(null); // { shortUrl, shortCode }
  const qrRef = useRef(null);

  // Support / tickets
  const [supportForm, setSupportForm] = useState({ subject: "", message: "", email: "" });
  const [supportBusy, setSupportBusy] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Settings
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");


  const fetchStats = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/stats`, { credentials: "include" });
    const payload = await res.json();
    if (res.ok) setStats({ ...EMPTY_STATS, ...payload.stats });
  }, [currentUser.id]);

  const fetchHistory = useCallback(async (days) => {
    const d = days ?? chartDays;
    const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/stats/history?days=${d}`, { credentials: "include" });
    const payload = await res.json();
    if (res.ok) setHistory(payload.history ?? []);
  }, [currentUser.id, chartDays]);

  const fetchMyLinks = useCallback(async (search = "") => {
    setMyLinksLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${API_BASE_URL}/api/links/my-links${q}`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (res.ok) setMyLinks(payload.data ?? []);
    } finally {
      setMyLinksLoading(false);
    }
  }, []);

  const fetchAdminUsers = useCallback(async (search = "") => {
    setAdminLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${API_BASE_URL}/api/admin/users${q}`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (res.ok) setAdminUsers(payload.items ?? []);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const fetchAdminLinks = useCallback(async (search = "") => {
    setAdminLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${API_BASE_URL}/api/admin/links${q}`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (res.ok) setAdminLinks(payload.items ?? []);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const fetchAdminTxs = useCallback(async () => {
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/transactions`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (res.ok) setAdminTxs(payload.items ?? []);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const fetchAdminTickets = useCallback(async () => {
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/tickets`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (res.ok) setAdminTickets(payload.items ?? []);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const fetchMyTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/my-tickets`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (res.ok) setMyTickets(payload.tickets ?? []);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const authHeaders = { "Content-Type": "application/json" };

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "" }), 3500);
  };

  const fetchQuota = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/quota`, { credentials: "include" });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || "Failed to load quota");
    setQuota(payload.quota);
  }, [currentUser.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQuota().catch((e) => showToast(e.message, "error"));
    fetchStats().catch(() => {});
    fetchHistory().catch(() => {});
  }, [fetchQuota, fetchStats, fetchHistory]);

  // Re-fetch history when chart range changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory(chartDays).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartDays]);

  useEffect(() => {
    if (activePage === "mylinks") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchMyLinks(myLinksSearch).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  useEffect(() => {
    if (activePage === "admin") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAdminUsers(adminSearch).catch(() => {});
      fetchAdminLinks(adminSearch).catch(() => {});
      fetchAdminTxs().catch(() => {});
      fetchAdminTickets().catch(() => {});
    }
    if (activePage === "support") {
      fetchMyTickets().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  // Handle return from Midtrans Checkout (?checkout=success&plan=pro)
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const plan = searchParams.get("plan");
    if (checkout === "success" && plan) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast(`Payment successful! Plan upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)}.`);
      fetchQuota().catch(() => {});
      // Clean URL
      setSearchParams({}, { replace: true });
    } else if (checkout === "cancelled") {
      showToast("Checkout cancelled. No charge made.", "error");
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Actions ── */
  const handleShorten = async (e) => {
    e.preventDefault();
    setBusySection("shorten");
    setShortenResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/links/shorten`, {
        method: "POST", headers: authHeaders, credentials: "include",
        body: JSON.stringify({
          url: shortenForm.url,
          customAlias: shortenForm.customAlias,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to shorten URL");
      setShortenResult(payload.data);
      setQuota(payload.quota);
      setShortenForm({ url: "", customAlias: "" });
      showToast("Short link created!");
      fetchStats().catch(() => {}); fetchHistory().catch(() => {}); fetchMyLinks().catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
    finally { setBusySection(""); }
  };

  const handleUnshorten = async (e) => {
    e.preventDefault();
    setBusySection("unshorten");
    setUnshortenResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/links/unshorten`, {
        method: "POST", headers: authHeaders, credentials: "include",
        body: JSON.stringify({ shortUrl: unshortenUrl }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to unshorten URL");
      setUnshortenResult(payload.data);
      if (payload.quota) setQuota(payload.quota);
      setUnshortenUrl("");
      showToast("URL resolved!");
      fetchStats().catch(() => {}); fetchHistory().catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
    finally { setBusySection(""); }
  };

  const handleSecurityCheck = async (e) => {
    e.preventDefault();
    setBusySection("security");
    setSecurityResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/security/check`, {
        method: "POST", headers: authHeaders, credentials: "include",
        body: JSON.stringify({ url: securityUrl }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to analyze URL");
      setSecurityResult(payload.data);
      showToast("Analysis complete!");
      fetchStats().catch(() => {}); fetchHistory().catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
    finally { setBusySection(""); }
  };

  const handleDeleteLink = async (linkId) => {
    if (!confirm("Delete this short link? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/links/${linkId}`, {
        method: "DELETE", headers: authHeaders, credentials: "include",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to delete link");
      showToast("Link deleted");
      fetchMyLinks(myLinksSearch).catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
  };

  const openEditModal = (link) => {
    setEditModal(link);
    setEditForm({
      originalUrl: link.originalUrl,
    });
  };

  const handleEditLink = async (e) => {
    e.preventDefault();
    if (!editModal) return;
    setEditBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/links/${editModal.id}`, {
        method: "PATCH",
        headers: authHeaders, credentials: "include",
        body: JSON.stringify({
          originalUrl: editForm.originalUrl,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to update link");
      showToast("Link updated!");
      setEditModal(null);
      fetchMyLinks(myLinksSearch).catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
    finally { setEditBusy(false); }
  };

  const openAnalytics = async (linkId) => {
    setAnalyticsModal({ loading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/api/links/${linkId}/analytics`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to load analytics");
      setAnalyticsModal(payload.analytics);
    } catch (e) {
      showToast(e.message, "error");
      setAnalyticsModal(null);
    }
  };

  const handleAdminUpdateUser = async (userId, plan) => {
    if (!confirm(`Change user #${userId} plan to "${plan}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: authHeaders, credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to update user");
      showToast(payload.message || "User updated");
      fetchAdminUsers(adminSearch).catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
  };

  const handleAdminDeleteLink = async (linkId) => {
    if (!confirm("Delete this link? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/links/${linkId}`, {
        method: "DELETE", headers: authHeaders, credentials: "include",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to delete link");
      showToast("Link deleted");
      fetchAdminLinks(adminSearch).catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
  };

  const handleAdminReply = async (ticketId, reply) => {
    setReplyBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: authHeaders, credentials: "include",
        body: JSON.stringify({ reply }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to reply");
      showToast("Reply sent");
      setReplyForm({ ticketId: null, text: "" });
      fetchAdminTickets().catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
    finally { setReplyBusy(false); }
  };

  const handleAdminCloseTicket = async (ticketId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/tickets/${ticketId}/close`, {
        method: "POST",
        headers: authHeaders, credentials: "include",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to close ticket");
      showToast("Ticket closed");
      fetchAdminTickets().catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setSupportBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/message`, {
        method: "POST",
        headers: authHeaders, credentials: "include",
        body: JSON.stringify(supportForm),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to submit ticket");
      showToast("Ticket submitted! We'll get back to you soon.");
      setSupportForm({ subject: "", message: "", email: "" });
      fetchMyTickets().catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
    finally { setSupportBusy(false); }
  };

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${qrModal?.shortCode ?? "link"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpgrade = async (plan = "pro") => {
    setBusySection("upgrade");
    try {
      // Try real Midtrans checkout first; fall back to mock if keys are not configured (503)
      const checkoutRes = await fetch(`${API_BASE_URL}/api/transactions/checkout`, {
        method: "POST", headers: authHeaders, credentials: "include",
        body: JSON.stringify({ plan }),
      });
      if (checkoutRes.status !== 503) {
        const checkoutPayload = await checkoutRes.json();
        if (!checkoutRes.ok) throw new Error(checkoutPayload.message || "Failed to create checkout session");
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = checkoutPayload.data.redirectUrl;
        return;
      }
      // Midtrans not configured — use mock path
      const res = await fetch(`${API_BASE_URL}/api/transactions/payment`, {
        method: "POST", headers: authHeaders, credentials: "include",
        body: JSON.stringify({ method: "mock", plan }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to change plan");
      if (payload.quota) setQuota(payload.quota);
      setShowPlanModal(false);
      const label = plan === "team" ? "Team" : plan === "free" ? "Free" : "Pro";
      showToast(`Plan switched to ${label}!`);
      fetchQuota().catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
    finally { setBusySection(""); }
  };

  const handleDowngradeMock = async (plan) => {
    setBusySection("upgrade");
    try {
      const res = await fetch(`${API_BASE_URL}/api/transactions/payment`, {
        method: "POST", headers: authHeaders, credentials: "include",
        body: JSON.stringify({ method: "mock", plan, force: true }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to change plan");
      if (payload.quota) setQuota(payload.quota);
      setShowPlanModal(false);
      const label = plan === "team" ? "Team" : plan === "free" ? "Free" : "Pro";
      showToast(`[Dev] Plan reset to ${label}.`);
      fetchQuota().catch(() => {});
    } catch (e) { showToast(e.message, "error"); }
    finally { setBusySection(""); }
  };

  /* ── Plan helpers ── */
  const tier = quota?.tier ?? "free";

  const planLabel =
    tier === "admin" ? "Admin"
    : tier === "team" ? "Team"
    : tier === "pro"  ? "Pro"
    : "Free";

  const planGradient =
    tier === "admin" ? "linear-gradient(135deg, #f59e0b, #fbbf24)"
    : tier === "team" ? "linear-gradient(135deg, #0d9488, #2dd4bf)"
    : tier === "pro"  ? "linear-gradient(135deg, #7c3aed, #a78bfa)"
    : "linear-gradient(135deg, #4285f4, #60a5fa)";

  const planAccent =
    tier === "admin" ? "#f59e0b"
    : tier === "team" ? "#0d9488"
    : tier === "pro"  ? "#7c3aed"
    : "#4285f4";

  /* ── Greeting ── */
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = currentUser.username || currentUser.email.split("@")[0];

  /* ────────────────── PAGES ────────────────── */

  const renderHome = () => (
    <div className="flex flex-col gap-6">

      {/* Greeting */}
      <div>
        <h1 className="text-white text-2xl font-semibold">{greeting}, {firstName} 👋</h1>
        <p className="text-white/40 text-sm mt-1">Here's what's happening with your account.</p>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Total actions",
            value: (stats.shorten ?? 0) + (stats.unshorten ?? 0) + (stats.security ?? 0),
            sub: `${stats.shorten ?? 0} sh · ${stats.unshorten ?? 0} un · ${stats.security ?? 0} sec`,
            accent: "#a78bfa",
            bar: null,
          },
          {
            label: "Tokens remaining",
            value: quota?.isUnlimited ? "∞" : (quota?.remainingUses ?? 0),
            sub: quota?.isUnlimited ? "Unlimited plan" : `of ${quota?.usageLimit ?? 0} this period`,
            accent: planAccent,
            bar: !quota?.isUnlimited && quota
              ? Math.min(100, (quota.remainingUses / quota.usageLimit) * 100)
              : null,
            barColor: planGradient,
          },
          {
            label: "Links created",
            value: stats.shorten ?? 0,
            sub: `${stats.unshorten ?? 0} unshortened`,
            accent: "#4285f4",
            bar: null,
          },
          {
            label: "Threats found",
            value: stats.malicious ?? 0,
            sub: `out of ${stats.security ?? 0} scans`,
            accent: stats.malicious > 0 ? "#f87171" : "#34d399",
            bar: null,
          },
        ].map(({ label, value, sub, accent, bar, barColor }) => (
          <div key={label} style={{ ...card, padding: 20 }} className="flex flex-col gap-2">
            <span className="text-white/50 text-sm font-semibold uppercase tracking-widest">{label}</span>
            <span className="text-3xl font-bold" style={{ color: accent }}>{value}</span>
            <span className="text-white/35 text-sm">{sub}</span>
            {bar !== null && (
              <div className="w-full h-1 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-1 rounded-full transition-all duration-500"
                  style={{ width: `${bar}%`, background: barColor }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Interactive usage chart */}
      <div style={card}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">Activity</span>
          <div className="flex items-center gap-2">
            {/* Range selector */}
            {[7, 14, 30].map((d) => (
              <button key={d} type="button"
                onClick={() => setChartDays(d)}
                className="text-xs font-semibold px-3 py-1 rounded-lg border-none cursor-pointer transition-all"
                style={{
                  background: chartDays === d ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.05)",
                  color: chartDays === d ? "#a78bfa" : "rgba(255,255,255,0.3)",
                  border: `1px solid ${chartDays === d ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)"}`,
                }}>
                {d}d
              </button>
            ))}
            <div className="w-px h-4 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
            {/* Line toggles */}
            {[
              { key: "shorten",   label: "Shorten",   color: "#4285f4" },
              { key: "unshorten", label: "Unshorten", color: "#a78bfa" },
              { key: "security",  label: "Security",  color: "#34d399" },
            ].map(({ key, label, color }) => {
              const hidden = hiddenLines.has(key);
              return (
                <button key={key} type="button"
                  onClick={() => setHiddenLines((prev) => {
                    const next = new Set(prev);
                    hidden ? next.delete(key) : next.add(key);
                    return next;
                  })}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border-none cursor-pointer transition-all"
                  style={{
                    background: hidden ? "rgba(255,255,255,0.03)" : `${color}18`,
                    color: hidden ? "rgba(255,255,255,0.2)" : color,
                    border: `1px solid ${hidden ? "rgba(255,255,255,0.06)" : `${color}40`}`,
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: hidden ? "rgba(255,255,255,0.15)" : color }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={history} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <XAxis dataKey="date" tick={<ChartDateTick />}
              tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 11 }}
              labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
              itemStyle={{ color: "#fff" }}
              cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
            />
            {!hiddenLines.has("shorten")   && <Line type="monotone" dataKey="shorten"   name="Shorten"   stroke="#4285f4" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#4285f4" }} />}
            {!hiddenLines.has("unshorten") && <Line type="monotone" dataKey="unshorten" name="Unshorten"  stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#a78bfa" }} />}
            {!hiddenLines.has("security")  && <Line type="monotone" dataKey="security"  name="Security"   stroke="#34d399" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#34d399" }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Quick actions</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: "shorten",   title: "Shorten a link",     desc: "Turn any long URL into a clean short link.",          icon: Icon.link,    color: "rgba(66,133,244,0.12)",  border: "rgba(66,133,244,0.22)",  accent: "#4285f4", btnClass: "btn-shimmer"      },
            { id: "unshorten", title: "Reveal a link",      desc: "See the real destination behind any short URL.",      icon: Icon.unlink,  color: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.22)", accent: "#a78bfa", btnClass: "btn-shimmer-pro"  },
            { id: "security",  title: "Check safety",       desc: "Scan a URL for threats before you click.",            icon: Icon.shield,  color: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.20)",  accent: "#34d399", btnClass: "btn-shimmer-team" },
            { id: "mylinks",   title: "My Links",           desc: "Manage, search, and delete your shortened links.",    icon: Icon.list,    color: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.20)",  accent: "#f59e0b", btnClass: "btn-shimmer-amber" },
          ].map(({ id, title, desc, icon, color, border, accent, btnClass }) => (
            <div key={id} className="flex flex-col"
              style={{ ...card, background: color, border: `1px solid ${border}`, padding: 20 }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${accent}22`, color: accent }}>
                {icon}
              </div>
              <p className="text-white font-semibold text-sm mb-1">{title}</p>
              <p className="text-white/40 text-xs leading-relaxed mb-4">{desc}</p>
              <button type="button" onClick={() => setActivePage(id)}
                className={`mt-auto w-full text-white text-xs font-semibold py-2 rounded-lg border-none cursor-pointer flex items-center justify-center gap-1.5 ${btnClass}`}>
                Open {Icon.arrow}
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );

  const renderShorten = () => (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-white text-2xl font-semibold">Shorten a link</h1>
        <p className="text-white/40 text-sm mt-1">Create a standard short URL or a custom alias.</p>
      </div>
      <div style={card}>
        <form onSubmit={handleShorten} className="flex flex-col gap-4">
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">Destination URL</label>
            <input style={inputStyle} type="text" placeholder="https://example.com/very/long/link"
              value={shortenForm.url}
              onChange={(e) => setShortenForm((c) => ({ ...c, url: e.target.value }))}
              required
              onFocus={(e) => (e.target.style.borderColor = "rgba(66,133,244,0.7)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
            />
          </div>
          {tier === "pro" || tier === "team" || tier === "admin" ? (
            <div>
              <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">
                Custom alias
              </label>
              <input style={inputStyle} type="text" placeholder="my-custom-link"
                value={shortenForm.customAlias}
                onChange={(e) => setShortenForm((c) => ({ ...c, customAlias: e.target.value }))}
                onFocus={(e) => (e.target.style.borderColor = "rgba(66,133,244,0.7)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>
          ) : (
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}>
              <span className="text-white/40 text-xs">Custom alias is a <span className="text-violet-400 font-semibold">Pro</span> feature</span>
              <button type="button" onClick={() => setShowPlanModal(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white border-none cursor-pointer btn-shimmer-pro">
                Upgrade
              </button>
            </div>
          )}
          <button type="submit" disabled={busySection === "shorten"}
            className={`rounded-xl py-3 text-sm font-semibold text-white border-none ${busySection === "shorten" ? "opacity-60 cursor-not-allowed" : "btn-shimmer cursor-pointer"}`}
            style={busySection === "shorten" ? { background: "#9ca3af" } : {}}
          >
            {busySection === "shorten" ? "Creating..." : "Generate short link"}
          </button>
        </form>
        {shortenResult && (
          <div style={resultCard}>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Your short link</p>
            <div className="flex items-start gap-4">
              {/* QR preview */}
              <div className="flex-shrink-0 p-2 rounded-xl" style={{ background: "#fff" }}>
                <QRCodeSVG value={shortenResult.shortUrl} size={72} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <a href={shortenResult.shortUrl} target="_blank" rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors text-sm flex-1"
                    style={{ wordBreak: "break-all" }}>
                    {shortenResult.shortUrl}
                  </a>
                  <button type="button"
                    onClick={() => { navigator.clipboard.writeText(shortenResult.shortUrl); showToast("Copied!"); }}
                    className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}>
                    {Icon.copy}
                  </button>
                </div>
                <p className="text-white/30 text-xs mb-2">
                  Alias: {shortenResult.shortCode} · {shortenResult.isCustom ? "Custom" : "Auto-generated"}
                </p>
                <button type="button"
                  onClick={() => setQrModal({ shortUrl: shortenResult.shortUrl, shortCode: shortenResult.shortCode })}
                  className="text-violet-400/70 hover:text-violet-400 transition-colors text-xs flex items-center gap-1.5"
                  style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                  {Icon.qr} <span>Full QR / Download</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSupport = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-white text-2xl font-semibold">Support</h1>
        <p className="text-white/40 text-sm mt-1">Submit a ticket and we'll get back to you.</p>
      </div>

      <div style={card}>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">New ticket</p>
        <form onSubmit={handleSupportSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">Subject</label>
            <input style={inputStyle} type="text" placeholder="Brief description of your issue"
              value={supportForm.subject}
              onChange={(e) => setSupportForm((c) => ({ ...c, subject: e.target.value }))}
              required
              onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.7)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
            />
          </div>
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">Message</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
              placeholder="Describe your issue in detail..."
              value={supportForm.message}
              onChange={(e) => setSupportForm((c) => ({ ...c, message: e.target.value }))}
              required
              onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.7)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
            />
          </div>
          <button type="submit" disabled={supportBusy}
            className={`rounded-xl py-3 text-sm font-semibold text-white border-none ${supportBusy ? "opacity-60 cursor-not-allowed" : "btn-shimmer-pro cursor-pointer"}`}
            style={supportBusy ? { background: "#9ca3af" } : {}}>
            {supportBusy ? "Submitting..." : "Submit ticket"}
          </button>
        </form>
      </div>

      {/* My Tickets */}
      <div>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">My Tickets</p>
        <div style={card}>
          {ticketsLoading ? (
            <p className="text-white/30 text-sm text-center py-8">Loading...</p>
          ) : myTickets.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No tickets yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {[...myTickets].reverse().map((t) => {
                const statusColor =
                  t.status === "answered" ? { bg: "rgba(16,185,129,0.15)", color: "#34d399" }
                  : t.status === "closed"   ? { bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }
                  : { bg: "rgba(66,133,244,0.15)", color: "#60a5fa" };
                return (
                  <div key={t.id} className="flex flex-col gap-2 p-4 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-white font-semibold text-sm">{t.subject || "Support Request"}</p>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: statusColor.bg, color: statusColor.color }}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs leading-relaxed">{t.message}</p>
                    {t.reply && (
                      <div className="mt-1 pl-3 py-2 rounded-lg"
                        style={{ borderLeft: "2px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.06)" }}>
                        <p className="text-white/35 text-[10px] font-semibold uppercase tracking-widest mb-1">Admin reply</p>
                        <p className="text-white/60 text-xs leading-relaxed">{t.reply}</p>
                      </div>
                    )}
                    <p className="text-white/20 text-xs">{new Date(t.createdAt).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderUnshorten = () => (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-white text-2xl font-semibold">Unshorten a link</h1>
        <p className="text-white/40 text-sm mt-1">Reveal the real destination behind any short URL.</p>
      </div>
      <div style={card}>
        <form onSubmit={handleUnshorten} className="flex flex-col gap-4">
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">Short URL</label>
            <input style={inputStyle} type="text" placeholder="https://tinyurl.com/abc123"
              value={unshortenUrl}
              onChange={(e) => setUnshortenUrl(e.target.value)}
              required
              onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.7)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
            />
          </div>
          <button type="submit" disabled={busySection === "unshorten"}
            className={`rounded-xl py-3 text-sm font-semibold text-white border-none ${busySection === "unshorten" ? "opacity-60 cursor-not-allowed" : "btn-shimmer-pro cursor-pointer"}`}
            style={busySection === "unshorten" ? { background: "#9ca3af" } : {}}
          >
            {busySection === "unshorten" ? "Resolving..." : "Reveal original URL"}
          </button>
        </form>
        {unshortenResult && (
          <div style={resultCard}>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Original destination</p>
            <a href={unshortenResult.originalUrl} target="_blank" rel="noreferrer"
              className="text-violet-400 hover:text-violet-300 transition-colors text-sm"
              style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
              {unshortenResult.originalUrl}
            </a>
            {unshortenResult.redirectChain?.length > 1 && (
              <div className="mt-4">
                <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-2">Redirect chain</p>
                {unshortenResult.redirectChain.map((url, idx) => (
                  <div key={idx} className="text-white/30 text-xs py-1"
                    style={{ borderLeft: "2px solid rgba(124,58,237,0.3)", paddingLeft: 10, marginBottom: 4, wordBreak: "break-all" }}>
                    {url}
                  </div>
                ))}
              </div>
            )}
            <p className="text-white/25 text-xs mt-3">Source: {unshortenResult.source}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-white text-2xl font-semibold">Security check</h1>
        <p className="text-white/40 text-sm mt-1">Scan a URL for threats, phishing, and malware.</p>
      </div>
      <div style={card}>
        <form onSubmit={handleSecurityCheck} className="flex flex-col gap-4">
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">URL to scan</label>
            <input style={inputStyle} type="text" placeholder="https://suspicious-site.example/login"
              value={securityUrl}
              onChange={(e) => setSecurityUrl(e.target.value)}
              required
              onFocus={(e) => (e.target.style.borderColor = "rgba(16,185,129,0.7)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
            />
          </div>
          <button type="submit" disabled={busySection === "security"}
            className={`rounded-xl py-3 text-sm font-semibold text-white border-none ${busySection === "security" ? "opacity-60 cursor-not-allowed" : "btn-shimmer-team cursor-pointer"}`}
            style={busySection === "security" ? { background: "#9ca3af" } : {}}
          >
            {busySection === "security" ? "Analyzing..." : "Analyze URL"}
          </button>
        </form>
        {securityResult && (
          <div style={resultCard}>
            {/* Verdict row */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {/* Main verdict badge */}
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={
                  securityResult.verdict === "malicious"     ? { background:"rgba(239,68,68,0.2)",   color:"#fca5a5", border:"1px solid rgba(239,68,68,0.3)"   } :
                  securityResult.verdict === "inappropriate" ? { background:"rgba(249,115,22,0.2)",  color:"#fdba74", border:"1px solid rgba(249,115,22,0.3)"  } :
                  securityResult.verdict === "suspicious"    ? { background:"rgba(234,179,8,0.2)",   color:"#fbbf24", border:"1px solid rgba(234,179,8,0.3)"   } :
                                                              { background:"rgba(16,185,129,0.2)",  color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.3)"  }
                }>
                {securityResult.verdict === "inappropriate"
                  ? (securityResult.category === "adult" ? "⚠ Adult Content" : "⚠ Gambling Site")
                  : securityResult.verdict}
              </span>
              {/* Category badge */}
              {securityResult.category && securityResult.category !== "safe" && securityResult.category !== "malicious" && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={
                    securityResult.category === "adult"    ? { background:"rgba(236,72,153,0.15)", color:"#f9a8d4", border:"1px solid rgba(236,72,153,0.3)" } :
                    securityResult.category === "gambling" ? { background:"rgba(234,179,8,0.15)",  color:"#fde68a", border:"1px solid rgba(234,179,8,0.3)"  } :
                                                            { background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.1)" }
                  }>
                  {securityResult.category === "adult" ? "Adult / NSFW" : securityResult.category === "gambling" ? "Gambling" : securityResult.category}
                </span>
              )}
              <span className="text-white/30 text-xs">Risk {securityResult.riskScore}/100</span>
              {/* Provider badge */}
              {(() => {
                const p = securityResult.provider || "heuristic";
                const hasPhish = p.includes("phishtank") || p.includes("openphish");
                const hasVT = p.startsWith("virustotal");
                const label = [
                  hasVT && "VirusTotal",
                  "Heuristic",
                  hasPhish && (p.includes("phishtank") ? "PhishTank" : "OpenPhish"),
                ].filter(Boolean).join(" + ");
                const style = hasPhish
                  ? { background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)" }
                  : hasVT
                  ? { background: "rgba(255,112,0,0.15)", color: "#fb923c", border: "1px solid rgba(255,112,0,0.25)" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" };
                return (
                  <span className="ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-full" style={style}>
                    {label}
                  </span>
                );
              })()}
            </div>

            {/* Risk bar */}
            <div className="w-full rounded-full h-1.5 mb-4" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-1.5 rounded-full transition-all"
                style={{ width: `${securityResult.riskScore}%`, background:
                  securityResult.verdict === "inappropriate" ? "#f97316" :
                  securityResult.riskScore > 60 ? "#ef4444" :
                  securityResult.riskScore > 30 ? "#f59e0b" : "#10b981" }} />
            </div>

            {/* VT vendor breakdown */}
            {securityResult.vtStats && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: "Malicious",  value: securityResult.vtStats.malicious,  color: "#fca5a5" },
                  { label: "Suspicious", value: securityResult.vtStats.suspicious, color: "#fbbf24" },
                  { label: "Harmless",   value: securityResult.vtStats.harmless,   color: "#6ee7b7" },
                  { label: "Undetected", value: securityResult.vtStats.undetected, color: "rgba(255,255,255,0.3)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col items-center rounded-xl py-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-lg font-semibold" style={{ color }}>{value}</span>
                    <span className="text-[9px] text-white/30 uppercase tracking-wide mt-0.5">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Scan age */}
            {securityResult.scanAge && securityResult.provider?.startsWith("virustotal") && (
              <p className="text-white/20 text-xs mb-3">Last scanned: {securityResult.scanAge}</p>
            )}

            {/* Indicators / clean notice */}
            <div className="flex flex-wrap gap-2">
              {securityResult.indicators?.length ? (
                securityResult.indicators.map((ind) => (
                  <span key={ind} className="text-xs px-3 py-1 rounded-full"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {ind}
                  </span>
                ))
              ) : (
                <span className="text-xs px-3 py-1 rounded-full"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
                  No suspicious indicators found
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-white text-2xl font-semibold">Activity History</h1>
        <p className="text-white/40 text-sm mt-1">Your usage breakdown over the last 14 days.</p>
      </div>
      <div style={{ ...card, overflowX: "auto" }}>
        {history.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-10">
            No history yet. Start shortening or checking links to see data here.
          </p>
        ) : (
          <table className="w-full min-w-[600px] text-sm border-collapse">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-widest border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <th className="text-left py-3 pr-4 font-semibold">Date</th>
                <th className="text-right py-3 px-3 font-semibold text-blue-400/70">Shorten</th>
                <th className="text-right py-3 px-3 font-semibold text-violet-400/70">Unshorten</th>
                <th className="text-right py-3 px-3 font-semibold text-emerald-400/70">Security</th>
                <th className="text-right py-3 pl-3 font-semibold text-red-400/70">Threats</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-white/[0.02] transition-colors" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <td className="py-3 pr-4 text-white/50 font-mono text-xs">{row.date}</td>
                  <td className="py-3 px-3 text-right font-semibold" style={{ color: row.shorten ? "#4285f4" : "rgba(255,255,255,0.15)" }}>{row.shorten}</td>
                  <td className="py-3 px-3 text-right font-semibold" style={{ color: row.unshorten ? "#a78bfa" : "rgba(255,255,255,0.15)" }}>{row.unshorten}</td>
                  <td className="py-3 px-3 text-right font-semibold" style={{ color: row.security ? "#34d399" : "rgba(255,255,255,0.15)" }}>{row.security}</td>
                  <td className="py-3 pl-3 text-right font-semibold" style={{ color: row.malicious ? "#f87171" : "rgba(255,255,255,0.15)" }}>{row.malicious ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total shortens",    value: stats.shorten   ?? 0, color: "#4285f4"  },
          { label: "Total unshortens",  value: stats.unshorten ?? 0, color: "#a78bfa"  },
          { label: "Security checks",   value: stats.security  ?? 0, color: "#34d399"  },
          { label: "Threats found",     value: stats.malicious ?? 0, color: "#f87171"  },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: 20 }} className="flex flex-col gap-1">
            <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">{label}</span>
            <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMyLinks = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-white text-2xl font-semibold">My Links</h1>
        <p className="text-white/40 text-sm mt-1">All short links you've created. Search, copy, or delete.</p>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <input
          style={{ ...inputStyle, flex: 1 }}
          type="text"
          placeholder="Search by URL or short code..."
          value={myLinksSearch}
          onChange={(e) => {
            setMyLinksSearch(e.target.value);
            fetchMyLinks(e.target.value).catch(() => {});
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(245,158,11,0.7)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
        />
        <button
          type="button"
          onClick={() => fetchMyLinks(myLinksSearch).catch(() => {})}
          className="flex-shrink-0 text-xs font-semibold px-4 py-3 rounded-xl text-white border-none cursor-pointer btn-shimmer"
        >
          Refresh
        </button>
      </div>

      <div style={card}>
        {myLinksLoading ? (
          <p className="text-white/30 text-sm text-center py-10">Loading...</p>
        ) : myLinks.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-white/30 text-sm">
              {myLinksSearch ? "No links match your search." : "No links yet. Create your first short link above."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 0 }}>
            {myLinks.map((link) => {
              const expired = link.isExpired;
              return (
                <div key={link.id} className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 py-4"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex-1 min-w-0">
                    {/* Short URL row */}
                    <div className="flex items-center gap-2 mb-1">
                      <a
                        href={link.shortUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold hover:opacity-80 transition-opacity"
                        style={{ color: expired ? "rgba(248,113,113,0.7)" : "#f59e0b" }}
                      >
                        {link.shortUrl}
                      </a>
                      {expired && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                          Expired
                        </span>
                      )}
                      {link.isCustom && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>
                          Custom
                        </span>
                      )}
                    </div>

                    {/* Original URL */}
                    <p className="text-white/35 text-xs truncate" style={{ maxWidth: "90%" }}>
                      {link.originalUrl}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 mt-1.5 text-white/25 text-xs">
                      <span>{new Date(link.createdAt).toLocaleDateString()}</span>
                      <span>{link.visitCount} visit{link.visitCount !== 1 ? "s" : ""}</span>
                      {link.expiresAt && !expired && (
                        <span className="text-amber-400/50">Expires {new Date(link.expiresAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      title="QR Code"
                      onClick={() => setQrModal({ shortUrl: link.shortUrl, shortCode: link.shortCode })}
                      className="text-violet-400/50 hover:text-violet-400 transition-colors"
                      style={{ background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}
                    >
                      {Icon.qr}
                    </button>
                    <button
                      type="button"
                      title="Analytics"
                      onClick={() => openAnalytics(link.id)}
                      className="text-emerald-400/50 hover:text-emerald-400 transition-colors"
                      style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}
                    >
                      {Icon.chart}
                    </button>
                    <button
                      type="button"
                      title="Edit link"
                      onClick={() => openEditModal(link)}
                      className="text-blue-400/50 hover:text-blue-400 transition-colors"
                      style={{ background: "rgba(66,133,244,0.07)", border: "1px solid rgba(66,133,244,0.15)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}
                    >
                      {Icon.edit}
                    </button>
                    <button
                      type="button"
                      title="Copy short URL"
                      onClick={() => { navigator.clipboard.writeText(link.shortUrl); showToast("Copied!"); }}
                      className="text-white/40 hover:text-white/70 transition-colors"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}
                    >
                      {Icon.copy}
                    </button>
                    <button
                      type="button"
                      title="Delete link"
                      onClick={() => handleDeleteLink(link.id)}
                      className="text-red-400/50 hover:text-red-400 transition-colors"
                      style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}
                    >
                      {Icon.trash}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const PLAN_OPTIONS = ["free", "pro", "team"];

  const TIER_COLOR = {
    free:  { bg: "rgba(66,133,244,0.15)",   color: "#60a5fa" },
    pro:   { bg: "rgba(124,58,237,0.15)",   color: "#a78bfa" },
    team:  { bg: "rgba(13,148,136,0.15)",   color: "#2dd4bf" },
    admin: { bg: "rgba(245,158,11,0.15)",   color: "#fbbf24" },
  };

  const TierBadge = ({ t }) => {
    const c = TIER_COLOR[t] ?? TIER_COLOR.free;
    return (
      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
        style={{ background: c.bg, color: c.color }}>
        {t}
      </span>
    );
  };

  const renderAdmin = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-white text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Manage users, links, and transactions.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total users",   value: adminUsers.length,   color: "#a78bfa" },
          { label: "Total links",   value: adminLinks.length,   color: "#f59e0b" },
          { label: "Transactions",  value: adminTxs.length,     color: "#34d399" },
          { label: "Tickets",       value: adminTickets.length, color: "#60a5fa" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: 20 }} className="flex flex-col gap-1">
            <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">{label}</span>
            <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "users",        label: "Users" },
          { id: "links",        label: "Links" },
          { id: "transactions", label: "Transactions" },
          { id: "tickets",      label: "Tickets" },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAdminTab(id)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border-none cursor-pointer transition-all"
            style={{
              background: adminTab === id ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)",
              color: adminTab === id ? "#a78bfa" : "rgba(255,255,255,0.45)",
              border: adminTab === id ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {label}
          </button>
        ))}

        {/* Search (users + links only) */}
        {(adminTab === "users" || adminTab === "links") && (
          <input
            style={{ ...inputStyle, flex: 1, marginLeft: 8 }}
            type="text"
            placeholder={adminTab === "users" ? "Search by email..." : "Search by URL or short code..."}
            value={adminSearch}
            onChange={(e) => {
              setAdminSearch(e.target.value);
              if (adminTab === "users") fetchAdminUsers(e.target.value).catch(() => {});
              else fetchAdminLinks(e.target.value).catch(() => {});
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.7)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
          />
        )}

        <button
          type="button"
          onClick={() => {
            if (adminTab === "users") fetchAdminUsers(adminSearch).catch(() => {});
            else if (adminTab === "links") fetchAdminLinks(adminSearch).catch(() => {});
            else if (adminTab === "tickets") fetchAdminTickets().catch(() => {});
            else fetchAdminTxs().catch(() => {});
          }}
          className="flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-xl text-white border-none cursor-pointer btn-shimmer"
        >
          Refresh
        </button>
      </div>

      <div style={{ ...card, overflowX: "auto" }}>
        {adminLoading ? (
          <p className="text-white/30 text-sm text-center py-10">Loading...</p>
        ) : adminTab === "users" ? (
          adminUsers.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10">No users found.</p>
          ) : (
            <table className="w-full min-w-[600px] text-sm border-collapse">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-widest border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <th className="text-left py-3 pr-4 font-semibold">ID</th>
                  <th className="text-left py-3 pr-4 font-semibold">Email</th>
                  <th className="text-left py-3 pr-4 font-semibold">Plan</th>
                  <th className="text-right py-3 px-3 font-semibold">Usage</th>
                  <th className="text-right py-3 px-3 font-semibold">Shortens</th>
                  <th className="text-left py-3 px-3 font-semibold">Joined</th>
                  <th className="text-right py-3 pl-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-white/[0.02] transition-colors" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <td className="py-3 pr-4 text-white/30 font-mono text-xs">#{u.id}</td>
                    <td className="py-3 pr-4 text-white/80 text-xs">{u.email}</td>
                    <td className="py-3 pr-4"><TierBadge t={u.tier} /></td>
                    <td className="py-3 px-3 text-right text-white/50 text-xs">{u.usage_count}</td>
                    <td className="py-3 px-3 text-right text-blue-400/70 text-xs">{u.stats?.shorten ?? 0}</td>
                    <td className="py-3 px-3 text-white/30 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                    <td className="py-3 pl-3 text-right">
                      {u.role !== "admin" && (
                        <div className="flex items-center justify-end gap-1">
                          {PLAN_OPTIONS.filter((p) => p !== u.tier).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handleAdminUpdateUser(u.id, p)}
                              className="text-[10px] font-semibold px-2 py-1 rounded-lg cursor-pointer transition-opacity hover:opacity-80 border-none"
                              style={{
                                background: TIER_COLOR[p]?.bg ?? "rgba(255,255,255,0.08)",
                                color: TIER_COLOR[p]?.color ?? "#fff",
                              }}
                            >
                              Set {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : adminTab === "links" ? (
          adminLinks.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10">No links found.</p>
          ) : (
            <table className="w-full min-w-[600px] text-sm border-collapse">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-widest border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <th className="text-left py-3 pr-4 font-semibold">ID</th>
                  <th className="text-left py-3 pr-4 font-semibold">Short code</th>
                  <th className="text-left py-3 pr-4 font-semibold">Original URL</th>
                  <th className="text-right py-3 px-3 font-semibold">Owner</th>
                  <th className="text-right py-3 px-3 font-semibold">Visits</th>
                  <th className="text-left py-3 px-3 font-semibold">Created</th>
                  <th className="text-right py-3 pl-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminLinks.map((l) => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-white/[0.02] transition-colors" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <td className="py-3 pr-4 text-white/30 font-mono text-xs">#{l.id}</td>
                    <td className="py-3 pr-4">
                      <span className="text-amber-400/80 text-xs font-mono">{l.short_code}</span>
                      {l.is_custom && (
                        <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>C</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-white/40 text-xs max-w-xs truncate" style={{ maxWidth: 240 }}>
                      {l.original_url}
                    </td>
                    <td className="py-3 px-3 text-right text-white/30 text-xs font-mono">
                      {l.user_id ? `#${l.user_id}` : "guest"}
                    </td>
                    <td className="py-3 px-3 text-right text-white/50 text-xs">{l.visit_count}</td>
                    <td className="py-3 px-3 text-white/30 text-xs">{new Date(l.created_at).toLocaleDateString()}</td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        title="Delete link"
                        onClick={() => handleAdminDeleteLink(l.id)}
                        className="text-red-400/50 hover:text-red-400 transition-colors"
                        style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "5px 7px", cursor: "pointer" }}
                      >
                        {Icon.trash}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : adminTab === "transactions" ? (
          adminTxs.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10">No transactions yet.</p>
          ) : (
            <table className="w-full min-w-[600px] text-sm border-collapse">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-widest border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <th className="text-left py-3 pr-4 font-semibold">ID</th>
                  <th className="text-left py-3 pr-4 font-semibold">User</th>
                  <th className="text-left py-3 pr-4 font-semibold">Method</th>
                  <th className="text-right py-3 px-3 font-semibold">Amount</th>
                  <th className="text-left py-3 px-3 font-semibold">Status</th>
                  <th className="text-left py-3 pl-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {adminTxs.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-white/[0.02] transition-colors" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <td className="py-3 pr-4 text-white/30 font-mono text-xs">#{t.id}</td>
                    <td className="py-3 pr-4 text-white/50 text-xs font-mono">#{t.user_id}</td>
                    <td className="py-3 pr-4 text-white/50 text-xs capitalize">{t.method}</td>
                    <td className="py-3 px-3 text-right text-emerald-400/80 text-xs font-semibold">Rp {Number(t.amount ?? 0).toLocaleString("id-ID")}</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={
                          t.status === "success" ? { background: "rgba(16,185,129,0.15)", color: "#34d399" } :
                          t.status === "pending" ? { background: "rgba(234,179,8,0.15)",  color: "#fbbf24" } :
                                                   { background: "rgba(239,68,68,0.15)",  color: "#f87171" }
                        }>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-white/30 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          /* Tickets tab */
          adminTickets.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10">No support tickets yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {adminTickets.map((t) => {
                const statusColor =
                  t.status === "answered" ? { bg: "rgba(16,185,129,0.15)", color: "#34d399" }
                  : t.status === "closed"   ? { bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }
                  : { bg: "rgba(66,133,244,0.15)", color: "#60a5fa" };
                const isReplying = replyForm.ticketId === t.id;
                return (
                  <div key={t.id} className="flex flex-col gap-3 p-4 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white/25 text-xs font-mono">#{t.id}</span>
                          <span className="text-white font-semibold text-sm">{t.subject || "Support Request"}</span>
                        </div>
                        <p className="text-white/30 text-xs">User #{t.userId ?? "guest"} · {new Date(t.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: statusColor.bg, color: statusColor.color }}>
                          {t.status}
                        </span>
                        {t.status !== "closed" && (
                          <button type="button"
                            onClick={() => handleAdminCloseTicket(t.id)}
                            className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full cursor-pointer transition-opacity hover:opacity-70"
                            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-white/50 text-xs leading-relaxed">{t.message}</p>
                    {t.reply && (
                      <div className="pl-3 py-2 rounded-lg"
                        style={{ borderLeft: "2px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.06)" }}>
                        <p className="text-white/35 text-[10px] font-semibold uppercase tracking-widest mb-1">Your reply</p>
                        <p className="text-white/60 text-xs leading-relaxed">{t.reply}</p>
                      </div>
                    )}
                    {t.status !== "closed" && (
                      isReplying ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            style={{ ...inputStyle, resize: "vertical", minHeight: 72, fontSize: 12 }}
                            placeholder="Type your reply..."
                            value={replyForm.text}
                            onChange={(e) => setReplyForm((c) => ({ ...c, text: e.target.value }))}
                            onFocus={(e) => (e.target.style.borderColor = "rgba(16,185,129,0.6)")}
                            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                          />
                          <div className="flex gap-2">
                            <button type="button"
                              onClick={() => setReplyForm({ ticketId: null, text: "" })}
                              className="flex-1 rounded-lg py-2 text-xs font-semibold border-none cursor-pointer"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                              Cancel
                            </button>
                            <button type="button"
                              disabled={replyBusy || !replyForm.text.trim()}
                              onClick={() => handleAdminReply(t.id, replyForm.text)}
                              className={`flex-1 rounded-lg py-2 text-xs font-semibold text-white border-none ${replyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer btn-shimmer-team"}`}
                              style={replyBusy ? { background: "#9ca3af" } : {}}>
                              {replyBusy ? "Sending..." : "Send reply"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button"
                          onClick={() => setReplyForm({ ticketId: t.id, text: "" })}
                          className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                          style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                          {t.reply ? "Edit reply" : "Reply"}
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { showToast("New passwords don't match", "error"); return; }
    if (pwForm.next.length < 8) { showToast("New password must be at least 8 characters", "error"); return; }
    setPwBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "PATCH",
        headers: authHeaders, credentials: "include",
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast("Password changed successfully");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setPwBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== currentUser.email) { showToast("Email doesn't match", "error"); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/account`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onLogout();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const renderSettings = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-white text-2xl font-semibold">Settings</h1>
        <p className="text-white/40 text-sm mt-1">Manage your account security and preferences.</p>
      </div>

      {/* Change password */}
      <div style={card}>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">Change Password</p>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          {[
            { label: "Current password", key: "current", placeholder: "Your current password" },
            { label: "New password",     key: "next",    placeholder: "Min. 8 characters" },
            { label: "Confirm new",      key: "confirm", placeholder: "Repeat new password" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">{label}</label>
              <input
                style={inputStyle}
                type="password"
                placeholder={placeholder}
                value={pwForm[key]}
                onChange={(e) => setPwForm((c) => ({ ...c, [key]: e.target.value }))}
                required
                onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.7)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>
          ))}
          <button type="submit" disabled={pwBusy}
            className={`rounded-xl py-3 text-sm font-semibold text-white border-none ${pwBusy ? "opacity-60 cursor-not-allowed" : "btn-shimmer cursor-pointer"}`}
            style={pwBusy ? { background: "#9ca3af" } : {}}>
            {pwBusy ? "Saving..." : "Update password"}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div style={{ ...card, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
        <p className="text-red-400 text-xs font-semibold uppercase tracking-widest mb-1">Danger Zone</p>
        <p className="text-white/40 text-sm mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">
              Type <span className="text-white/70 font-mono">{currentUser.email}</span> to confirm
            </label>
            <input
              style={{ ...inputStyle, borderColor: deleteConfirm && deleteConfirm !== currentUser.email ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)" }}
              type="text"
              placeholder={currentUser.email}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = "rgba(239,68,68,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = deleteConfirm && deleteConfirm !== currentUser.email ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)")}
            />
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== currentUser.email}
            className="rounded-xl py-3 text-sm font-semibold border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: deleteConfirm === currentUser.email ? "rgba(239,68,68,0.85)" : "rgba(239,68,68,0.15)", color: "#fca5a5" }}>
            Delete my account
          </button>
        </div>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case "shorten":   return renderShorten();
      case "unshorten": return renderUnshorten();
      case "security":  return renderSecurity();
      case "mylinks":   return renderMyLinks();
      case "history":   return renderHistory();
      case "support":   return renderSupport();
      case "settings":  return renderSettings();
      case "admin":     return renderAdmin();
      default:          return renderHome();
    }
  };

  /* ────────────────── LAYOUT ────────────────── */
  return (
    <div className="min-h-screen flex" style={{ background: "#0f172a" }}>
      <Toast toast={toast} />
      {showPlanModal && (
        <PlanModal
          currentTier={tier}
          onSelect={handleUpgrade}
          onDowngrade={handleDowngradeMock}
          onClose={() => setShowPlanModal(false)}
          busy={busySection === "upgrade"}
        />
      )}

      {/* ── QR Code Modal ── */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setQrModal(null); }}>
          <div className="w-full max-w-sm rounded-2xl p-7 flex flex-col gap-5 items-center"
            style={{ background: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="w-full flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">QR Code</p>
                <p className="text-white/30 text-xs mt-0.5 font-mono">{qrModal.shortCode}</p>
              </div>
              <button type="button" onClick={() => setQrModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors border-none cursor-pointer"
                style={{ background: "rgba(255,255,255,0.08)" }}>✕</button>
            </div>
            <div ref={qrRef} className="p-5 rounded-2xl" style={{ background: "#fff" }}>
              <QRCodeSVG value={qrModal.shortUrl} size={200} />
            </div>
            <p className="text-white/40 text-xs text-center" style={{ wordBreak: "break-all" }}>{qrModal.shortUrl}</p>
            <div className="flex gap-3 w-full">
              <button type="button"
                onClick={() => { navigator.clipboard.writeText(qrModal.shortUrl); showToast("URL copied!"); }}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-none cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                Copy URL
              </button>
              <button type="button"
                onClick={downloadQr}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white border-none cursor-pointer btn-shimmer-pro">
                Download SVG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Link Modal ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditModal(null); }}>
          <div className="w-full max-w-lg rounded-2xl p-7 flex flex-col gap-5"
            style={{ background: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">Edit link</p>
                <p className="text-white/30 text-xs mt-0.5">{editModal.shortUrl}</p>
              </div>
              <button type="button" onClick={() => setEditModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors border-none cursor-pointer"
                style={{ background: "rgba(255,255,255,0.08)" }}>✕</button>
            </div>
            <form onSubmit={handleEditLink} className="flex flex-col gap-4">
              <div>
                <label className="text-white/50 text-xs font-semibold uppercase tracking-widest block mb-2">Destination URL</label>
                <input style={inputStyle} type="text" value={editForm.originalUrl}
                  onChange={(e) => setEditForm((c) => ({ ...c, originalUrl: e.target.value }))}
                  required
                  onFocus={(e) => (e.target.style.borderColor = "rgba(66,133,244,0.7)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                />
              </div>
              <div className="flex gap-3 mt-1">
                <button type="button" onClick={() => setEditModal(null)}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold border-none cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                  Cancel
                </button>
                <button type="submit" disabled={editBusy}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white border-none ${editBusy ? "opacity-60 cursor-not-allowed" : "btn-shimmer cursor-pointer"}`}
                  style={editBusy ? { background: "#9ca3af" } : {}}>
                  {editBusy ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Analytics Modal ── */}
      {analyticsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAnalyticsModal(null); }}>
          <div className="w-full max-w-2xl rounded-2xl p-7 flex flex-col gap-5 max-h-[85vh] overflow-y-auto"
            style={{ background: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">Link Analytics</p>
                {analyticsModal.shortCode && (
                  <p className="text-white/30 text-xs mt-0.5 font-mono">{analyticsModal.shortCode}</p>
                )}
              </div>
              <button type="button" onClick={() => setAnalyticsModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors border-none cursor-pointer"
                style={{ background: "rgba(255,255,255,0.08)" }}>✕</button>
            </div>

            {analyticsModal.loading ? (
              <p className="text-white/30 text-sm text-center py-8">Loading analytics...</p>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div style={{ ...card, padding: 16 }} className="flex flex-col gap-1">
                    <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">Total clicks</span>
                    <span className="text-white text-2xl font-bold">{analyticsModal.totalClicks ?? 0}</span>
                  </div>
                  <div style={{ ...card, padding: 16 }} className="flex flex-col gap-1">
                    <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">Visit count</span>
                    <span className="text-white text-2xl font-bold">{analyticsModal.visitCount ?? 0}</span>
                  </div>
                </div>

                {/* Clicks over time */}
                {analyticsModal.history?.length > 0 && (
                  <div style={card}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Clicks, last 30 days</p>
                    <ResponsiveContainer width="100%" height={110}>
                      <LineChart data={analyticsModal.history} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <XAxis dataKey="date" tick={<ChartDateTick />}
                          tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 11 }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)" }} itemStyle={{ color: "#fff" }} />
                        <Line type="monotone" dataKey="clicks" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Countries + Devices */}
                <div className="grid grid-cols-2 gap-4">
                  <div style={card}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Top countries</p>
                    {analyticsModal.topCountries?.length === 0 ? (
                      <p className="text-white/20 text-xs">No data yet</p>
                    ) : (
                      analyticsModal.topCountries?.map(({ name, count }) => (
                        <div key={name} className="flex items-center justify-between py-1">
                          <span className="text-white/60 text-xs">{name || "Unknown"}</span>
                          <span className="text-white/40 text-xs font-mono">{count}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={card}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Devices</p>
                    {analyticsModal.deviceBreakdown?.length === 0 ? (
                      <p className="text-white/20 text-xs">No data yet</p>
                    ) : (
                      analyticsModal.deviceBreakdown?.map(({ name, count }) => (
                        <div key={name} className="flex items-center justify-between py-1">
                          <span className="text-white/60 text-xs capitalize">{name}</span>
                          <span className="text-white/40 text-xs font-mono">{count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile sidebar backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-screen flex flex-col z-50 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={{
          width: 220,
          background: "rgba(10,17,35,0.98)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Logo */}
        <div className="px-6 flex items-center" style={{ height: 65, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <XposeLogo />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {[
            ...NAV,
            ...(tier === "admin" ? [{ id: "admin", label: "Admin", icon: Icon.admin }] : []),
          ].map(({ id, label, icon }) => {
            const active = activePage === id;
            const isAdmin = id === "admin";
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setActivePage(id); setSidebarOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full"
                style={{
                  background: active ? (isAdmin ? "rgba(245,158,11,0.18)" : "rgba(124,58,237,0.18)") : "transparent",
                  color: active ? (isAdmin ? "#fbbf24" : "#a78bfa") : "rgba(255,255,255,0.45)",
                  border: active ? `1px solid ${isAdmin ? "rgba(245,158,11,0.35)" : "rgba(124,58,237,0.3)"}` : "1px solid transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ opacity: active ? 1 : 0.6 }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {/* Account row: avatar · username · plan */}
          <div className="flex items-center gap-2.5 px-3 py-3 mb-1 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${planAccent}22` }}>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: planGradient, color: "#fff", boxShadow: `0 0 0 2px ${planAccent}40` }}>
              {(currentUser.username || currentUser.email)[0].toUpperCase()}
            </div>
            {/* Name + plan inline */}
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
              <span className="text-white/90 text-sm font-semibold truncate leading-none">
                {currentUser.username || currentUser.email.split("@")[0]}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none"
                style={{ background: planGradient, color: "#fff" }}>
                {planLabel}
              </span>
            </div>
          </div>
          {/* Logout */}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm w-full transition-colors"
            style={{ color: "rgba(255,255,255,0.35)", background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
          >
            {Icon.logout}
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex flex-col flex-1 min-h-screen min-w-0 lg:ml-[220px]">
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8"
          style={{
            height: 65,
            background: "rgba(15,23,42,0.85)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden flex-shrink-0 text-white/70 hover:text-white transition-colors"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h2 className="text-white/70 text-sm font-medium capitalize truncate">
              {activePage === "home" ? "Dashboard" : activePage === "mylinks" ? "My Links" : activePage === "admin" ? "Admin" : activePage}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {!quota?.isUnlimited && quota && (
              <span className="text-white/30 text-xs hidden sm:block">
                {quota.remainingUses} / {quota.usageLimit} uses
              </span>
            )}
            {(tier === "free" || tier === "pro" || tier === "team") && (
              <button
                type="button"
                onClick={() => setShowPlanModal(true)}
                className={`text-xs font-semibold px-4 py-1.5 rounded-full text-white border-none cursor-pointer ${
                  tier === "pro" ? "btn-shimmer-team" : "btn-shimmer-pro"
                }`}
              >
                {tier === "free"  ? "Upgrade" :
                 tier === "pro"   ? "Switch plan" :
                                    "Switch plan"}
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
