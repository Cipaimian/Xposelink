// Load env from project root (one .env shared by local dev and Docker).
// In Docker the env comes through compose; the path lookup is a no-op there.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");

const { initMySqlDb } = require("./database/mysql");
const { PORT, PUBLIC_BASE_URL, FRONTEND_URL } = require("./config");

const UserModel = require("./models/UserModel");
const LinkModel = require("./models/LinkModel");
const TransactionModel = require("./models/TransactionModel");
const TicketModel = require("./models/TicketModel");
const GuestModel = require("./models/GuestModel");

const VerificationService = require("./services/VerificationService");
const AuthService = require("./services/AuthService");
const EmailService = require("./services/EmailService");
const SubscriptionService = require("./services/SubscriptionService");
const ShortenService = require("./services/ShortenService");
const UnshortenService = require("./services/UnshortenService");
const SecurityService = require("./services/SecurityService");
const SafeBrowsingService = require("./services/SafeBrowsingService");
const TransactionService = require("./services/TransactionService");
const MidtransService = require("./services/MidtransService");
const CustomerService = require("./services/CustomerService");

const AuthController = require("./controllers/AuthController");
const LinkController = require("./controllers/LinkController");
const TransactionController = require("./controllers/TransactionController");
const CustomerController = require("./controllers/CustomerController");
const AdminController = require("./controllers/AdminController");

const createAuthRoutes = require("./routes/authRoutes");
const createLinkRoutes = require("./routes/linkRoutes");
const createTransactionRoutes = require("./routes/transactionRoutes");
const createCustomerRoutes = require("./routes/customerRoutes");
const createAdminRoutes = require("./routes/adminRoutes");

async function bootstrap() {
  const app = express();

  // Trust reverse proxy headers (X-Forwarded-For, X-Forwarded-Proto) — required
  // when deployed behind nginx/Cloudflare/Railway/Render so client IPs and
  // Secure-cookie detection work correctly.
  app.set("trust proxy", 1);

  const isHttps = (FRONTEND_URL || "").startsWith("https://");
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Only set HSTS when actually serving HTTPS — otherwise browsers cache it
    // and refuse to load the site over HTTP.
    strictTransportSecurity: isHttps ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));
  app.use(compression());
  // Allow FRONTEND_URL + its `www.` variant (or vice-versa) + any chrome extension
  const frontendUrlVariants = new Set([FRONTEND_URL]);
  try {
    const u = new URL(FRONTEND_URL);
    const host = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
    frontendUrlVariants.add(`${u.protocol}//${host}`);
  } catch {}

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || frontendUrlVariants.has(origin) || /^chrome-extension:\/\//.test(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  const db = await initMySqlDb();

  // Models
  const userModel = new UserModel(db);
  const linkModel = new LinkModel(db);
  const transactionModel = new TransactionModel(db);
  const ticketModel = new TicketModel(db);
  const guestModel = new GuestModel(db);

  // Services
  const verificationService = new VerificationService();
  const emailService = new EmailService();
  const authService = new AuthService({ userModel, verificationService, emailService });
  const subscriptionService = new SubscriptionService({ userModel });
  const shortenService = new ShortenService({
    linkModel,
    subscriptionService,
    verificationService,
    publicBaseUrl: PUBLIC_BASE_URL,
  });
  const unshortenService = new UnshortenService({
    linkModel,
    subscriptionService,
    verificationService,
    publicBaseUrl: PUBLIC_BASE_URL,
  });
  const safeBrowsingService = new SafeBrowsingService();
  const securityService = new SecurityService({ safeBrowsingService });
  const transactionService = new TransactionService({ transactionModel, subscriptionService });
  const midtransService = new MidtransService({ transactionModel, subscriptionService, userModel });
  const customerService = new CustomerService({ ticketModel });

  // Controllers
  const authController = new AuthController(authService);
  const linkController = new LinkController({
    shortenService,
    unshortenService,
    subscriptionService,
    securityService,
    verificationService,
    linkModel,
    guestModel,
  });
  const transactionController = new TransactionController({ transactionService, midtransService });
  const customerController = new CustomerController({ customerService });
  const adminController = new AdminController({
    userModel,
    linkModel,
    transactionModel,
    subscriptionService,
  });

  app.get("/", (req, res) => {
    res.json({ message: "Xposelink API", version: "1.0.0" });
  });

  app.get("/api", (req, res) => {
    res.json({ message: "Xposelink backend is running" });
  });

  app.get("/api/security/feed-status", (req, res) => {
    res.json({ safeBrowsing: safeBrowsingService.stats() });
  });

  app.get("/api/plans", (req, res) =>
    res.json({ message: "Plans data (coming soon)" }),
  );
  app.get("/api/extensions", (req, res) =>
    res.json({ message: "Extensions data (coming soon)" }),
  );

  // Routes
  app.use("/api/auth", createAuthRoutes(authController));
  app.use("/api", createLinkRoutes(linkController));
  app.use("/api/transactions", createTransactionRoutes(transactionController));
  app.use("/api/support", createCustomerRoutes(customerController));
  app.use("/api/admin", createAdminRoutes(adminController));
  // Short link redirect — must be last so it doesn't intercept /api/* routes
  app.get("/:shortCode", linkController.redirect);

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
