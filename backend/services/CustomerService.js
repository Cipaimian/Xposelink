class CustomerService {
  constructor({ ticketModel } = {}) {
    this.ticketModel = ticketModel;
  }

  async sendMessage({ userId, email, subject, message }) {
    if (!message || typeof message !== "string" || !message.trim()) {
      const error = new Error("Message cannot be empty");
      error.status = 400;
      throw error;
    }

    const ticket = await this.ticketModel.create({ userId, email, subject, message });

    return {
      message: "Ticket submitted. We will get back to you shortly.",
      data: { id: ticket.id, status: ticket.status },
    };
  }

  async giveFeedback({ userId, feedback }) {
    return this.sendMessage({
      userId,
      subject: "Feedback",
      message: `[FEEDBACK] ${feedback}`,
    });
  }

  async getMyTickets(userId) {
    const tickets = await this.ticketModel.findByUserId(userId);
    return { tickets };
  }

  async getAllTickets({ page, limit, status } = {}) {
    return this.ticketModel.findAll({ page, limit, status });
  }

  async replyToTicket(ticketId, { reply }) {
    if (!reply || !reply.trim()) {
      const error = new Error("Reply cannot be empty");
      error.status = 400;
      throw error;
    }
    const ticket = await this.ticketModel.reply(ticketId, { reply });
    if (!ticket) {
      const error = new Error("Ticket not found");
      error.status = 404;
      throw error;
    }
    return { message: "Reply sent", data: ticket };
  }

  async closeTicket(ticketId) {
    const ticket = await this.ticketModel.close(ticketId);
    if (!ticket) {
      const error = new Error("Ticket not found");
      error.status = 404;
      throw error;
    }
    return { message: "Ticket closed", data: ticket };
  }
}

module.exports = CustomerService;
