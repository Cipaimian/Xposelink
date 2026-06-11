const handleRequest = require("./handleRequest");

class TransactionController {
  constructor({ transactionService, midtransService }) {
    this.transactionService = transactionService;
    this.midtransService = midtransService;

    this.processPayment = this.processPayment.bind(this);
    this.getTransactions = this.getTransactions.bind(this);
    this.createCheckout = this.createCheckout.bind(this);
    this.midtransNotification = this.midtransNotification.bind(this);
  }

  async processPayment(req, res) {
    return handleRequest(res, () =>
      this.transactionService.processPayment({
        userId: req.user.id,
        method: req.body.method,
        plan: req.body.plan,
        // force=true only accepted for mock method (dev downgrade)
        force: req.body.method === "mock" && req.body.force === true,
      }),
    );
  }

  async getTransactions(req, res) {
    return handleRequest(res, () =>
      this.transactionService.getTransactions(req.user.id),
    );
  }

  // Creates a Midtrans Snap transaction; returns { token, redirectUrl }
  async createCheckout(req, res) {
    return handleRequest(res, () =>
      this.midtransService.createCheckout({
        userId: req.user.id,
        plan: req.body.plan,
      }),
    );
  }

  // Midtrans sends JSON notification here after payment
  async midtransNotification(req, res) {
    try {
      const result = await this.midtransService.handleNotification(req.body);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ message: err.message });
    }
  }
}

module.exports = TransactionController;
