const express = require("express");
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
const {
  generalApiLimit,
  adminLimit,
} = require("../middlewares/securityRateLimiter");

module.exports = (app) => {
  app.get("/", (_req, res) => {
    res.json({
      status: "success",
      message: "Huy Locket API is running",
      service: "huy-locket-api",
      docs: "See DEPLOY.md",
    });
  });

  app.get("/health", healthController);

  // Routes có limiter riêng phải mount trước generalApiLimit.
  app.use("/locket", authRoutes);
  app.use("/locket", momentRoutes); // postMomentV2 dùng uploadLimit riêng
  app.use("/api/admin", adminLimit, sensitiveApiShield, adminRoutes);
  app.use("/api/activity", sensitiveApiShield, activityRoutes);
  app.use("/api/celebrities", celebrityRoutes);
  app.use("/api", musicRoutes);

  // Các route Locket đọc/ghi thông thường dùng generalApiLimit.
  const locketRouter = express.Router();
  locketRouter.use(locketRoutes);
  locketRouter.use(rpgcRoutes);
  app.use("/locket", generalApiLimit, locketRouter);

  // Các route API chung dùng generalApiLimit.
  const apiRouter = express.Router();
  apiRouter.use(planRoutes);
  apiRouter.use(notificationRoutes);
  apiRouter.use(appCheckRoutes);
  apiRouter.use(weatherRoutes);
  apiRouter.use(storageRoutes);
  apiRouter.use(draftRoutes);
  app.use("/api", generalApiLimit, apiRouter);
};
