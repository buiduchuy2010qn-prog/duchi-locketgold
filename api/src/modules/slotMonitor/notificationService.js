const store = require("./store");
const {
  getProviderConfig,
  sendTelegram,
  sendEmail,
  sendZalo,
} = require("./notifiers");

const CHANNELS = new Set(["telegram", "email", "zalo"]);

function sanitizeSettings(raw = {}) {
  const telegramChatId = String(raw.telegramChatId || "").trim().slice(0, 120);
  const emailAddress = String(raw.emailAddress || "").trim().toLowerCase().slice(0, 320);
  const zaloUserId = String(raw.zaloUserId || "").trim().slice(0, 160);

  if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
    const error = new Error("Địa chỉ Gmail/Email không hợp lệ.");
    error.code = "INVALID_EMAIL_ADDRESS";
    error.status = 400;
    throw error;
  }
  if (telegramChatId && !/^-?\d{4,24}$/.test(telegramChatId)) {
    const error = new Error("Telegram Chat ID không hợp lệ.");
    error.code = "INVALID_TELEGRAM_CHAT_ID";
    error.status = 400;
    throw error;
  }
  if (zaloUserId && !/^\d{4,40}$/.test(zaloUserId)) {
    const error = new Error("Zalo User ID không hợp lệ.");
    error.code = "INVALID_ZALO_USER_ID";
    error.status = 400;
    throw error;
  }

  return {
    telegramChatId,
    telegramEnabled: Boolean(raw.telegramEnabled && telegramChatId),
    emailAddress,
    emailEnabled: Boolean(raw.emailEnabled && emailAddress),
    zaloUserId,
    zaloEnabled: Boolean(raw.zaloEnabled && zaloUserId),
  };
}

async function getNotificationSettings(userUid) {
  const settings = await store.getNotificationSettings(userUid);
  return {
    ...settings,
    providers: getProviderConfig(),
  };
}

async function saveNotificationSettings(userUid, raw) {
  const settings = sanitizeSettings(raw);
  const saved = await store.saveNotificationSettings(userUid, settings);
  return {
    ...saved,
    providers: getProviderConfig(),
  };
}

function publicError(error) {
  return {
    ok: false,
    code: error?.code || "NOTIFICATION_SEND_FAILED",
    message: error?.message || "Gửi thông báo thất bại.",
  };
}

async function sendConfiguredNotifications(userUid, payload, { eventId = "" } = {}) {
  const settings = await store.getNotificationSettings(userUid);
  const tasks = [];

  if (settings.telegramEnabled && settings.telegramChatId) {
    tasks.push([
      "telegram",
      () => sendTelegram(settings.telegramChatId, payload),
    ]);
  }
  if (settings.emailEnabled && settings.emailAddress) {
    tasks.push([
      "email",
      () => sendEmail(settings.emailAddress, payload, {
        idempotencyKey: eventId ? `slot-${eventId}-email` : "",
      }),
    ]);
  }
  if (settings.zaloEnabled && settings.zaloUserId) {
    tasks.push(["zalo", () => sendZalo(settings.zaloUserId, payload)]);
  }

  const results = {};
  await Promise.all(
    tasks.map(async ([channel, send]) => {
      try {
        results[channel] = await send();
      } catch (error) {
        results[channel] = publicError(error);
        console.warn("[slot-monitor] external notification failed", {
          userUid,
          channel,
          code: error?.code || null,
          status: error?.status || null,
        });
      }
    }),
  );
  return results;
}

async function testNotificationChannel(userUid, channel) {
  const normalized = String(channel || "").trim().toLowerCase();
  if (!CHANNELS.has(normalized)) {
    const error = new Error("Kênh thông báo không hợp lệ.");
    error.code = "INVALID_NOTIFICATION_CHANNEL";
    error.status = 400;
    throw error;
  }

  const settings = await store.getNotificationSettings(userUid);
  const payload = {
    type: "slot-test",
    title: "Duchi Locket | Xác nhận kết nối Canh Slot",
    body: "Kênh thông báo đã kết nối thành công.",
    url: "/friends?slot=1",
  };

  if (normalized === "telegram") {
    return sendTelegram(settings.telegramChatId, payload);
  }
  if (normalized === "email") {
    return sendEmail(settings.emailAddress, payload, {
      idempotencyKey: `slot-test-${userUid}-${Date.now()}`,
    });
  }
  return sendZalo(settings.zaloUserId, payload);
}

module.exports = {
  sanitizeSettings,
  getNotificationSettings,
  saveNotificationSettings,
  sendConfiguredNotifications,
  testNotificationChannel,
};
