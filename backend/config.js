module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || "xposelink-dev-secret",

  // MySQL
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: parseInt(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || "root",
  DB_PASS: process.env.DB_PASS || "",
  DB_NAME: process.env.DB_NAME || "xposelink",
  PORT: process.env.PORT || 3000,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://localhost:3000",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY || "",

  // Google Safe Browsing API (optional — checks for phishing, malware, unwanted software)
  GOOGLE_SAFE_BROWSING_API_KEY: process.env.GOOGLE_SAFE_BROWSING_API_KEY || "",

  // Midtrans
  MIDTRANS_SERVER_KEY:  process.env.MIDTRANS_SERVER_KEY  || "",
  MIDTRANS_CLIENT_KEY:  process.env.MIDTRANS_CLIENT_KEY  || "",
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === "true",

  // Real admin account (seeded from env — never hardcoded)
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",

  // Email (Nodemailer / SMTP)
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "Xposelink <noreply@xposelink.id>",
};
