const crypto = require("crypto");

class ShortenService {
  constructor({ linkModel, subscriptionService, verificationService, publicBaseUrl }) {
    this.linkModel = linkModel;
    this.subscriptionService = subscriptionService;
    this.verificationService = verificationService;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
  }

  buildShortUrl(shortCode) {
    return `${this.publicBaseUrl}/${shortCode}`;
  }

  async generateUniqueCode() {
    let shortCode;
    let existing;

    do {
      shortCode = crypto.randomBytes(4).toString("base64url").slice(0, 6);
      existing = await this.linkModel.findByShortCode(shortCode);
    } while (existing);

    return shortCode;
  }

  async shorten({ url, userId, customAlias, expiresAt }) {
    const normalizedUrl = this.verificationService.normalizeUrl(url);
    if (!normalizedUrl) {
      const error = new Error("Please provide a valid URL");
      error.status = 400;
      throw error;
    }

    const requestedAlias = customAlias?.trim() || "";
    const user = await this.subscriptionService.getUserOrThrow(userId);
    const tier = this.subscriptionService.tierOf(user);
    const canUseAlias = tier === "pro" || tier === "team" || tier === "admin";

    if (requestedAlias && !this.verificationService.verifyAlias(requestedAlias)) {
      const error = new Error(
        "Custom alias must be 4-40 characters and contain only letters, numbers, underscore, or hyphen",
      );
      error.status = 400;
      throw error;
    }

    if (requestedAlias && !canUseAlias) {
      const error = new Error(
        "Custom short links are available only for Pro and Team users",
      );
      error.status = 403;
      throw error;
    }

    // Validate and parse expiresAt if provided
    let parsedExpiry = null;
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime())) {
        const error = new Error("Invalid expiry date format");
        error.status = 400;
        throw error;
      }
      if (expDate <= new Date()) {
        const error = new Error("Expiry date must be in the future");
        error.status = 400;
        throw error;
      }
      parsedExpiry = expDate.toISOString();
    }

    // Check alias availability BEFORE consuming quota so failed attempts don't waste tokens
    let shortCode = requestedAlias;
    if (shortCode) {
      const existingAlias = await this.linkModel.findByShortCode(shortCode);
      if (existingAlias) {
        const error = new Error("Custom alias is already in use");
        error.status = 409;
        throw error;
      }
    } else {
      shortCode = await this.generateUniqueCode();
    }

    const { quota } = await this.subscriptionService.consumeUsage(userId);

    const link = await this.linkModel.create({
      originalUrl: normalizedUrl,
      shortCode,
      userId: user.id,
      isCustom: Boolean(requestedAlias),
      expiresAt: parsedExpiry,
    });

    await this.subscriptionService.incrementUserStats(user.id, "shorten");

    return {
      message: "Short link created successfully",
      data: {
        id: link.id,
        originalUrl: link.original_url,
        shortCode: link.short_code,
        shortUrl: this.buildShortUrl(link.short_code),
        isCustom: link.is_custom,
        expiresAt: link.expires_at,
        status: link.status,
        visitCount: link.visit_count,
        createdAt: link.created_at,
      },
      quota,
    };
  }

  // List all active links owned by the authenticated user
  async getMyLinks(userId, { page = 1, limit = 20, search = "" } = {}) {
    if (!userId || userId === 0) {
      const error = new Error("Authentication required to view your links");
      error.status = 401;
      throw error;
    }

    const result = await this.linkModel.findByUserId(userId, { page, limit, search });

    return {
      message: "Links retrieved successfully",
      data: result.items.map((link) => ({
        id: link.id,
        originalUrl: link.original_url,
        shortCode: link.short_code,
        shortUrl: this.buildShortUrl(link.short_code),
        isCustom: link.is_custom,
        expiresAt: link.expires_at,
        status: link.status,
        visitCount: link.visit_count,
        createdAt: link.created_at,
        isExpired: link.expires_at ? new Date(link.expires_at) <= new Date() : false,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  // Update a link's original_url and/or expires_at (owner or admin)
  async updateLink(userId, linkId, { originalUrl, expiresAt }) {
    if (!userId || userId === 0) {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }

    const link = await this.linkModel.findById(linkId);
    if (!link) {
      const error = new Error("Link not found");
      error.status = 404;
      throw error;
    }

    const tier = this.subscriptionService.tierOf(
      await this.subscriptionService.getUserOrThrow(userId),
    );
    if (link.user_id !== userId && tier !== "admin") {
      const error = new Error("You do not have permission to edit this link");
      error.status = 403;
      throw error;
    }

    const updates = {};

    if (originalUrl !== undefined) {
      const normalized = this.verificationService.normalizeUrl(originalUrl);
      if (!normalized) {
        const error = new Error("Please provide a valid URL");
        error.status = 400;
        throw error;
      }
      updates.originalUrl = normalized;
    }

    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === "") {
        updates.expiresAt = null;
      } else {
        const expDate = new Date(expiresAt);
        if (isNaN(expDate.getTime())) {
          const error = new Error("Invalid expiry date format");
          error.status = 400;
          throw error;
        }
        updates.expiresAt = expDate.toISOString();
      }
    }

    const updated = await this.linkModel.update(linkId, updates);

    return {
      message: "Link updated successfully",
      data: {
        id: updated.id,
        originalUrl: updated.original_url,
        shortCode: updated.short_code,
        shortUrl: this.buildShortUrl(updated.short_code),
        isCustom: updated.is_custom,
        expiresAt: updated.expires_at,
        status: updated.status,
        visitCount: updated.visit_count,
        createdAt: updated.created_at,
      },
    };
  }

  // Soft-delete a link by ID (owner only)
  async deleteLink(userId, linkId) {
    if (!userId || userId === 0) {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }

    const link = await this.linkModel.findById(linkId);
    if (!link) {
      const error = new Error("Link not found");
      error.status = 404;
      throw error;
    }

    const tier = this.subscriptionService.tierOf(
      await this.subscriptionService.getUserOrThrow(userId),
    );
    if (link.user_id !== userId && tier !== "admin") {
      const error = new Error("You do not have permission to delete this link");
      error.status = 403;
      throw error;
    }

    // Pass null as userId for admins so the owner check in softDelete is bypassed
    const effectiveUserId = tier === "admin" ? null : userId;
    const deleted = await this.linkModel.softDelete(linkId, effectiveUserId);
    if (!deleted) {
      const error = new Error("Link not found or already deleted");
      error.status = 404;
      throw error;
    }

    return { message: "Link deleted successfully" };
  }
}

module.exports = ShortenService;
