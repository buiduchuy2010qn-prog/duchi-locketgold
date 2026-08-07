const express = require("express");
const { verifyIdToken } = require("../../middlewares/Auth");
const store = require("./store");
const { sanitizeWatchInput } = require("./core");
const {
  enableBackgroundPush,
  getPublicConfig,
  checkNowForUser,
  sendPushToUser,
} = require("./service");

const router = express.Router();
const MAX_WATCHES = 20;

function mapWatch(row) {
  return {
    uid: row.celeb_uid,
    username: row.username,
    displayName: row.display_name || row.username,
    avatar: row.avatar_url || "",
    friendCount: Number(row.friend_count) || 0,
    maxFriends: Number(row.max_friends) || 0,
    status: row.status,
    lastWasFull: Boolean(row.last_was_full),
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).getTime() : null,
    notifiedAt: row.notified_at ? new Date(row.notified_at).getTime() : null,
    enabled: Boolean(row.enabled),
  };
}

router.get("/config", async (_req, res) => {
  try {
    const config = await getPublicConfig();
    return res.json({ success: true, data: config });
  } catch (error) {
    return res.status(503).json({
      success: false,
      code: error?.code || "SLOT_MONITOR_UNAVAILABLE",
      message: "Canh Slot 24/7 chưa sẵn sàng.",
    });
  }
});

router.get("/watches", verifyIdToken, async (req, res, next) => {
  try {
    const rows = await store.listUserWatches(req.user.uid);
    return res.json({ success: true, data: rows.map(mapWatch) });
  } catch (error) {
    return next(error);
  }
});

router.post("/enable", verifyIdToken, async (req, res, next) => {
  try {
    const refreshToken = String(req.body?.refreshToken || "").trim();
    const subscription = req.body?.subscription || null;
    const config = await enableBackgroundPush({
      userUid: req.user.uid,
      refreshToken,
      subscription,
      userAgent: req.headers["user-agent"] || "",
    });
    return res.json({
      success: true,
      message: "Canh Slot 24/7 đã bật.",
      data: config,
    });
  } catch (error) {
    const status = Number(error?.status) || 400;
    return res.status(status).json({
      success: false,
      code: error?.code || "SLOT_ENABLE_FAILED",
      message: error?.message || "Không thể bật Canh Slot 24/7.",
    });
  }
});

router.post("/watch", verifyIdToken, async (req, res, next) => {
  try {
    const watch = sanitizeWatchInput(req.body?.watch || req.body);
    if (!watch) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SLOT_WATCH",
        message: "Thông tin Celeb không hợp lệ.",
      });
    }

    const current = await store.listUserWatches(req.user.uid);
    const exists = current.some((item) => String(item.celeb_uid) === String(watch.uid));
    if (!exists && current.length >= MAX_WATCHES) {
      return res.status(400).json({
        success: false,
        code: "SLOT_WATCH_LIMIT",
        message: `Bạn chỉ có thể canh tối đa ${MAX_WATCHES} tài khoản.`,
      });
    }

    await store.upsertWatch(req.user.uid, watch);
    return res.json({ success: true, data: watch });
  } catch (error) {
    return next(error);
  }
});

router.patch("/watch/:uid", verifyIdToken, async (req, res, next) => {
  try {
    await store.setWatchEnabled(req.user.uid, req.params.uid, req.body?.enabled !== false);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.delete("/watch/:uid", verifyIdToken, async (req, res, next) => {
  try {
    await store.removeWatch(req.user.uid, req.params.uid);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/check/:uid", verifyIdToken, async (req, res, next) => {
  try {
    const result = await checkNowForUser(req.user.uid, req.params.uid, req.user.idToken);
    return res.json({ success: true, data: result?.transition || null });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        code: error?.code || "SLOT_CHECK_FAILED",
        message: error?.message || "Không thể kiểm tra slot.",
      });
    }
    return next(error);
  }
});

router.post("/test-push", verifyIdToken, async (req, res, next) => {
  try {
    const result = await sendPushToUser(req.user.uid, {
      type: "slot-test",
      title: "🔔 Huy Locket Canh Slot",
      body: "Thông báo màn hình khóa đã hoạt động.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "slot-monitor-test",
      url: "/friends?slot=1",
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
