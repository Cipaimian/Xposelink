import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../config";

function XposeLogo() {
  return (
    <span className="font-sans tracking-tight text-white select-none">
      <span className="text-3xl font-semibold">X</span>
      <span className="text-2xl font-light">pose</span>
      <span className="text-2xl font-light">link</span>
    </span>
  );
}

const inputCls = "w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all";
const inputStyle = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" };
const onFocus  = (e) => (e.target.style.borderColor = "rgba(124,58,237,0.7)");
const onBlur   = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)");

function AuthPanel({ onAuthenticated, initialMode = "login", onBack }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // mode: "login" | "register" | "forgot" | "reset"
  const [mode, setMode] = useState(initialMode);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const showMsg = (text, type = "error") => { setMessage(text); setMessageType(type); };
  const clearMsg = () => setMessage("");

  /* ── Login / Register ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMsg();
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const body = mode === "login"
        ? { identifier: email, password }
        : { email, username, password };
      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) { showMsg(payload.message || "Authentication failed"); return; }

      if (mode === "register") {
        showMsg("Account created! You can now sign in.", "success");
        setMode("login");
        setPassword("");
        return;
      }

      // Cookie is set by backend on login; just pass user info up
      onAuthenticated({
        id: payload.data.id,
        email: payload.data.email,
        username: payload.data.username,
        role: payload.data.role,
      });
    } catch {
      showMsg("Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  };

  /* ── Forgot password ── */
  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMsg();
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const payload = await res.json();
      showMsg(payload.message, res.ok ? "success" : "error");
    } catch {
      showMsg("Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  };

  /* ── Reset password ── */
  const resetToken = searchParams.get("token") || "";
  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMsg();
    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, password }),
      });
      const payload = await res.json();
      if (res.ok) {
        showMsg(payload.message, "success");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        showMsg(payload.message || "Reset failed");
      }
    } catch {
      showMsg("Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  };

  const goLogin = () => { clearMsg(); setPassword(""); navigate("/login"); setMode("login"); };

  /* ── Heading / subtitle per mode ── */
  const headings = {
    login:    { title: "Sign in to your account",   sub: null },
    register: { title: "Create an account",          sub: null },
    forgot:   { title: "Forgot your password?",      sub: "Enter your email and we'll send a reset link." },
    reset:    { title: "Set a new password",         sub: resetToken ? null : "No reset token found. Request a new link." },
  };
  const { title, sub } = headings[mode] ?? headings.login;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a1f3a 50%, #0f172a 100%)" }}
    >
      {/* Ambient blobs */}
      <div className="absolute rounded-full pointer-events-none"
        style={{ width: 600, height: 600, top: "-200px", left: "-100px",
          background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)",
          animation: "floatBlob 18s ease-in-out infinite" }} />
      <div className="absolute rounded-full pointer-events-none"
        style={{ width: 500, height: 500, bottom: "-150px", right: "-80px",
          background: "radial-gradient(circle, rgba(66,133,244,0.10) 0%, transparent 65%)",
          animation: "floatBlob 22s ease-in-out infinite", animationDelay: "-8s" }} />

      <div className="relative z-10 w-full mx-4" style={{ maxWidth: 440 }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <XposeLogo />
          <p className="text-white/40 text-sm mt-2">Protect, shorten, and inspect every URL</p>
        </div>

        <div className="rounded-2xl p-8"
          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.10)" }}>

          <h2 className="text-white text-xl font-semibold mb-1">{title}</h2>
          {sub && <p className="text-white/40 text-sm mb-5">{sub}</p>}
          {!sub && <div className="mb-6" />}

          {/* ── LOGIN / REGISTER form ── */}
          {(mode === "login" || mode === "register") && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === "login" ? (
                <input type="text" placeholder="Username or email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              ) : (
                <>
                  <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                    required className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  <input type="text" placeholder="Username (letters, numbers, _ -)" value={username} onChange={(e) => setUsername(e.target.value)}
                    required className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </>
              )}

              <input type="password" placeholder="Password (minimum 8 characters)" value={password}
                onChange={(e) => setPassword(e.target.value)}
                required className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />

              {message && (
                <div className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: messageType === "error" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                    border: `1px solid ${messageType === "error" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                    color: messageType === "error" ? "#fca5a5" : "#6ee7b7",
                  }}>
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white mt-1 transition-opacity border-none"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}>
                {loading ? "Processing..." : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          )}

          {/* ── FORGOT PASSWORD form ── */}
          {mode === "forgot" && (
            <form onSubmit={handleForgot} className="flex flex-col gap-4">
              <input type="email" placeholder="Your registered email" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />

              {message && (
                <div className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: messageType === "error" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                    border: `1px solid ${messageType === "error" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                    color: messageType === "error" ? "#fca5a5" : "#6ee7b7",
                  }}>
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white border-none"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}>
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          {/* ── RESET PASSWORD form ── */}
          {mode === "reset" && resetToken && (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <input type="password" placeholder="New password (minimum 8 characters)" value={password}
                onChange={(e) => setPassword(e.target.value)} required
                className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />

              {message && (
                <div className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: messageType === "error" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                    border: `1px solid ${messageType === "error" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                    color: messageType === "error" ? "#fca5a5" : "#6ee7b7",
                  }}>
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white border-none"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}>
                {loading ? "Saving..." : "Set new password"}
              </button>
            </form>
          )}

          {/* ── Footer links ── */}
          <div className="flex items-center justify-center gap-2 mt-5 text-sm flex-wrap">
            {(mode === "login" || mode === "register") && (
              <>
                {mode === "register" && (
                  <span className="text-white/40">Already have an account?</span>
                )}
                <button type="button"
                  onClick={() => { clearMsg(); navigate(mode === "login" ? "/register" : "/login"); setMode(mode === "login" ? "register" : "login"); }}
                  className="text-violet-400 font-medium hover:text-violet-300 transition-colors border-none cursor-pointer"
                  style={{ background: "none" }}>
                  {mode === "login" ? "Create account" : "Sign in"}
                </button>
                {mode === "login" && (
                  <>
                    <span className="text-white/20">·</span>
                    <button type="button"
                      onClick={() => { clearMsg(); navigate("/forgot-password"); setMode("forgot"); }}
                      className="text-white/40 hover:text-white/70 transition-colors border-none cursor-pointer"
                      style={{ background: "none" }}>
                      Forgot password?
                    </button>
                  </>
                )}
              </>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button type="button" onClick={goLogin}
                className="text-violet-400 font-medium hover:text-violet-300 transition-colors border-none cursor-pointer"
                style={{ background: "none" }}>
                ← Back to sign in
              </button>
            )}
          </div>

        </div>

        {/* Back to home */}
        {onBack && (
          <button type="button" onClick={onBack}
            className="mt-6 w-full text-center text-white/30 text-sm hover:text-white/60 transition-colors border-none cursor-pointer"
            style={{ background: "none" }}>
            ← Back to home
          </button>
        )}
      </div>
    </div>
  );
}

export default AuthPanel;
