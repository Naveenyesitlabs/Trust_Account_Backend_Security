const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const cron = require('node-cron');
const { authenticateToken } = require("./src/middleware/authMiddleware");
const csrf = require("./src/middleware/csrf");

dotenv.config();

const app = express(); // nosemgrep
const PORT = process.env.PORT;

app.disable('x-powered-by');

const allowedOrigins = new Set(
    [
        process.env.CLIENT_URL,
        process.env.ADMIN_URL,
        process.env.SUPERADMIN_URL,
        process.env.USER_URL,
        ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',') : [])
    ].filter(Boolean)
);

const isLocalOrigin = (origin = '') => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
const allowNonBrowserRequests =
    process.env.ALLOW_NON_BROWSER_REQUESTS === 'true' || process.env.NODE_ENV !== 'production';
const staticFileOptions = {
    dotfiles: 'deny',
    fallthrough: false,
    index: false,
    redirect: false,
    setHeaders(res) {
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
};

// ✅ Import webhook route and controller
const { stripeWebhook } = require("./src/controller/user/paymentController");

// ✅ Register Stripe webhook FIRST and use raw parser here only
app.post("/api/user/stripe/webhook", express.raw({ type: 'application/json' }), stripeWebhook);

// ✅ Now you can use other middlewares safely
app.use(bodyParser.json()); // after webhook
app.use(cookieParser());
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
});
app.use(cors({
    origin(origin, callback) {
        if ((origin && (allowedOrigins.has(origin) || isLocalOrigin(origin))) || (!origin && allowNonBrowserRequests)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    optionsSuccessStatus: 204
}));
app.use(csrf({ allowedOrigins, isLocalOrigin }));

// Protected static folders
app.use('/uploads', authenticateToken, express.static(path.join(__dirname, 'src/uploads'), staticFileOptions));
app.use('/downloads', authenticateToken, express.static(path.join(__dirname, 'src/downloads'), staticFileOptions));

// Import routes
const userRoutes = require("./src/routes/user/userProfileRoutes");
const accountsRoutes = require("./src/routes/user/accountsRoutes");
const userOpratationRoutes = require("./src/routes/user/userOpratationRoutes");
const adminRoutes = require("./src/routes/admin/userManagementRoutes");
const superAdminRoutes = require("./src/routes/superAdmin/manageFirmRoutes");

const { INIT_DEFAULT_MENU } = require("./src/config/menuConfig");
const { INIT_SUBSCRIPTION_PLAN } = require("./src/config/subscriptionConfig");
const { INIT_DEFAULT_ROLE } = require("./src/config/roleConfig");
const { runMonthlyTask } = require("./src/jobs/cronJobs");
const runScraper = require('./runScraper');

// ✅ Register Cron Job (runs every 5 minutes)
cron.schedule("*/5 * * * *", () => {
    console.log("⏰ Running monthly task at", new Date().toISOString());
    runMonthlyTask().catch(console.error);
});
// cron.schedule("30 0 * * *", () => {
//     console.log("⏰ Running monthly task at", new Date().toISOString());
//     runMonthlyTask().catch(console.error);
// });




// Register other routes
app.use("/api", userRoutes);
app.use("/api", accountsRoutes);
app.use("/api/user", userOpratationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/superadmin", superAdminRoutes);

app.listen(PORT, async (err) => {
    if (err) {
        console.log("Server failed to start");
    } else {
        console.log(`Server is running on ${PORT}`);
        await INIT_DEFAULT_MENU();
        await INIT_SUBSCRIPTION_PLAN();
        await INIT_DEFAULT_ROLE();

        // for wisefork scrapping
        runScraper();
    }
});
