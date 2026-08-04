// server/index.js
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
const path = require("path");
const fs = require("fs");
const pool = require("./db");
const startNotificationScheduler = require("./cron/notificationScheduler");
const { exec } = require('child_process');

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const borrowRoutes = require("./routes/borrowRoutes");
const reportRoutes = require("./routes/reportRoutes");
const profileRoutes = require("./routes/profileRoutes");
const imageRecognitionRoutes = require("./routes/imageRecognitionRoutes");
const performanceRoutes = require("./routes/performanceRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const masterListRoutes = require("./routes/masterListRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const announcementsRoutes = require("./routes/announcementsRoutes");

// ✅ Testing System Routes
const metricsRouter = require("./testing/metricsAPI");

// ✅ Initialize Express
const app = express();

// ✅ Respect proxy headers so req.protocol resolves correctly behind Render / reverse proxies
app.set("trust proxy", 1);

/* -------------------- Database connectivity check -------------------- */
pool
  .connect()
  .then((client) => {
    console.log("✅ Database connected successfully");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Failed to connect to the database:", err.message);
  });

/* -------------------- CORS CONFIG -------------------- */
// ✅ Use FRONTEND_URL from .env for production, fallback to localhost
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);

// ✅ Add any Render frontend domains
const origin = process.env.FRONTEND_URL;
if (origin && origin.includes('onrender.com')) {
  allowedOrigins.add(origin);
}

const isLocalDevOrigin = (origin) => {
  return typeof origin === 'string' && /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/i.test(origin);
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // ✅ Allow any onrender.com domain for development flexibility
  const isRenderDomain = origin && origin.includes('onrender.com');
  const isAllowedOrigin = allowedOrigins.has(origin) || isLocalDevOrigin(origin);
  
  if (isRenderDomain || isAllowedOrigin) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

/* -------------------- Middleware -------------------- */
// ✅ Increased limit to handle large base64 encoded images from camera
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(cookieParser());

/* -------------------- Sessions -------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // ✅ Use HTTPS in production
      httpOnly: true,
      sameSite: "lax", // ✅ Allow cross-site requests for OAuth
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

/* -------------------- Passport Setup -------------------- */
require("./passport");
app.use(passport.initialize());
app.use(passport.session());

/* -------------------- Ensure public directories exist -------------------- */
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
};

const uploadsDir = path.join(__dirname, "public", "uploads");
const legacyUploadsDir = path.join(__dirname, "uploads"); // ✅ Also support existing uploads folder
const qrCodesDir = path.join(__dirname, "public", "qr_codes");

ensureDir(uploadsDir);
ensureDir(qrCodesDir);

/* -------------------- Static file serving -------------------- */
// ✅ Serve static folders with proper absolute paths
app.use("/uploads", express.static(uploadsDir));

// ✅ Also serve old /uploads folder if files were stored there
app.use("/uploads", express.static(legacyUploadsDir));

app.use("/qr_codes", express.static(qrCodesDir));

/* -------------------- File download endpoint -------------------- */
app.get("/api/files/download", (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: "Missing file path" });

    const sanitizedPath = filePath.replace(/^\/+/, "");
    const fullPath = path.join(__dirname, "public", sanitizedPath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(fullPath, (err) => {
      if (err) {
        console.error("File download error:", err);
        res.status(500).json({ error: "Failed to download file" });
      }
    });
  } catch (err) {
    console.error("Download endpoint error:", err);
    res.status(500).json({ error: "Server error during file download" });
  }
});

/* -------------------- Routes -------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/borrow", borrowRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/image-recognition", imageRecognitionRoutes);
app.use("/api/performances", performanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/master-list", masterListRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/announcements", announcementsRoutes);

// ✅ Testing System API Routes
app.use("/api", metricsRouter);

/* -------------------- Health Check -------------------- */
app.get("/api", (req, res) => {
  res.json({ message: "API is working" });
});

/* -------------------- 404 + Error handlers -------------------- */
app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

/* -------------------- Start Notification Scheduler -------------------- */
startNotificationScheduler();
console.log("🔔 Notification scheduler started");

/* -------------------- Start Server -------------------- */
const port = process.env.PORT || 5000;
app.listen(port, () =>
  console.log(`🚀 Server running at http://localhost:${port}`)
);

// Optionally run migrations on startup in production when explicitly requested
if (process.env.RUN_MIGRATIONS_ON_STARTUP === 'true') {
  console.log('🔁 RUN_MIGRATIONS_ON_STARTUP is true — running migrations now');
  exec('node scripts/apply_migrations.js', { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) {
      console.error('Migration process failed:', err);
      return;
    }
    if (stdout) console.log('MIGRATIONS STDOUT:', stdout);
    if (stderr) console.error('MIGRATIONS STDERR:', stderr);
  });
}
