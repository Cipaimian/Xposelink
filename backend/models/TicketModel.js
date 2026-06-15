class TicketModel {
  constructor(pool) {
    this.pool = pool;
  }

  normalizeTicket(row) {
    return {
      id: row.id,
      userId: row.user_id ?? null,
      email: row.email ?? null,
      subject: row.subject || "Support Request",
      message: row.message,
      status: row.status || "open",
      reply: row.reply ?? null,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at || new Date().toISOString(),
    };
  }

  async create({ userId, email, subject, message }) {
    const [result] = await this.pool.query(
      "INSERT INTO tickets (user_id, email, subject, message) VALUES (?, ?, ?, ?)",
      [userId ?? null, email ?? null, (subject || "Support Request").trim(), message.trim()],
    );
    const [rows] = await this.pool.query(
      "SELECT * FROM tickets WHERE id = ? LIMIT 1",
      [result.insertId],
    );
    return rows[0] ? this.normalizeTicket(rows[0]) : null;
  }

  async findByUserId(userId) {
    const [rows] = await this.pool.query(
      "SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC",
      [Number(userId)],
    );
    return rows.map((r) => this.normalizeTicket(r));
  }

  async findAll({ page = 1, limit = 50, status } = {}) {
    let query = "SELECT * FROM tickets";
    const params = [];
    if (status) { query += " WHERE status = ?"; params.push(status); }
    query += " ORDER BY created_at DESC";

    const [allRows] = await this.pool.query(query, params);
    const total = allRows.length;
    const offset = (page - 1) * limit;
    const items = allRows.slice(offset, offset + limit).map((r) => this.normalizeTicket(r));
    return { items, total, page, limit };
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      "SELECT * FROM tickets WHERE id = ? LIMIT 1",
      [Number(id)],
    );
    return rows[0] ? this.normalizeTicket(rows[0]) : null;
  }

  async reply(id, { reply }) {
    await this.pool.query(
      "UPDATE tickets SET reply = ?, status = 'answered' WHERE id = ?",
      [reply.trim(), Number(id)],
    );
    return this.findById(id);
  }

  async close(id) {
    await this.pool.query(
      "UPDATE tickets SET status = 'closed' WHERE id = ?",
      [Number(id)],
    );
    return this.findById(id);
  }
}

module.exports = TicketModel;
