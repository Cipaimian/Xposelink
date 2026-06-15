// 7 days in seconds
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

// Derive the cookie domain from FRONTEND_URL so the same cookie is shared
// between the SPA (xposelink.site) and the API (api.xposelink.site).
// On localhost we leave it undefined — browsers reject domain attrs on localhost.
function cookieDomain() {
  if (process.env.COOKIE_DOMAIN) return process.env.COOKIE_DOMAIN;
  try {
    const hostname = new URL(process.env.FRONTEND_URL || "").hostname;
    if (!hostname || hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return undefined;
    const parts = hostname.replace(/^www\./, "").split(".");
    // Use leading-dot apex domain so it covers all subdomains: .xposelink.site
    return parts.length >= 2 ? `.${parts.slice(-2).join(".")}` : undefined;
  } catch {
    return undefined;
  }
}

function buildCookieOptions() {
  const frontendUrl = process.env.FRONTEND_URL || "";
  const isHttps = frontendUrl.startsWith("https://");
  const opts = {
    httpOnly: true,
    secure: isHttps,
    // SameSite=None requires Secure (HTTPS); browsers drop a None cookie sent
    // over plain HTTP. Fall back to Lax for HTTP same-origin deploys so login
    // works. None is kept on HTTPS for cross-origin (e.g. the extension).
    sameSite: isHttps ? "none" : "lax",
    maxAge: COOKIE_MAX_AGE * 1000,
    path: "/",
  };
  const domain = cookieDomain();
  if (domain) opts.domain = domain;
  return opts;
}

class AuthController {
  constructor(authService) {
    this.authService = authService;

    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.verifyEmail = this.verifyEmail.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.deleteAccount = this.deleteAccount.bind(this);
  }

  async register(req, res) {
    try {
      const { email, username, password } = req.body;
      const result = await this.authService.register({ email, username, password });
      if (result.ok) {
        this.authService.sendVerificationEmail(result.data.id, email).catch(() => {});
      }
      return res
        .status(result.status)
        .json({ message: result.message, data: result.data || null });
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async login(req, res) {
    try {
      const { identifier, email, password } = req.body;
      const result = await this.authService.login({ identifier: identifier || email, password });
      if (result.ok && result.data?.token) {
        res.cookie("xposelink_token", result.data.token, buildCookieOptions());
      }
      return res
        .status(result.status)
        .json({ message: result.message, data: result.data || null });
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async logout(req, res) {
    res.clearCookie("xposelink_token", { ...buildCookieOptions(), maxAge: 0 });
    return res.status(200).json({ message: "Logged out" });
  }

  async forgotPassword(req, res) {
    try {
      const result = await this.authService.forgotPassword({ email: req.body.email });
      return res.status(result.status).json({ message: result.message });
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async resetPassword(req, res) {
    try {
      const result = await this.authService.resetPassword({
        token: req.body.token || req.query.token,
        password: req.body.password,
      });
      return res.status(result.status).json({ message: result.message });
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async changePassword(req, res) {
    try {
      const result = await this.authService.changePassword({
        userId: req.user.id,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
      });
      return res.status(result.status).json({ message: result.message });
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async deleteAccount(req, res) {
    try {
      const result = await this.authService.deleteAccount({ userId: req.user.id });
      return res.status(result.status).json({ message: result.message });
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async verifyEmail(req, res) {
    try {
      const result = await this.authService.verifyEmail({
        token: req.body.token || req.query.token,
      });
      return res.status(result.status).json({ message: result.message });
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

module.exports = AuthController;
