class TransactionService {
  constructor({ transactionModel, subscriptionService }) {
    this.transactionModel = transactionModel;
    this.subscriptionService = subscriptionService;
  }

  async processPayment({ userId, method, plan = "pro", force = false }) {
    const user = await this.subscriptionService.getUserOrThrow(userId);

    const AMOUNTS = { free: 0, pro: 40000, team: 80000 };
    const amount = AMOUNTS[plan];
    if (amount === undefined) {
      const error = new Error("Invalid plan. Choose 'pro' or 'team'.");
      error.status = 400;
      throw error;
    }

    // For mock downgrades (force=true, method=mock) skip creating a transaction record
    let updated = { id: null, status: "success", method: method || "mock", amount };
    if (amount > 0) {
      const transaction = await this.transactionModel.create({
        userId: user.id,
        method: method || "mock",
        amount,
      });
      updated = await this.transactionModel.updateStatus(transaction.id, "success");
    }

    const result = await this.subscriptionService.upgradeSubscription(user.id, plan, { force });

    return {
      message: "Payment successful. Subscription upgraded.",
      data: {
        transactionId: updated.id,
        status: updated.status,
        method: updated.method,
        amount: updated.amount,
      },
      quota: result.quota,
    };
  }

  async getTransactions(userId) {
    await this.subscriptionService.getUserOrThrow(userId);
    const transactions = await this.transactionModel.findByUserId(userId);
    return { transactions };
  }
}

module.exports = TransactionService;
