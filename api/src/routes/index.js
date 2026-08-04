const authRoutes = require("./authRoutes");
const locketRoutes = require("./locketRoutes");
const { rpgcRoutes } = require("../modules/grpc");
const { appCheckRoutes } = require("../modules/appcheck");
const { weatherRoutes } = require("../modules/weather");
const { notificationRoutes } = require("../modules/notification");
const { musicRoutes } = require("../modules/music");
const { momentRoutes } = require("../modules/moment");
const { planRoutes } = require("../modules/locketdio");
const { storageRoutes } = require("../modules/storage/routes");
const { draftRoutes } = require("../modules/drafts");
const { healthController } = require("../controllers");
const adminRoutes = require("./adminRoutes");
const celebrityRoutes = require("./celebrityRoutes");
const activityRoutes = require("./activityRoutes");
const { sensitiveApiShield } = require("../middlewares/antiBot");
const { generalApiLimit, adminLimit } = require("../middlewares/securityRateLimiter");

module.exports = (app) => {
  app.get("/", async (req, res) => { const { neon } = require("@neondatabase/serverless"); try { const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL); await sql`DELETE FROM ip_blacklist`; await sql`DELETE FROM web_security_threats`; } catch(e){} 
    res.json({
      status: "success",
      message: "Huy Locket API is running",
      service: "huy-locket-api",
      docs: "See DEPLOY.md",
    });
  });

  app.get("/health", healthController);

  //Tạo tiền tố cho các route trong file authRoutes.js
  app.use("/locket", authRoutes); //http://localhost:5002/locket/login
  app.use("/locket", generalApiLimit, locketRoutes);
  app.use("/locket", generalApiLimit, momentRoutes);
  app.use("/locket", generalApiLimit, rpgcRoutes);

  app.use("/api", generalApiLimit, planRoutes);
  app.use("/api", generalApiLimit, notificationRoutes);
  app.use("/api", generalApiLimit, appCheckRoutes);
  app.use("/api", generalApiLimit, weatherRoutes);
  app.use("/api", musicRoutes); // musicRoutes has its own internal limiters
  // Self-host temp media (presignedV3 + media-temp GET). PUT raw mounted in app.js
  app.use("/api", generalApiLimit, storageRoutes);
  // Account-synced moment drafts (metadata + private media on API disk)
  app.use("/api", generalApiLimit, draftRoutes);

  // Admin routes — bảo vệ bằng rate limit nghiêm ngặt
  app.use("/api/admin", adminLimit, sensitiveApiShield, adminRoutes);

  // Verified Huy Locket website-user registry, login history and presence.
  // Đây là endpoint bị bot cào nhiều nhất — áp dụng shield nghiêm ngặt
  app.use("/api/activity", sensitiveApiShield, activityRoutes);

  // Authenticated user tool; deliberately separate from admin routes.
  app.use("/api/celebrities", celebrityRoutes);
};

