const handleRequest = require("./handleRequest");

class CustomerController {
  constructor({ customerService }) {
    this.customerService = customerService;

    this.sendMessage = this.sendMessage.bind(this);
    this.giveFeedback = this.giveFeedback.bind(this);
    this.getMyTickets = this.getMyTickets.bind(this);
    this.getAllTickets = this.getAllTickets.bind(this);
    this.replyToTicket = this.replyToTicket.bind(this);
    this.closeTicket = this.closeTicket.bind(this);
  }

  async sendMessage(req, res) {
    return handleRequest(res, () =>
      this.customerService.sendMessage({
        userId: req.user?.id ?? null,
        email: req.body.email ?? req.user?.email ?? null,
        subject: req.body.subject,
        message: req.body.message,
      }),
    );
  }

  async giveFeedback(req, res) {
    return handleRequest(res, () =>
      this.customerService.giveFeedback({
        userId: req.user?.id ?? null,
        feedback: req.body.feedback,
      }),
    );
  }

  async getMyTickets(req, res) {
    return handleRequest(res, () =>
      this.customerService.getMyTickets(req.user.id),
    );
  }

  async getAllTickets(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const status = req.query.status || undefined;
    return handleRequest(res, () =>
      this.customerService.getAllTickets({ page, limit, status }),
    );
  }

  async replyToTicket(req, res) {
    const ticketId = parseInt(req.params.id);
    return handleRequest(res, () =>
      this.customerService.replyToTicket(ticketId, { reply: req.body.reply }),
    );
  }

  async closeTicket(req, res) {
    const ticketId = parseInt(req.params.id);
    return handleRequest(res, () =>
      this.customerService.closeTicket(ticketId),
    );
  }
}

module.exports = CustomerController;
