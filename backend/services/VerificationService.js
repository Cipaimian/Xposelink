class VerificationService {
  verifyEmail(email) {
    if (!email || typeof email !== "string") {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  normalizeUrl(url) {
    if (!url || typeof url !== "string") {
      return null;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return null;
    }

    try {
      const parsedUrl = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return null;
      }

      return parsedUrl.toString();
    } catch {
      try {
        const parsedUrl = new URL(`https://${trimmedUrl}`);
        return parsedUrl.toString();
      } catch {
        return null;
      }
    }
  }

  verifyUrl(url) {
    return Boolean(this.normalizeUrl(url));
  }

  verifyAlias(alias) {
    if (!alias || typeof alias !== "string") {
      return false;
    }

    return /^[A-Za-z0-9_-]{4,40}$/.test(alias.trim());
  }

  extractShortCode(input) {
    if (!input || typeof input !== "string") {
      return null;
    }

    const value = input.trim();
    if (!value) {
      return null;
    }

    if (this.verifyAlias(value)) {
      return value;
    }

    try {
      const parsedUrl = new URL(value);
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      if (!segments.length) {
        return null;
      }

      return segments[segments.length - 1];
    } catch {
      return null;
    }
  }
}

module.exports = VerificationService;
