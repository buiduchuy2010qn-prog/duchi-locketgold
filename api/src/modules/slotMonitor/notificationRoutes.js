const express = require("express");
const { verifyIdToken } = require("../../middlewares/Auth");
const {
  getNotificationSettings,
  saveNotificationSettings,
  testNotificationChannel,
} = require("./notificationService");

const router = express.Router();

router.get("/", verifyIdToken, async (req, res, next) => {
  try {
    const settings = await getNotificationSettings(req.user.uid);
    return res.json({ success: true, data: settings });
  } catch (error) {
    return next(error);
  }
});

router.put("/", verifyIdToken, async (req, res, next) => {
  try {
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
    const result = await testNotificationChannel(req.user.uid, req.params.channel);
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
