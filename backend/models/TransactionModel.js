class TransactionModel {
  constructor(pool) {
    this.pool = pool;
  }

  normalizeTransaction(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      method: row.method || "mock",
      amount: typeof row.amount === "number" ? row.amount : Number(row.amount) || 0,
      status: row.status || "pending",
      created_at: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at || new Date().toISOString(),
    };
  }

  async create({ userId, method, amount }) {
    const [result] = await this.pool.query(
      "INSERT INTO transactions (user_id, method, amount, status) VALUES (?, ?, ?, 'pending')",
      [Number(userId), method || "mock", amount || 0],
    );
    const [rows] = await this.pool.query(
      "SELECT * FROM transactions WHERE id = ? LIMIT 1",
      [result.insertId],
    );
    return rows[0] ? this.normalizeTransaction(rows[0]) : null;
  }

  async updateStatus(id, status) {
    await this.pool.query(
      "UPDATE transactions SET status = ? WHERE id = ?",
      [status, Number(id)],
    );
    const [rows] = await this.pool.query(
      "SELECT * FROM transactions WHERE id = ? LIMIT 1",
      [Number(id)],
    );
    return rows[0] ? this.normalizeTransaction(rows[0]) : null;
  }

  async findAll({ page = 1, limit = 50 } = {}) {
    const [allRows] = await this.pool.query(
      "SELECT * FROM transactions ORDER BY created_at DESC",
    );
    const total = allRows.length;
    const offset = (page - 1) * limit;
    const items = allRows.slice(offset, offset + limit).map((r) => this.normalizeTransaction(r));
    return { items, total, page, limit };
  }

  async findByUserId(userId) {
    const [rows] = await this.pool.query(
      "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC",
      [Number(userId)],
    );
    return rows.map((r) => this.normalizeTransaction(r));
  }
}

module.exports = TransactionModel;
