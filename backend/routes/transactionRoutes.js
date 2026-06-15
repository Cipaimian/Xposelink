const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");

function createTransactionRoutes(transactionController) {
  const router = express.Router();

  // Midtrans notification — standard JSON, no special body parsing needed
  router.post("/notification", transactionController.midtransNotification);

  router.use(requireAuth);

  router.post("/payment", transactionController.processPayment);
  router.post("/checkout", transactionController.createCheckout);
  router.get("/", transactionController.getTransactions);

  return router;
}

module.exports = createTransactionRoutes;
