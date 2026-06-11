const handleRequest = require("./handleRequest");

class LinkController {
  constructor({ shortenService, unshortenService, subscriptionService, securityService, verificationService, linkModel, guestModel }) {
    this.shortenService = shortenService;
    this.unshortenService = unshortenService;
    this.subscriptionService = subscriptionService;
    this.securityService = securityService;
    this.verificationService = verificationService;
    this.linkModel = linkModel;
    this.guestModel = guestModel;

    this.getMe = this.getMe.bind(this);
    this.getGuestQuota = this.getGuestQuota.bind(this);
    this.shorten = this.shorten.bind(this);
    this.unshorten = this.unshorten.bind(this);
    this.redirect = this.redirect.bind(this);
    this.getQuota = this.getQuota.bind(this);
    this.getStats = this.getStats.bind(this);
    this.getStatsHistory = this.getStatsHistory.bind(this);
    this.checkSecurity = this.checkSecurity.bind(this);
    this.checkSecurityExtension = this.checkSecurityExtension.bind(this);
    this.getMyLinks = this.getMyLinks.bind(this);
    this.deleteLink = this.deleteLink.bind(this);
    this.updateLink = this.updateLink.bind(this);
    this.getLinkAnalytics = this.getLinkAnalytics.bind(this);
  }

  // Fire-and-forget geo lookup via ip-api.com (free tier, no key required)
  async geoLookup(ip) {
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return { country: "Local", city: null };
    }
    try {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json();
      if (data.status === "success") return { country: data.country, city: data.city };
    } catch {}
    return { country: null, city: null };
  }

  // userId comes from the JWT token (authenticated users) or defaults to 0 (guest).
  resolveUserId(req) {
    return req.user ? req.user.id : 0;
  }

  // Extract the real client IP (handles reverse proxy X-Forwarded-For)
  resolveIp(req) {
    return req.headers["x-forwarded-for"]?.split(",")[0].trim()
      || req.socket?.remoteAddress
      || "unknown";
  }

  // For guest requests: check remaining quota and consume one token.
  // Throws 403 if the guest IP has exhausted their lifetime limit.
  async enforceGuestLimit(req) {
    const ip = this.resolveIp(req);
    const result = await this.guestModel.checkAndConsume(ip);
    if (!result.allowed) {
      const err = new Error(
        `Guest limit reached (${result.limit} uses). Create a free account to keep using Xposelink.`,
      );
      err.status = 403;
      err.code = "GUEST_LIMIT_REACHED";
      throw err;
    }
    return result; // { used, limit, remaining }
  }

  async getMe(req, res) {
    return handleRequest(res, async () => {
      const user = await this.subscriptionService.getUserOrThrow(req.user.id);
      const quota = this.subscriptionService.buildQuota(user);
      return {
        user: { id: user.id, email: user.email, username: user.username, role: user.role },
        quota,
      };
    });
  }

  async getGuestQuota(req, res) {
    return handleRequest(res, async () => {
      const ip = this.resolveIp(req);
      const quota = await this.guestModel.getRemainingQuota(ip);
      return { quota };
    });
  }

  async shorten(req, res) {
    const userId = this.resolveUserId(req);
    return handleRequest(res, async () => {
      // Validate URL FIRST so we don't consume a guest token on invalid input
      if (!this.verificationService.verifyUrl(req.body.url)) {
        const err = new Error("Please provide a valid URL");
        err.status = 400;
        throw err;
      }
      if (userId === 0) await this.enforceGuestLimit(req);
      const result = await this.shortenService.shorten({
        url: req.body.url,
        userId,
        customAlias: req.body.customAlias,
        expiresAt: req.body.expiresAt,
      });
      // Bundle security check inline — avoids a second guest-token-consuming call from the client
      try {
        const sec = await this.securityService.check(req.body.url, this.verificationService);
        result.security = sec.data;
        await this.subscriptionService.incrementUserStats(userId, "security");
        if (sec.data.verdict === "malicious" || (sec.data.riskScore ?? 0) >= 70) {
          await this.subscriptionService.incrementUserStats(userId, "malicious");
        }
      } catch {
        // Security check failure shouldn't break shorten flow
      }
      return result;
    });
  }

  async getMyLinks(req, res) {
    const userId = this.resolveUserId(req);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = req.query.search || "";
    return handleRequest(res, () =>
      this.shortenService.getMyLinks(userId, { page, limit, search }),
    );
  }

  async deleteLink(req, res) {
    const userId = this.resolveUserId(req);
    const linkId = parseInt(req.params.id);
    return handleRequest(res, () =>
      this.shortenService.deleteLink(userId, linkId),
    );
  }

  async getLinkAnalytics(req, res) {
    const userId = this.resolveUserId(req);
    const linkId = parseInt(req.params.id);
    return handleRequest(res, async () => {
      if (!userId || userId === 0) {
        const error = new Error("Authentication required");
        error.status = 401;
        throw error;
      }

      const analytics = await this.linkModel.getAnalytics(linkId);
      if (!analytics) {
        const error = new Error("Link not found");
        error.status = 404;
        throw error;
      }

      // Check ownership (admin can see any)
      const link = await this.linkModel.findById(linkId);
      const tier = this.subscriptionService.tierOf(
        await this.subscriptionService.getUserOrThrow(userId),
      );
      if (link.user_id !== userId && tier !== "admin") {
        const error = new Error("You do not have permission to view this link's analytics");
        error.status = 403;
        throw error;
      }

      return { analytics };
    });
  }

  async updateLink(req, res) {
    const userId = this.resolveUserId(req);
    const linkId = parseInt(req.params.id);
    return handleRequest(res, () =>
      this.shortenService.updateLink(userId, linkId, {
        originalUrl: req.body.originalUrl,
        expiresAt: req.body.expiresAt,
      }),
    );
  }

  async unshorten(req, res) {
    const userId = this.resolveUserId(req);
    return handleRequest(res, async () => {
      // Validate URL FIRST so we don't consume a guest token on invalid input
      const { shortUrl } = req.body;
      const extractedCode = this.verificationService.extractShortCode(shortUrl);
      if (!extractedCode && !this.verificationService.verifyUrl(shortUrl)) {
        const err = new Error("Please provide a valid shortened URL");
        err.status = 400;
        throw err;
      }
      if (userId === 0) await this.enforceGuestLimit(req);
      const skipQuota = req.body.skipQuota === true;
      const result = await this.unshortenService.unshorten({
        shortUrl,
        userId,
        skipQuota,
      });
      // Note: token consumption + unshorten stat are handled inside unshortenService.unshorten
      // Bundle security check on the resolved destination — avoids a second guest-token-consuming call.
      // Skipped for the extension scan (skipQuota), which runs its own /security/check separately.
      if (!skipQuota && result?.data?.originalUrl) {
        try {
          const sec = await this.securityService.check(result.data.originalUrl, this.verificationService);
          result.security = sec.data;
          await this.subscriptionService.incrementUserStats(userId, "security");
          if (sec.data.verdict === "malicious" || (sec.data.riskScore ?? 0) >= 70) {
            await this.subscriptionService.incrementUserStats(userId, "malicious");
          }
        } catch {
          // Security check failure shouldn't break unshorten flow
        }
      }
      return result;
    });
  }

  async redirect(req, res) {
    try {
      const originalUrl = await this.unshortenService.redirect(req.params.shortCode);
      // Redirect immediately, then record the click in the background
      res.redirect(originalUrl);
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress;
      const userAgent = req.headers["user-agent"] || null;
      this.geoLookup(ip).then(({ country, city }) => {
        this.linkModel.recordClick(req.params.shortCode, { ip, userAgent, country, city }).catch(() => {});
      }).catch(() => {});
    } catch (error) {
      return res.status(error.status || 404).json({
        message: error.message || "Short link not found",
      });
    }
  }

  async getQuota(req, res) {
    return handleRequest(res, () =>
      this.subscriptionService.getQuotaStatus(req.params.userId),
    );
  }

  async getStats(req, res) {
    return handleRequest(res, async () => {
      const stats = await this.subscriptionService.getUserStats(req.params.userId);
      return { stats };
    });
  }

  async getStatsHistory(req, res) {
    return handleRequest(res, async () => {
      const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 14));
      const history = await this.subscriptionService.getStatsHistory(req.params.userId, days);
      return { history };
    });
  }

  async _runSecurityCheck(req, res, extensionOnly = false) {
    const userId = this.resolveUserId(req);
    const url = req.method === "GET" ? req.query.url : req.body.url;
    return handleRequest(res, async () => {
      if (userId === 0) {
        if (extensionOnly) {
          const err = new Error("Sign in with a Pro or higher account to use the extension.");
          err.status = 401;
          throw err;
        }
        await this.enforceGuestLimit(req);
      } else {
        const user = await this.subscriptionService.getUserOrThrow(userId);
        if (extensionOnly && !this.subscriptionService.isSecurityUnlimited(user)) {
          const err = new Error("Extension security checks require a Pro or higher plan.");
          err.status = 403;
          err.code = "UPGRADE_REQUIRED";
          throw err;
        }
        if (!extensionOnly && !this.subscriptionService.isSecurityUnlimited(user)) {
          await this.subscriptionService.consumeUsage(userId);
        }
      }
      const result = await this.securityService.check(url, this.verificationService);
      await this.subscriptionService.incrementUserStats(userId, "security");
      if (result.data?.verdict === "malicious" || (result.data?.riskScore ?? 0) >= 70) {
        await this.subscriptionService.incrementUserStats(userId, "malicious");
      }
      return result;
    });
  }

  async checkSecurity(req, res) {
    return this._runSecurityCheck(req, res, false);
  }

  async checkSecurityExtension(req, res) {
    return this._runSecurityCheck(req, res, true);
  }
}

module.exports = LinkController;
