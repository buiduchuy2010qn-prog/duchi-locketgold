const store = require("./store");
const { getEncryptionKey } = require("./crypto");
const { getPublicConfig } = require("./service");
const { getProviderConfig } = require("./notifiers");

function item(id, label, status, detail, meta = {}) {
  return { id, label, status, detail, ...meta };
}

async function getSystemStatus() {
  let databaseOk = false;
  let databaseError = "";
  try {
    await store.getConfigValue("slot-system-status-probe");
    databaseOk = true;
  } catch (error) {
    databaseError = String(error?.message || "Database unavailable").slice(0, 220);
  }

  let slotConfig = null;
  let slotError = "";
  try {
    slotConfig = await getPublicConfig();
  } catch (error) {
    slotError = String(error?.message || "Slot monitor unavailable").slice(0, 220);
  }

  const providers = getProviderConfig();
  const slotReady = Boolean(
    slotConfig?.enabled && databaseOk && getEncryptionKey(),
  );
  const pollSeconds = Math.round(Number(slotConfig?.pollIntervalMs || 0) / 1000);
  const uptimeSeconds = Math.max(0, Math.floor(process.uptime()));

  const services = [
    item(
      "api",
      "Railway API",
      "OK",
      `Backend đang phản hồi • uptime ${uptimeSeconds.toLocaleString("vi-VN")} giây.`,
      { uptimeSeconds },
    ),
    item(
      "database",
      "Database",
      databaseOk ? "OK" : "ERROR",
      databaseOk ? "Neon database đang truy cập được." : databaseError,
    ),
    item(
      "slot-worker",
      "Canh Slot worker",
      slotReady ? "OK" : "ERROR",
      slotReady
        ? `Worker được cấu hình trên process API • chu kỳ ${pollSeconds || 45} giây.`
        : slotError || "Worker chưa đủ cấu hình database/encryption.",
      { pollIntervalMs: Number(slotConfig?.pollIntervalMs) || 0 },
    ),
    item(
      "auth",
      "Locket / Firebase Auth",
      "OK",
      "Yêu cầu System Status đã đi qua verifyIdToken thành công.",
    ),
    item(
      "telegram",
      "Telegram",
      providers?.telegram?.configured ? "OK" : "WARNING",
      providers?.telegram?.configured
        ? "Telegram Bot đã được cấu hình trên backend."
        : "Telegram Bot chưa được cấu hình.",
    ),
    item(
      "gmail",
      "Gmail relay",
      providers?.email?.configured ? "OK" : "WARNING",
      providers?.email?.configured
        ? "Google Apps Script Gmail relay đã được cấu hình."
        : "Gmail relay chưa được cấu hình.",
    ),
  ];

  const errors = services.filter((service) => service.status === "ERROR").length;
  const warnings = services.filter((service) => service.status === "WARNING").length;

  return {
    overall: errors > 0 ? "ERROR" : warnings > 0 ? "WARNING" : "OK",
    checkedAt: Date.now(),
    version: String(
      process.env.RAILWAY_GIT_COMMIT_SHA ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.GIT_COMMIT_SHA ||
        "",
    ).slice(0, 40),
    services,
  };
}

module.exports = { getSystemStatus };
