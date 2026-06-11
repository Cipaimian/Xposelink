// Tier limits for shorten usage
const TIER_LIMITS = {
  free: 10,
  pro:  50,
  team: 100,
};

// Upgrade-only: higher number = higher tier
const TIER_ORDER = { free: 0, pro: 1, team: 2, admin: 3 };

class SubscriptionService {
  constructor({ userModel }) {
    this.userModel = userModel;
  }

  isSecurityUnlimited(user) {
    const tier = this.tierOf(user);
    return tier === "pro" || tier === "team" || tier === "admin";
  }

  tierOf(user) {
    if (user.role === "admin") return "admin";
    // treat legacy "subscribed" as "pro"
    const status = user.subscription_status;
    if (status === "team") return "team";
    if (status === "pro" || status === "subscribed") return "pro";
    return "free";
  }

  buildQuota(user) {
    const tier = this.tierOf(user);
    const isUnlimited = tier === "admin";
    const limit = isUnlimited ? null : TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const used = Number.isInteger(user.usage_count) ? user.usage_count : 0;
    const remaining = isUnlimited ? null : Math.max(0, limit - used);

    return {
      role: user.role === "admin" ? "admin" : "user",
      subscriptionStatus: user.subscription_status,
      tier,
      usageCount: used,
      usageLimit: limit,
      remainingUses: remaining,
      isUnlimited,
    };
  }

  async getUserOrThrow(userId) {
    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId) || numericUserId < 0) {
      const error = new Error("A valid userId is required");
      error.status = 400;
      throw error;
    }

    if (numericUserId === 0) {
      return { id: 0, email: "guest", role: "user", subscription_status: "free", usage_count: 0 };
    }

    const user = await this.userModel.findById(numericUserId);
    if (!user) {
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }

    return user;
  }

  async getQuotaStatus(userId) {
    const user = await this.getUserOrThrow(userId);
    return {
      user: { id: user.id, email: user.email },
      quota: this.buildQuota(user),
    };
  }

  async consumeUsage(userId) {
    const user = await this.getUserOrThrow(userId);
    const quota = this.buildQuota(user);

    if (!quota.isUnlimited && quota.remainingUses <= 0) {
      const error = new Error(
        `Your ${quota.tier} plan has ${quota.usageLimit} shorten tokens per period. Upgrade to get more.`,
      );
      error.status = 403;
      error.code = "QUOTA_EXCEEDED";
      throw error;
    }

    // Guest (id=0) has no DB row — treat as unlimited server-side
    const updatedUser = (quota.isUnlimited || user.id === 0)
      ? user
      : await this.userModel.incrementUsage(user.id);

    return {
      user: updatedUser,
      quota: this.buildQuota(updatedUser),
    };
  }

  async getUserStats(userId) {
    const numericId = Number(userId);
    if (numericId === 0) return { shorten: 0, unshorten: 0, security: 0, malicious: 0 };
    return this.userModel.getStats(numericId);
  }

  async getStatsHistory(userId, days = 14) {
    const numericId = Number(userId);
    if (numericId === 0) return [];
    return this.userModel.getStatsHistory(numericId, days);
  }

  async incrementUserStats(userId, key, amount = 1) {
    const numericId = Number(userId);
    if (numericId === 0) return; // guests have no persistent stats
    await this.userModel.incrementStats(numericId, key, amount);
  }

  async upgradeSubscription(userId, plan = "pro", { force = false } = {}) {
    if (!["free", "pro", "team"].includes(plan)) {
      const error = new Error("Invalid plan. Choose 'pro' or 'team'.");
      error.status = 400;
      throw error;
    }

    const user = await this.getUserOrThrow(userId);
    const currentTier = this.tierOf(user);

    if (!force && (TIER_ORDER[plan] ?? 0) <= (TIER_ORDER[currentTier] ?? 0)) {
      const error = new Error(
        currentTier === plan
          ? `You are already on the ${plan} plan.`
          : `Cannot downgrade from ${currentTier} to ${plan}. Plan changes are upgrade-only.`,
      );
      error.status = 400;
      throw error;
    }

    const updatedUser = await this.userModel.upgradeSubscription(userId, plan);

    return {
      user: { id: updatedUser.id, email: updatedUser.email },
      quota: this.buildQuota(updatedUser),
    };
  }
}

module.exports = SubscriptionService;
