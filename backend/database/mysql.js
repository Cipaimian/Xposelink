const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, ADMIN_EMAIL: REAL_ADMIN_EMAIL, ADMIN_PASSWORD: REAL_ADMIN_PASSWORD } = require("../config");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function initMySqlDb() {
  const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "Z",
  });

  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        email           VARCHAR(255) NOT NULL UNIQUE,
        username        VARCHAR(50)  NULL UNIQUE,
        password_hash   VARCHAR(512) NOT NULL,
        role            ENUM('user','admin') NOT NULL DEFAULT 'user',
        subscription_status ENUM('free','pro','team','subscribed') NOT NULL DEFAULT 'free',
        usage_count     INT NOT NULL DEFAULT 0,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reset_token     VARCHAR(255) NULL,
        reset_token_expires DATETIME NULL,
        email_verification_token VARCHAR(255) NULL,
        email_verified  TINYINT(1) NOT NULL DEFAULT 0,
        stat_shorten    INT NOT NULL DEFAULT 0,
        stat_unshorten  INT NOT NULL DEFAULT 0,
        stat_security   INT NOT NULL DEFAULT 0,
        stat_malicious  INT NOT NULL DEFAULT 0
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_stats_history (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        date       DATE NOT NULL,
        shorten    INT NOT NULL DEFAULT 0,
        unshorten  INT NOT NULL DEFAULT 0,
        security   INT NOT NULL DEFAULT 0,
        malicious  INT NOT NULL DEFAULT 0,
        UNIQUE KEY uq_user_date (user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS links (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT NULL,
        original_url TEXT NOT NULL,
        short_code   VARCHAR(255) NOT NULL UNIQUE,
        is_custom    TINYINT(1) NOT NULL DEFAULT 0,
        visit_count  INT NOT NULL DEFAULT 0,
        status       ENUM('active','deleted') NOT NULL DEFAULT 'active',
        expires_at   DATETIME NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS link_clicks (
        id       INT AUTO_INCREMENT PRIMARY KEY,
        link_id  INT NOT NULL,
        ts       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip       VARCHAR(45) NULL,
        ua       TEXT NULL,
        country  VARCHAR(100) NULL,
        city     VARCHAR(100) NULL,
        FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        method     VARCHAR(50) NOT NULL DEFAULT 'mock',
        amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
        status     ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS guest_usage (
        ip          VARCHAR(45)  NOT NULL PRIMARY KEY,
        usage_count INT          NOT NULL DEFAULT 0,
        first_used  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NULL,
        email      VARCHAR(255) NULL,
        subject    VARCHAR(500) NOT NULL DEFAULT 'Support Request',
        message    TEXT NOT NULL,
        status     ENUM('open','answered','closed') NOT NULL DEFAULT 'open',
        reply      TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Add username column if it doesn't exist yet (safe on existing databases)
    await conn.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) NULL UNIQUE AFTER email
    `).catch(() => {});

    // Seed admin from env vars (ADMIN_EMAIL + ADMIN_PASSWORD)
    // Password is hashed fresh at startup — credentials never appear in source code.
    if (REAL_ADMIN_EMAIL && REAL_ADMIN_PASSWORD) {
      const [existing] = await conn.query("SELECT id FROM users WHERE email = ?", [REAL_ADMIN_EMAIL]);
      if (existing.length === 0) {
        const passwordHash = hashPassword(REAL_ADMIN_PASSWORD);
        await conn.query(
          "INSERT INTO users (email, password_hash, role, subscription_status) VALUES (?, ?, 'admin', 'subscribed')",
          [REAL_ADMIN_EMAIL, passwordHash],
        );
        console.log(`[DB] Real admin account created: ${REAL_ADMIN_EMAIL}`);
      }
    }

    // Reset free-tier and guest usage_count on startup
    await conn.query("UPDATE users SET usage_count = 0 WHERE subscription_status IN ('free','pro','team')");
    await conn.query("UPDATE guest_usage SET usage_count = 0");
    console.log("[DB] Token quotas reset (users + guests).");
  } finally {
    conn.release();
  }

  // Schedule monthly reset on the 1st of each month
  scheduleMonthlyReset(pool);

  console.log(`[DB] MySQL connected → ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  return pool;
}

// Runs on the 1st of each month at 00:00:00, then reschedules itself
function scheduleMonthlyReset(pool) {
  const now = new Date();
  // Next 1st: if today is already the 1st and it's past midnight, go to next month
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const msUntil = next - now;

  setTimeout(async () => {
    try {
      const [users] = await pool.query(
        "UPDATE users SET usage_count = 0 WHERE subscription_status IN ('free','pro','team')",
      );
      const [guests] = await pool.query("UPDATE guest_usage SET usage_count = 0");
      console.log(`[DB] Monthly token reset — ${users.affectedRows} user(s), ${guests.affectedRows} guest IP(s) refreshed.`);
    } catch (err) {
      console.error("[DB] Monthly reset failed:", err.message);
    }
    scheduleMonthlyReset(pool);
  }, msUntil);

  console.log(`[DB] Next monthly token reset: ${next.toDateString()} (in ${Math.round(msUntil / 3600000)}h)`);
}

module.exports = { initMySqlDb };
