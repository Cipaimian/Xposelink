const GUEST_LIMIT = 3;

class GuestModel {
  constructor(pool) {
    this.pool = pool;
  }

  // Normalize IP — strip IPv6 prefix so ::ffff:1.2.3.4 → 1.2.3.4
  normalizeIp(ip) {
    if (!ip) return "unknown";
    return ip.replace(/^::ffff:/, "");
  }

  async getUsage(rawIp) {
    const ip = this.normalizeIp(rawIp);
    const [rows] = await this.pool.query(
      "SELECT usage_count FROM guest_usage WHERE ip = ? LIMIT 1",
      [ip],
    );
    return rows[0]?.usage_count ?? 0;
  }

  // Returns { allowed: bool, used: number, limit: number, remaining: number }
  async checkAndConsume(rawIp) {
    const ip = this.normalizeIp(rawIp);

    // Upsert: insert if not exists, increment if exists
    await this.pool.query(
      `INSERT INTO guest_usage (ip, usage_count) VALUES (?, 1)
       ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
      [ip],
    );

    const [rows] = await this.pool.query(
      "SELECT usage_count FROM guest_usage WHERE ip = ? LIMIT 1",
      [ip],
    );
    const used = rows[0]?.usage_count ?? 1;

    // If this increment pushed us over the limit, it was not allowed
    const allowed = used <= GUEST_LIMIT;

    if (!allowed) {
      // Roll back the increment — guest is over limit, don't count it
      await this.pool.query(
        "UPDATE guest_usage SET usage_count = usage_count - 1 WHERE ip = ?",
        [ip],
      );
    }

    return {
      allowed,
      used:      allowed ? used : used - 1,
      limit:     GUEST_LIMIT,
      remaining: Math.max(0, GUEST_LIMIT - (allowed ? used : used - 1)),
    };
  }

  async getRemainingQuota(rawIp) {
    const used = await this.getUsage(rawIp);
    return {
      used,
      limit:     GUEST_LIMIT,
      remaining: Math.max(0, GUEST_LIMIT - used),
    };
  }
}

module.exports = GuestModel;
