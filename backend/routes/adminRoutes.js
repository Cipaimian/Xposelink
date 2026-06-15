const express = require("express");
const { authMiddleware, requireAdmin } = require("../middleware/authMiddleware");

function createAdminRoutes(adminController) {
  const router = express.Router();

  // All admin routes require a valid JWT + admin role
  router.use(authMiddleware);
  router.use(requireAdmin);

  router.get("/users", adminController.getUsers);
  router.patch("/users/:id", adminController.updateUser);
  router.get("/links", adminController.getLinks);
  router.get("/transactions", adminController.getTransactions);

  return router;
}

module.exports = createAdminRoutes;
