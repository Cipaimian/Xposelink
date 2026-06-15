const handleRequest = require("./handleRequest");

class AdminController {
  constructor({ userModel, linkModel, transactionModel, subscriptionService }) {
    this.userModel = userModel;
    this.linkModel = linkModel;
    this.transactionModel = transactionModel;
    this.subscriptionService = subscriptionService;

    this.getUsers = this.getUsers.bind(this);
    this.getLinks = this.getLinks.bind(this);
    this.getTransactions = this.getTransactions.bind(this);
    this.updateUser = this.updateUser.bind(this);
  }

  async getUsers(req, res) {
    return handleRequest(res, async () => {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const search = req.query.search || "";
      const result = await this.userModel.findAll({ page, limit, search });
      // Attach computed tier to each user
      const items = result.items.map((u) => ({
        ...u,
        tier: this.subscriptionService.tierOf(u),
      }));
      return { ...result, items };
    });
  }

  async getLinks(req, res) {
    return handleRequest(res, async () => {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const search = req.query.search || "";
      const includeDeleted = req.query.includeDeleted === "true";
      return this.linkModel.findAll({ page, limit, search, includeDeleted });
    });
  }

  async getTransactions(req, res) {
    return handleRequest(res, async () => {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      return this.transactionModel.findAll({ page, limit });
    });
  }

  async updateUser(req, res) {
    return handleRequest(res, async () => {
      const targetId = parseInt(req.params.id);
      const { plan } = req.body;

      if (!plan) {
        const err = new Error("'plan' field is required");
        err.status = 400;
        throw err;
      }

      const result = await this.subscriptionService.upgradeSubscription(targetId, plan);
      return {
        message: `User ${targetId} plan updated to ${plan}.`,
        user: { id: result.user.id, email: result.user.email },
        quota: result.quota,
      };
    });
  }
}

module.exports = AdminController;
