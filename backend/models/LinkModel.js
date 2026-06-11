class LinkModel {
  constructor(pool) {
    this.pool = pool;
  }

  normalizeLink(row) {
    return {
      id: row.id,
      user_id: row.user_id ?? null,
      original_url: row.original_url,
      short_code: row.short_code,
      is_custom: Boolean(row.is_custom),
      visit_count: Number(row.visit_count) || 0,
      status: row.status || "active",
      expires_at: row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : row.expires_at || null,
      created_at: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at || new Date().toISOString(),
    };
  }

  async findByShortCode(shortCode) {
    const [rows] = await this.pool.query(
      "SELECT * FROM links WHERE short_code = ? LIMIT 1",
      [shortCode],
    );
    return rows[0] ? this.normalizeLink(rows[0]) : null;
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      "SELECT * FROM links WHERE id = ? LIMIT 1",
      [Number(id)],
    );
    return rows[0] ? this.normalizeLink(rows[0]) : null;
  }

  async findByUserId(userId, { page = 1, limit = 20, search = "" } = {}) {
    let query = "SELECT * FROM links WHERE user_id = ? AND status != 'deleted'";
    const params = [Number(userId)];

    if (search) {
      query += " AND (short_code LIKE ? OR original_url LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY created_at DESC";

    const [allRows] = await this.pool.query(query, params);
    const total = allRows.length;
    const offset = (page - 1) * limit;
    const items = allRows.slice(offset, offset + limit).map((r) => this.normalizeLink(r));

    return { items, total, page, limit };
  }

  async findAll({ page = 1, limit = 50, search = "", includeDeleted = false } = {}) {
    let query = "SELECT * FROM links";
    const params = [];
    const conditions = [];

    if (!includeDeleted) conditions.push("status != 'deleted'");
    if (search) {
      conditions.push("(short_code LIKE ? OR original_url LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY created_at DESC";

    const [allRows] = await this.pool.query(query, params);
    const total = allRows.length;
    const offset = (page - 1) * limit;
    const items = allRows.slice(offset, offset + limit).map((r) => this.normalizeLink(r));

    return { items, total, page, limit };
  }

  async create({ originalUrl, shortCode, userId, isCustom, expiresAt }) {
    const [result] = await this.pool.query(
      "INSERT INTO links (user_id, original_url, short_code, is_custom, expires_at) VALUES (?, ?, ?, ?, ?)",
      // Guests have userId 0, which has no row in `users`. Store NULL so the
      // foreign key holds (`userId ?? null` would keep 0 — nullish, not falsy).
      [userId || null, originalUrl, shortCode, isCustom ? 1 : 0, expiresAt || null],
    );
    return this.findById(result.insertId);
  }

  async update(id, { originalUrl, expiresAt }) {
    const sets = [];
    const params = [];

    if (originalUrl !== undefined) { sets.push("original_url = ?"); params.push(originalUrl); }
    if (expiresAt !== undefined)   { sets.push("expires_at = ?");   params.push(expiresAt); }

    if (!sets.length) return this.findById(id);

    params.push(Number(id));
    await this.pool.query(`UPDATE links SET ${sets.join(", ")} WHERE id = ?`, params);
    return this.findById(id);
  }

  async incrementVisitCount(shortCode) {
    await this.pool.query(
      "UPDATE links SET visit_count = visit_count + 1 WHERE short_code = ?",
      [shortCode],
    );
    return this.findByShortCode(shortCode);
  }

  async recordClick(shortCode, { ip, userAgent, country, city } = {}) {
    const [rows] = await this.pool.query(
      "SELECT id FROM links WHERE short_code = ? LIMIT 1",
      [shortCode],
    );
    if (!rows[0]) return;
    await this.pool.query(
      "INSERT INTO link_clicks (link_id, ip, ua, country, city) VALUES (?, ?, ?, ?, ?)",
      [rows[0].id, ip || null, userAgent || null, country || null, city || null],
    );
  }

  async getAnalytics(id) {
    const link = await this.findById(id);
    if (!link) return null;

    const [clicks] = await this.pool.query(
      "SELECT ts, ip, ua, country, city FROM link_clicks WHERE link_id = ? ORDER BY ts DESC",
      [Number(id)],
    );

    const dayCounts = {};
    const countries = {};
    const devices = {};

    for (const c of clicks) {
      const ts = c.ts instanceof Date ? c.ts.toISOString() : (c.ts || "");
      const day = ts.slice(0, 10) || "unknown";
      dayCounts[day] = (dayCounts[day] || 0) + 1;

      if (c.country) countries[c.country] = (countries[c.country] || 0) + 1;

      const ua = (c.ua || "").toLowerCase();
      let device = "desktop";
      if (/mobile|android|iphone|ipad/.test(ua)) device = "mobile";
      else if (/tablet/.test(ua)) device = "tablet";
      else if (/bot|crawl|spider/.test(ua)) device = "bot";
      devices[device] = (devices[device] || 0) + 1;
    }

    const history = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      history.push({ date: dateStr, clicks: dayCounts[dateStr] || 0 });
    }

    const topCountries = Object.entries(countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const deviceBreakdown = Object.entries(devices)
      .map(([name, count]) => ({ name, count }));

    return {
      linkId: id,
      shortCode: link.short_code,
      originalUrl: link.original_url,
      totalClicks: clicks.length,
      visitCount: link.visit_count,
      history,
      topCountries,
      deviceBreakdown,
    };
  }

  async softDelete(id, userId) {
    const link = await this.findById(id);
    if (!link) return null;
    if (userId && link.user_id !== userId) return null;

    const newCode = `${link.short_code}_del_${Date.now()}`;
    await this.pool.query(
      "UPDATE links SET status = 'deleted', short_code = ? WHERE id = ?",
      [newCode, Number(id)],
    );
    return this.findById(id);
  }
}

module.exports = LinkModel;
