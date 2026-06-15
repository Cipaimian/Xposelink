class UserModel {
  constructor(pool) {
    this.pool = pool;
  }

  normalizeUser(row) {
    const validStatuses = ["free", "pro", "team", "subscribed"];
    return {
      id: row.id,
      email: row.email,
      username: row.username || null,
      password_hash: row.password_hash,
      role: row.role === "admin" ? "admin" : "user",
      subscription_status: validStatuses.includes(row.subscription_status)
        ? row.subscription_status
        : "free",
      usage_count: row.usage_count || 0,
      created_at: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
      reset_token: row.reset_token || null,
      reset_token_expires: row.reset_token_expires instanceof Date
        ? row.reset_token_expires.toISOString()
        : row.reset_token_expires || null,
      email_verification_token: row.email_verification_token || null,
      email_verified: Boolean(row.email_verified),
    };
  }

  async findById(id) {
    const [rows] = await this.pool.query("SELECT * FROM users WHERE id = ?", [Number(id)]);
    return rows[0] ? this.normalizeUser(rows[0]) : null;
  }

  async findByEmail(email) {
    const [rows] = await this.pool.query("SELECT * FROM users WHERE email = ?", [email]);
    return rows[0] ? this.normalizeUser(rows[0]) : null;
  }

  async findByUsername(username) {
    const [rows] = await this.pool.query("SELECT * FROM users WHERE username = ?", [username]);
    return rows[0] ? this.normalizeUser(rows[0]) : null;
  }

  async create({ email, username, passwordHash }) {
    const [result] = await this.pool.query(
      "INSERT INTO users (email, username, password_hash, role, subscription_status, usage_count) VALUES (?, ?, ?, 'user', 'free', 0)",
      [email, username || null, passwordHash],
    );
    const user = await this.findById(result.insertId);
    return {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      subscriptionStatus: user.subscription_status,
      usageCount: user.usage_count,
    };
  }

  async incrementUsage(id) {
    await this.pool.query("UPDATE users SET usage_count = usage_count + 1 WHERE id = ?", [Number(id)]);
    return this.findById(id);
  }

  defaultStats() {
    return { shorten: 0, unshorten: 0, security: 0, malicious: 0 };
  }

  async getStats(id) {
    const [rows] = await this.pool.query(
      "SELECT stat_shorten AS shorten, stat_unshorten AS unshorten, stat_security AS security, stat_malicious AS malicious FROM users WHERE id = ?",
      [Number(id)],
    );
    return rows[0] || this.defaultStats();
  }

  todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  async incrementStats(id, key, amount = 1) {
    if (Number(id) === 0) return;
    const colMap = { shorten: "stat_shorten", unshorten: "stat_unshorten", security: "stat_security", malicious: "stat_malicious" };
    const col = colMap[key];
    if (!col) return;

    await this.pool.query(`UPDATE users SET ${col} = ${col} + ? WHERE id = ?`, [amount, Number(id)]);

    const today = this.todayStr();
    await this.pool.query(
      `INSERT INTO user_stats_history (user_id, date, ${key}) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE ${key} = ${key} + ?`,
      [Number(id), today, amount, amount],
    );
  }

  async getStatsHistory(id, days = 14) {
    const [rows] = await this.pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, shorten, unshorten, security, malicious
       FROM user_stats_history
       WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY date ASC`,
      [Number(id), days - 1],
    );

    const byDate = {};
    for (const r of rows) byDate[r.date] = r;

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push(
        byDate[dateStr]
          ? { date: dateStr, shorten: byDate[dateStr].shorten, unshorten: byDate[dateStr].unshorten, security: byDate[dateStr].security, malicious: byDate[dateStr].malicious }
          : { date: dateStr, shorten: 0, unshorten: 0, security: 0, malicious: 0 },
      );
    }
    return result;
  }

  async setResetToken(id, token, expiresAt) {
    await this.pool.query(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      [token, expiresAt, Number(id)],
    );
  }

  async findByResetToken(token) {
    const [rows] = await this.pool.query("SELECT * FROM users WHERE reset_token = ?", [token]);
    return rows[0] ? this.normalizeUser(rows[0]) : null;
  }

  async clearResetToken(id) {
    await this.pool.query(
      "UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [Number(id)],
    );
  }

  async setPassword(id, passwordHash) {
    await this.pool.query(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [passwordHash, Number(id)],
    );
  }

  async setEmailVerification(id, token) {
    await this.pool.query(
      "UPDATE users SET email_verification_token = ?, email_verified = 0 WHERE id = ?",
      [token, Number(id)],
    );
  }

  async findByVerificationToken(token) {
    const [rows] = await this.pool.query(
      "SELECT * FROM users WHERE email_verification_token = ?",
      [token],
    );
    return rows[0] ? this.normalizeUser(rows[0]) : null;
  }

  async verifyEmail(id) {
    await this.pool.query(
      "UPDATE users SET email_verified = 1, email_verification_token = NULL WHERE id = ?",
      [Number(id)],
    );
  }

  async findAll({ page = 1, limit = 50, search = "" } = {}) {
    let query = "SELECT * FROM users";
    const params = [];
    if (search) {
      query += " WHERE email LIKE ?";
      params.push(`%${search}%`);
    }
    query += " ORDER BY id ASC";

    const [allRows] = await this.pool.query(query, params);
    const total = allRows.length;
    const offset = (page - 1) * limit;
    const items = allRows.slice(offset, offset + limit).map((u) => ({
      ...this.normalizeUser(u),
      stats: {
        shorten: u.stat_shorten || 0,
        unshorten: u.stat_unshorten || 0,
        security: u.stat_security || 0,
        malicious: u.stat_malicious || 0,
      },
    }));

    return { items, total, page, limit };
  }

  async upgradeSubscription(id, plan = "pro") {
    await this.pool.query(
      "UPDATE users SET subscription_status = ?, usage_count = 0 WHERE id = ?",
      [plan, Number(id)],
    );
    return this.findById(id);
  }

  async deleteUser(id) {
    await this.pool.query("DELETE FROM users WHERE id = ?", [Number(id)]);
  }
}

module.exports = UserModel;
