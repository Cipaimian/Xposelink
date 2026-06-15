const nodemailer = require("nodemailer");
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, FRONTEND_URL } = require("../config");

class EmailService {
  constructor() {
    this.enabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    }
  }

  async send({ to, subject, html, text }) {
    if (!this.enabled) {
      // Dev fallback: log email to console instead of sending
      console.log(`\n[EmailService] SMTP not configured — email would be sent to: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${text || html}\n`);
      return;
    }

    await this.transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
  }

  async sendPasswordReset(email, token) {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    await this.send({
      to: email,
      subject: "Reset your Xposelink password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e293b">Reset your password</h2>
          <p style="color:#475569">We received a request to reset the password for your Xposelink account.</p>
          <p style="color:#475569">Click the button below within <strong>1 hour</strong> to set a new password:</p>
          <a href="${resetUrl}"
            style="display:inline-block;margin:16px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
          <p style="color:#94a3b8;font-size:12px">
            Or copy this link: ${resetUrl}<br><br>
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `Reset your Xposelink password\n\nClick here: ${resetUrl}\n\nLink expires in 1 hour. If you didn't request this, ignore this email.`,
    });
  }

  async sendEmailVerification(email, token) {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
    await this.send({
      to: email,
      subject: "Verify your Xposelink email",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e293b">Verify your email</h2>
          <p style="color:#475569">Thanks for signing up for Xposelink! Please verify your email address:</p>
          <a href="${verifyUrl}"
            style="display:inline-block;margin:16px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Verify Email
          </a>
          <p style="color:#94a3b8;font-size:12px">
            Or copy this link: ${verifyUrl}<br><br>
            Link expires in 24 hours.
          </p>
        </div>
      `,
      text: `Verify your Xposelink email\n\nClick here: ${verifyUrl}\n\nLink expires in 24 hours.`,
    });
  }
}

module.exports = EmailService;
