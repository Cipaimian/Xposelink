const express = require("express");
const { authMiddleware, requireAuth, requireAdmin } = require("../middleware/authMiddleware");

function createCustomerRoutes(customerController) {
  const router = express.Router();

  router.use(authMiddleware);

  // Submit a support ticket (any user, auth optional)
  router.post("/message", customerController.sendMessage);
  router.post("/feedback", customerController.giveFeedback);

  // Get own tickets (auth required)
  router.get("/my-tickets", requireAuth, customerController.getMyTickets);

  // Admin-only
  router.get("/tickets", requireAuth, requireAdmin, customerController.getAllTickets);
  router.post("/tickets/:id/reply", requireAuth, requireAdmin, customerController.replyToTicket);
  router.post("/tickets/:id/close", requireAuth, requireAdmin, customerController.closeTicket);

  return router;
}

module.exports = createCustomerRoutes;
