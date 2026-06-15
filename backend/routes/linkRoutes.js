const express = require("express");
const rateLimit = require("express-rate-limit");
const { authMiddleware, requireAuth } = require("../middleware/authMiddleware");

const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

function createLinkRoutes(linkController) {
  const router = express.Router();

  // authMiddleware is non-blocking — sets req.user if a valid token is present.
  // Authenticated users use their account quota; guests fall back to userId=0.
  router.use(authMiddleware);

  router.get("/users/me",                   requireAuth,  linkController.getMe);
  router.get("/guest/quota",                             linkController.getGuestQuota);
  router.post("/links/shorten",             scanLimiter, linkController.shorten);
  router.post("/links/unshorten",           scanLimiter, linkController.unshorten);
  router.get("/links/my-links",                          linkController.getMyLinks);
  router.get("/links/:id/analytics",                     linkController.getLinkAnalytics);
  router.patch("/links/:id",                             linkController.updateLink);
  router.delete("/links/:id",                            linkController.deleteLink);
  router.get("/users/:userId/quota",                     linkController.getQuota);
  router.get("/users/:userId/stats",                     linkController.getStats);
  router.get("/users/:userId/stats/history",             linkController.getStatsHistory);
  router.post("/security/check",            scanLimiter, linkController.checkSecurity);
  router.get("/extension/check",            scanLimiter, linkController.checkSecurityExtension);
  router.post("/extension/check",           scanLimiter, linkController.checkSecurityExtension);

  return router;
}

module.exports = createLinkRoutes;
