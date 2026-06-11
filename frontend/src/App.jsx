import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import AuthPanel from "./components/AuthPanel";
import LandingPage from "./components/LandingPage";
import { apiFetch } from "./config";
import "./App.css";

// Dashboard is heavy (recharts + qrcode) — lazy-load so guests don't pay the cost
const Dashboard = lazy(() => import("./components/Dashboard"));

function DashboardFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "#0f172a" }}>
      <p className="text-white/40 text-sm">Loading dashboard…</p>
    </div>
  );
}

/* ── Simple email verification landing ── */
function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("invalid");
      return;
    }
    apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.message?.toLowerCase().includes("success") ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a2d5a 100%)" }}>
      <div className="rounded-2xl p-10 text-center max-w-sm w-full mx-4"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
        {status === "loading" && <p className="text-white/60">Verifying…</p>}
        {status === "ok"      && <>
          <p className="text-emerald-400 text-2xl mb-2">✓</p>
          <p className="text-white font-semibold mb-1">Email verified!</p>
          <p className="text-white/40 text-sm mb-6">Your account is now verified.</p>
          <button onClick={() => navigate("/login")} className="text-violet-400 text-sm cursor-pointer border-none bg-transparent">Sign in →</button>
        </>}
        {(status === "error" || status === "invalid") && <>
          <p className="text-red-400 text-2xl mb-2">✕</p>
          <p className="text-white font-semibold mb-1">Verification failed</p>
          <p className="text-white/40 text-sm mb-6">The link is invalid or already used.</p>
          <button onClick={() => navigate("/login")} className="text-violet-400 text-sm cursor-pointer border-none bg-transparent">Back to sign in →</button>
        </>}
      </div>
    </div>
  );
}

const FADE_MS = 220;

/* ── Inner app — has access to useNavigate ── */
function AppRoutes() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [visible, setVisible]         = useState(true);

  // Bootstrap session from HTTPOnly cookie on mount
  useEffect(() => {
    apiFetch("/api/users/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setCurrentUser(d.user);
      })
      .catch(() => {})
      .finally(() => setBootstrapping(false));
  }, []);

  const transition = (callback) => {
    setVisible(false);
    setTimeout(() => { callback(); setVisible(true); }, FADE_MS);
  };

  const handleLoginClick  = () => transition(() => navigate("/login"));
  const handleSignUpClick = () => transition(() => navigate("/register"));

  const handleAuthenticated = (user) =>
    transition(() => {
      setCurrentUser(user);
      localStorage.removeItem("xposelink_guest_tokens"); // reset so guest counter starts fresh on next logout
      navigate("/dashboard");
    });

  const handleLogout = () =>
    transition(() => {
      apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      setCurrentUser(null);
      navigate("/");
    });

  // Wait for session bootstrap before rendering routes (avoids login flicker)
  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a2d5a 100%)" }}>
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}>
      <Routes>
        {/* Landing */}
        <Route
          path="/"
          element={
            currentUser
              ? <Navigate to="/dashboard" replace />
              : <LandingPage onLoginClick={handleLoginClick} onSignUpClick={handleSignUpClick} />
          }
        />

        {/* Login */}
        <Route
          path="/login"
          element={
            currentUser
              ? <Navigate to="/dashboard" replace />
              : <AuthPanel
                  initialMode="login"
                  onAuthenticated={handleAuthenticated}
                  onBack={() => transition(() => navigate("/"))}
                />
          }
        />

        {/* Register */}
        <Route
          path="/register"
          element={
            currentUser
              ? <Navigate to="/dashboard" replace />
              : <AuthPanel
                  initialMode="register"
                  onAuthenticated={handleAuthenticated}
                  onBack={() => transition(() => navigate("/"))}
                />
          }
        />

        {/* Forgot password */}
        <Route
          path="/forgot-password"
          element={
            currentUser
              ? <Navigate to="/dashboard" replace />
              : <AuthPanel
                  initialMode="forgot"
                  onAuthenticated={handleAuthenticated}
                  onBack={() => transition(() => navigate("/login"))}
                />
          }
        />

        {/* Reset password — token comes via ?token=... query param */}
        <Route
          path="/reset-password"
          element={
            <AuthPanel
              initialMode="reset"
              onAuthenticated={handleAuthenticated}
              onBack={() => transition(() => navigate("/login"))}
            />
          }
        />

        {/* Email verification */}
        <Route
          path="/verify-email"
          element={<VerifyEmailPage />}
        />

        {/* Dashboard — protected */}
        <Route
          path="/dashboard"
          element={
            currentUser
              ? (
                  <Suspense fallback={<DashboardFallback />}>
                    <Dashboard currentUser={currentUser} onLogout={handleLogout} />
                  </Suspense>
                )
              : <Navigate to="/login" replace />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
