const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/authMiddleware");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

function createAuthRoutes(authController) {
  const router = express.Router();

  router.post("/register",        authLimiter, authController.register);
  router.post("/login",           authLimiter, authController.login);
  router.post("/logout",                       authController.logout);
  router.post("/forgot-password", authLimiter, authController.forgotPassword);
  router.post("/reset-password",              authController.resetPassword);
  router.get("/verify-email",                 authController.verifyEmail);
  router.patch("/change-password", requireAuth, authController.changePassword);
  router.delete("/account",        requireAuth, authController.deleteAccount);

  return router;
}

module.exports = createAuthRoutes;
