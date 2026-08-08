const express = require("express");
const { verifyIdToken } = require("../../middlewares/Auth");
const notificationHistoryStore = require("./notificationHistoryStore");
const { getAccountHealth } = require("./accountHealth");
const {
  getNotificationSettings,
  saveNotificationSettings,
  testNotificationChannel,
  rememberNotificationWebOrigin,
} = require("./notificationService");

const router = express.Router();

function requestWebOrigin(req) {
  return String(
    req.body?.webOrigin ||
      req.query?.webOrigin ||
      req.headers.origin ||
      "",
  ).trim();
}

function mapHistory(row) {
  return {
    id: String(row.id),
    eventId: row.event_id || "",
    channel: row.channel || "",
    status: row.status || "",
    type: row.notification_type || "",
    title: row.title || "",
    body: row.body || "",
    url: row.url || "",
    username: row.username || "",
    availableSlots: Number(row.available_slots) || 0,
    errorCode: row.error_code || "",
    errorMessage: row.error_message || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
  };
}

router.get("/", verifyIdToken, async (req, res, next) => {
  try {
    await rememberNotificationWebOrigin(req.user.uid, requestWebOrigin(req));
    const settings = await getNotificationSettings(req.user.uid);
    return res.json({ success: true, data: settings });
  } catch (error) {
    return next(error);
  }
});

router.get("/account-health", verifyIdToken, async (req, res, next) => {
  try {
    await rememberNotificationWebOrigin(req.user.uid, requestWebOrigin(req));
    const health = await getAccountHealth(req.user.uid);
    return res.json({ success: true, data: health });
  } catch (error) {
    return next(error);
  }
});

router.get("/history", verifyIdToken, async (req, res, next) => {
  try {
    const rows = await notificationHistoryStore.listDeliveries(req.user.uid, {
      channel: req.query?.channel || "",
      limit: req.query?.limit || 180,
    });
    return res.json({ success: true, data: rows.map(mapHistory) });
  } catch (error) {
    return next(error);
  }
});

router.put("/", verifyIdToken, async (req, res, next) => {
  try {
    await rememberNotificationWebOrigin(req.user.uid, requestWebOrigin(req));
    const settings = await saveNotificationSettings(req.user.uid, req.body || {});
    return res.json({
      success: true,
      message: "Đã lưu kênh thông báo Canh Slot.",
      data: settings,
    });
  } catch (error) {
    const status = Number(error?.status) || 400;
    if (status < 500) {
      return res.status(status).json({
        success: false,
        code: error?.code || "NOTIFICATION_SETTINGS_INVALID",
        message: error?.message || "Cài đặt thông báo không hợp lệ.",
      });
    }
    return next(error);
  }
});

router.post("/test/:channel", verifyIdToken, async (req, res, next) => {
  try {
    const webOrigin = requestWebOrigin(req);
    await rememberNotificationWebOrigin(req.user.uid, webOrigin);
    const result = await testNotificationChannel(req.user.uid, req.params.channel, {
      webOrigin,
    });
    return res.json({
      success: true,
      message: "Đã gửi thông báo thử.",
      data: result,
    });
  } catch (error) {
    const status = Number(error?.status) || 400;
    if (status < 500 || String(error?.code || "").includes("_SEND_FAILED")) {
      return res.status(status >= 400 && status < 600 ? status : 400).json({
        success: false,
        code: error?.code || "NOTIFICATION_TEST_FAILED",
        message: error?.message || "Không gửi được thông báo thử.",
      });
    }
    return next(error);
  }
});

module.exports = router;
