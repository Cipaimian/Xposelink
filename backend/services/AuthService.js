const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

class AuthService {
  constructor({ userModel, verificationService, emailService }) {
    this.userModel = userModel;
    this.verificationService = verificationService;
    this.emailService = emailService;
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, "sha512")
      .toString("hex");
    return `${salt}:${hash}`;
  }

  verifyPassword(password, storedHash) {
    const [salt, originalHash] = storedHash.split(":");
    const currentHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, "sha512")
      .toString("hex");
    return crypto.timingSafeEqual(
      Buffer.from(originalHash, "hex"),
      Buffer.from(currentHash, "hex"),
    );
  }

  signToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
  }

  generateToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  async register({ email, username, password }) {
    if (!this.verificationService.verifyEmail(email)) {
      return { ok: false, status: 400, message: "Invalid email format" };
    }

    if (!username || username.trim().length < 3) {
      return { ok: false, status: 400, message: "Username must be at least 3 characters" };
    }
    if (!/^[A-Za-z0-9_-]+$/.test(username.trim())) {
      return { ok: false, status: 400, message: "Username can only contain letters, numbers, _ and -" };
    }

    if (!password || password.length < 8) {
      return { ok: false, status: 400, message: "Password must be at least 8 characters" };
    }

    const existingEmail = await this.userModel.findByEmail(email);
    if (existingEmail) {
      return { ok: false, status: 409, message: "Email already registered" };
    }

    const existingUsername = await this.userModel.findByUsername(username.trim());
    if (existingUsername) {
      return { ok: false, status: 409, message: "Username already taken" };
    }

    const passwordHash = this.hashPassword(password);
    const user = await this.userModel.create({ email, username: username.trim(), passwordHash });

    return {
      ok: true,
      status: 201,
      message: "Register success",
      data: { id: user.id, email: user.email, role: "user" },
    };
  }

  async login({ identifier, password }) {
    if (!identifier) {
      return { ok: false, status: 400, message: "Username or email is required" };
    }

    if (!password) {
      return { ok: false, status: 400, message: "Password is required" };
    }

    // Treat as email if it contains @, otherwise look up by username
    const isEmail = identifier.includes("@");
    const user = isEmail
      ? await this.userModel.findByEmail(identifier)
      : await this.userModel.findByUsername(identifier);

    if (!user) {
      return { ok: false, status: 401, message: "Invalid credentials" };
    }

    const isMatch = this.verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return { ok: false, status: 401, message: "Invalid credentials" };
    }

    const token = this.signToken(user);

    return {
      ok: true,
      status: 200,
      message: "Login success",
      data: { token, id: user.id, email: user.email, username: user.username, role: user.role },
    };
  }

  // Send reset-password email. Always returns success to prevent email enumeration.
  async forgotPassword({ email }) {
    if (!this.verificationService.verifyEmail(email)) {
      return { ok: false, status: 400, message: "Invalid email format" };
    }

    const user = await this.userModel.findByEmail(email);
    if (user) {
      const token = this.generateToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      await this.userModel.setResetToken(user.id, token, expires);
      await this.emailService.sendPasswordReset(email, token).catch((err) => {
        console.error("[AuthService] Failed to send reset email:", err.message);
      });
    }

    return {
      ok: true,
      status: 200,
      message: "If that email is registered, a reset link has been sent.",
    };
  }

  async resetPassword({ token, password }) {
    if (!token) {
      return { ok: false, status: 400, message: "Reset token is required" };
    }
    if (!password || password.length < 8) {
      return { ok: false, status: 400, message: "Password must be at least 8 characters" };
    }

    const user = await this.userModel.findByResetToken(token);
    if (!user || !user.reset_token_expires) {
      return { ok: false, status: 400, message: "Invalid or expired reset token" };
    }

    if (new Date(user.reset_token_expires) < new Date()) {
      return { ok: false, status: 400, message: "Reset token has expired. Request a new one." };
    }

    const passwordHash = this.hashPassword(password);
    await this.userModel.setPassword(user.id, passwordHash);

    return { ok: true, status: 200, message: "Password updated successfully. You can now log in." };
  }

  // Send verification email after registration (call this from register if you want it)
  async sendVerificationEmail(userId, email) {
    const token = this.generateToken();
    await this.userModel.setEmailVerification(userId, token);
    await this.emailService.sendEmailVerification(email, token).catch((err) => {
      console.error("[AuthService] Failed to send verification email:", err.message);
    });
  }

  async changePassword({ userId, currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
      return { ok: false, status: 400, message: "Current and new password are required" };
    }
    if (newPassword.length < 8) {
      return { ok: false, status: 400, message: "New password must be at least 8 characters" };
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      return { ok: false, status: 404, message: "User not found" };
    }

    const isMatch = this.verifyPassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return { ok: false, status: 401, message: "Current password is incorrect" };
    }

    const passwordHash = this.hashPassword(newPassword);
    await this.userModel.setPassword(userId, passwordHash);

    return { ok: true, status: 200, message: "Password changed successfully" };
  }

  async deleteAccount({ userId }) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return { ok: false, status: 404, message: "User not found" };
    }
    await this.userModel.deleteUser(userId);
    return { ok: true, status: 200, message: "Account deleted successfully" };
  }

  async verifyEmail({ token }) {
    if (!token) {
      return { ok: false, status: 400, message: "Verification token is required" };
    }

    const user = await this.userModel.findByVerificationToken(token);
    if (!user) {
      return { ok: false, status: 400, message: "Invalid or already used verification token" };
    }

    await this.userModel.verifyEmail(user.id);
    return { ok: true, status: 200, message: "Email verified successfully." };
  }
}

module.exports = AuthService;
