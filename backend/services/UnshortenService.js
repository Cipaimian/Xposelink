// Domains that require JavaScript or a login session to redirect —
// server-side resolution is impossible for these.
const KNOWN_BLOCKED = new Set([
  "t.co",
  "cutt.ly",
  "is.gd",
  "v.gd",
  "rb.gy",
]);

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Services that redirect via JavaScript — they expose a public REST API instead.
const JS_REDIRECT_APIS = {
  "encurtador.dev":     "encurtador",
  "www.encurtador.dev": "encurtador",
};

const MAX_HOPS = 10;

const BROWSER_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

class UnshortenService {
  constructor({ linkModel, subscriptionService, verificationService, publicBaseUrl }) {
    this.linkModel = linkModel;
    this.subscriptionService = subscriptionService;
    this.verificationService = verificationService;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
  }

  buildShortUrl(shortCode) {
    return `${this.publicBaseUrl}/${shortCode}`;
  }

  async resolveShortCode(shortCode) {
    const link = await this.linkModel.findByShortCode(shortCode);
    if (!link) {
      const error = new Error("Short link not found");
      error.status = 404;
      throw error;
    }
    return link;
  }

  async resolveViaHttp(startUrl) {
    // redirect:manual captures the raw Location header before following into
    // any interstitial or preview page that would return 200 + JS redirect.
    try {
      const manual = await fetchWithTimeout(startUrl, {
        method: "GET",
        redirect: "manual",
        headers: BROWSER_HEADERS,
      });
      if (manual.status >= 300 && manual.status < 400) {
        const loc = manual.headers.get("location");
        if (loc) return new URL(loc, startUrl).href;
      }
    } catch {}

    let response = await fetchWithTimeout(startUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: BROWSER_HEADERS,
    });

    if (response.status >= 400) {
      response = await fetchWithTimeout(startUrl, {
        method: "GET",
        redirect: "follow",
        headers: BROWSER_HEADERS,
      });
    }

    if (response.status >= 400) return null;
    return response.url || startUrl;
  }

  async resolveViaEncurtador(pathname) {
    const parts = pathname.replace(/^\//, "").split("/");
    const code = parts[parts.length - 1];
    if (!code) return null;
    const res = await fetchWithTimeout(`https://dr-api.encurtador.dev/encurtamentos/${code}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.url || null;
  }

  async resolveViaUnshortenMe(startUrl) {
    const response = await fetchWithTimeout(
      `https://unshorten.me/s/${encodeURIComponent(startUrl)}`,
      { headers: { "User-Agent": "curl/7.88.1", "Accept": "*/*" } },
    );
    if (!response.ok) return null;
    const text = (await response.text()).trim();
    if (!text || text === startUrl) return null;
    try { new URL(text); } catch { return null; }
    return text;
  }

  async followRedirectChain(url) {
    const startUrl = this.verificationService.normalizeUrl(url);
    if (!startUrl) {
      const error = new Error("Please provide a valid shortened URL");
      error.status = 400;
      throw error;
    }

    const startHostname = new URL(startUrl).hostname;
    if (KNOWN_BLOCKED.has(startHostname)) {
      const error = new Error(
        `${startHostname} blocks automated URL expansion (requires JavaScript or a login session). Try pasting the link in a browser instead.`,
      );
      error.status = 422;
      throw error;
    }

    const chain = [];
    let current = startUrl;

    for (let hop = 0; hop < MAX_HOPS; hop++) {
      if (chain.includes(current)) break;
      chain.push(current);

      const { hostname, pathname } = new URL(current);
      let next = null;

      // 1. Service-specific API (JS-redirect shorteners)
      const apiType = JS_REDIRECT_APIS[hostname];
      if (apiType === "encurtador") {
        next = await this.resolveViaEncurtador(pathname).catch(() => null);
      }

      // 2. Generic HTTP redirect
      if (!next) {
        const resolved = await this.resolveViaHttp(current).catch(() => null);
        if (resolved && resolved !== current) next = resolved;
      }

      // 3. unshorten.me last-resort
      if (!next) {
        next = await this.resolveViaUnshortenMe(current).catch(() => null);
      }

      if (!next || next === current) break;

      const nextHostname = (() => { try { return new URL(next).hostname; } catch { return ""; } })();
      if (KNOWN_BLOCKED.has(nextHostname)) break;

      current = next;
    }

    if (!chain.includes(current)) chain.push(current);

    if (chain.length === 1 && chain[0] === startUrl) {
      const error = new Error(
        "Unable to resolve this URL. The service may be blocking all automated requests.",
      );
      error.status = 422;
      throw error;
    }

    return { originalUrl: current, redirectChain: chain };
  }

  async unshorten({ shortUrl, userId, skipQuota = false }) {
    const extractedCode = this.verificationService.extractShortCode(shortUrl);
    if (!extractedCode && !this.verificationService.verifyUrl(shortUrl)) {
      const error = new Error("Please provide a valid shortened URL");
      error.status = 400;
      throw error;
    }

    // Unshorten consumes a token (same model as shorten). Throws QUOTA_EXCEEDED
    // when a non-admin tier is out of tokens; guests are handled by the guest limit.
    // skipQuota is for the extension's click-interception scan: it resolves the URL
    // automatically, so it's free — but only for Pro+ tiers (who already have free
    // security checks). Non-Pro callers are charged normally even if they pass the flag.
    let quota;
    const freeScan =
      skipQuota &&
      this.subscriptionService.isSecurityUnlimited(
        await this.subscriptionService.getUserOrThrow(userId),
      );
    if (freeScan) {
      const { quota: q } = await this.subscriptionService.getQuotaStatus(userId);
      quota = q;
    } else {
      ({ quota } = await this.subscriptionService.consumeUsage(userId));
    }
    await this.subscriptionService.incrementUserStats(userId, "unshorten");

    if (extractedCode) {
      const existingLink = await this.linkModel.findByShortCode(extractedCode);
      if (existingLink) {
        return {
          message: "Original URL resolved from Xpose Link storage",
          data: {
            shortCode: existingLink.short_code,
            shortUrl: this.buildShortUrl(existingLink.short_code),
            originalUrl: existingLink.original_url,
            redirectChain: [this.buildShortUrl(existingLink.short_code)],
            source: "database",
          },
          quota,
        };
      }
    }

    try {
      const resolved = await this.followRedirectChain(shortUrl);
      return {
        message: "Original URL resolved successfully",
        data: {
          shortCode: extractedCode,
          shortUrl,
          originalUrl: resolved.originalUrl,
          redirectChain: resolved.redirectChain,
          source: "network",
        },
        quota,
      };
    } catch (error) {
      error.message = error.message || "Unable to unshorten the URL. The target may be unreachable.";
      throw error;
    }
  }

  // Used by the redirect route: /:shortCode
  async redirect(shortCode) {
    const link = await this.resolveShortCode(shortCode);

    if (link.status === "deleted") {
      const error = new Error("This short link has been deleted");
      error.status = 410;
      throw error;
    }

    if (link.expires_at && new Date(link.expires_at) <= new Date()) {
      const error = new Error("This short link has expired");
      error.status = 410;
      throw error;
    }

    await this.linkModel.incrementVisitCount(shortCode);
    return link.original_url;
  }
}

module.exports = UnshortenService;
