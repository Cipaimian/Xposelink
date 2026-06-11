const midtransClient = require("midtrans-client");
const crypto = require("crypto");
const {
  MIDTRANS_SERVER_KEY,
  MIDTRANS_CLIENT_KEY,
  MIDTRANS_IS_PRODUCTION,
  FRONTEND_URL,
} = require("../config");

// Prices in IDR
const PLAN_CONFIG = {
  pro:  { name: "Xposelink Pro",  amount: 40000 },  // IDR 40.000/bulan
  team: { name: "Xposelink Team", amount: 80000 },  // IDR 80.000/bulan
};

class MidtransService {
  constructor({ transactionModel, subscriptionService, userModel }) {
    this.transactionModel = transactionModel;
    this.subscriptionService = subscriptionService;
    this.userModel = userModel;
    this.enabled = Boolean(MIDTRANS_SERVER_KEY && MIDTRANS_CLIENT_KEY);

    if (this.enabled) {
      this.snap = new midtransClient.Snap({
        isProduction: MIDTRANS_IS_PRODUCTION,
        serverKey: MIDTRANS_SERVER_KEY,
        clientKey: MIDTRANS_CLIENT_KEY,
      });
    }
  }

  // Create a Midtrans Snap transaction — returns { token, redirectUrl }
  async createCheckout({ userId, plan }) {
    if (!this.enabled) {
      const err = new Error("Midtrans is not configured. Add MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY to backend/.env");
      err.status = 503;
      throw err;
    }

    const planCfg = PLAN_CONFIG[plan];
    if (!planCfg) {
      const err = new Error("Invalid plan. Choose 'pro' or 'team'.");
      err.status = 400;
      throw err;
    }

    const user = await this.subscriptionService.getUserOrThrow(userId);
    const orderId = `xposelink-${userId}-${plan}-${Date.now()}`;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: planCfg.amount,
      },
      item_details: [
        {
          id: plan,
          price: planCfg.amount,
          quantity: 1,
          name: planCfg.name,
        },
      ],
      customer_details: {
        email: user.email,
      },
      callbacks: {
        finish:  `${FRONTEND_URL}/dashboard?checkout=success&plan=${plan}`,
        error:   `${FRONTEND_URL}/dashboard?checkout=error`,
        pending: `${FRONTEND_URL}/dashboard?checkout=pending`,
      },
    };

    const transaction = await this.snap.createTransaction(parameter);

    return {
      message: "Checkout session created",
      data: {
        token:       transaction.token,
        redirectUrl: transaction.redirect_url,
        orderId,
        plan,
      },
    };
  }

  // Verify Midtrans notification signature
  // Formula: SHA512(order_id + status_code + gross_amount + server_key)
  verifySignature(orderId, statusCode, grossAmount, signatureKey) {
    const raw = `${orderId}${statusCode}${grossAmount}${MIDTRANS_SERVER_KEY}`;
    const expected = crypto.createHash("sha512").update(raw).digest("hex");
    return expected === signatureKey;
  }

  // Handle Midtrans payment notification (webhook)
  async handleNotification(body) {
    if (!this.enabled) {
      const err = new Error("Midtrans is not configured");
      err.status = 503;
      throw err;
    }

    const {
      order_id,
      transaction_status,
      fraud_status,
      status_code,
      gross_amount,
      signature_key,
      payment_type,
    } = body;

    // Verify signature
    if (!this.verifySignature(order_id, status_code, gross_amount, signature_key)) {
      const err = new Error("Invalid notification signature");
      err.status = 403;
      throw err;
    }

    // Parse order_id: "xposelink-{userId}-{plan}-{timestamp}"
    const parts = order_id.split("-");
    // format: xposelink-{userId}-{plan}-{timestamp}
    // parts:  [0]=xposelink [1]=userId [2]=plan [3]=timestamp
    const userId = parseInt(parts[1]);
    const plan   = parts[2];

    if (!userId || !plan || !PLAN_CONFIG[plan]) {
      console.warn("[MidtransService] Unknown order format:", order_id);
      return { received: true };
    }

    // Only process on settlement (card) or capture, and not fraudulent
    const isSuccess =
      (transaction_status === "settlement" || transaction_status === "capture") &&
      (fraud_status === "accept" || fraud_status === undefined);

    if (isSuccess) {
      // Record transaction
      const amount = parseFloat(gross_amount) || PLAN_CONFIG[plan].amount;
      const tx = await this.transactionModel.create({
        userId,
        method: payment_type || "midtrans",
        amount,
      });
      await this.transactionModel.updateStatus(tx.id, "success");

      // Upgrade subscription
      await this.subscriptionService.upgradeSubscription(userId, plan);
      console.log(`[MidtransService] Upgraded user ${userId} to ${plan} via ${payment_type}`);
    } else if (transaction_status === "pending") {
      console.log(`[MidtransService] Payment pending for order ${order_id}`);
    } else {
      console.log(`[MidtransService] Payment not successful: ${transaction_status} / ${fraud_status}`);
    }

    return { received: true };
  }
}

module.exports = MidtransService;
