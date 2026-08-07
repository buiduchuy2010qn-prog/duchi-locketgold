const TELEGRAM_API_BASE = "https://api.telegram.org";
const store = require("./store");
const authServices = require("../../services/AuthSecurity/AuthServices");
const { decryptSecret, encryptSecret } = require("./crypto");
const { decodeFirebaseUid } = require("./core");
const { checkNowForUser } = require("./service");
const {
  getUserUidByTelegramChatId,
  getNotificationSettings,
} = require("./notificationService");

let pollingStarted = false;
let pollingStopped = false;
let nextOffset = null;
const refreshCooldowns = new Map();
const REFRESH_COOLDOWN_MS = 10_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value, max = 1000) => String(value || "").trim().slice(0, max);

function getBotToken() {
  return clean(process.env.TELEGRAM_BOT_TOKEN, 500);
}

function getBotUsername() {
  return clean(process.env.TELEGRAM_BOT_USERNAME, 64).replace(/^@+/, "");
}

function getWebUrls() {
  const vercel = clean(
    process.env.VERCEL_PUBLIC_WEB_URL ||
      process.env.PUBLIC_WEB_URL ||
      process.env.APP_PUBLIC_URL ||
      "https://duchi.vercel.app",
    500,
  ).replace(/\/+$/, "");

  const railway = clean(
    process.env.RAILWAY_PUBLIC_WEB_URL ||
      "https://huy-locket-production.up.railway.app",
    500,
  ).replace(/\/+$/, "");

  return { vercel, railway };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("vi-VN");
}

function formatUpdatedAt(value) {
  if (!value) return "chưa có dữ liệu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "chưa có dữ liệu";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function availableSlots(watch) {
  const maxFriends = Math.max(0, Number(watch?.max_friends) || 0);
  const friendCount = Math.max(0, Number(watch?.friend_count) || 0);
  if (!maxFriends) return null;
  return Math.max(0, maxFriends - friendCount);
}

async function telegramApi(method, body = {}, { timeoutMs = 15000 } = {}) {
  const token = getBotToken();
  if (!token) {
    const error = new Error("TELEGRAM_BOT_TOKEN missing");
    error.code = "TELEGRAM_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.description || `Telegram ${method} failed`);
    error.code = "TELEGRAM_API_FAILED";
    error.status = response.status;
    throw error;
  }

  return data?.result;
}

function buildGuideMessage(message) {
  const chatId = String(message?.chat?.id || "");
  const firstName = clean(message?.from?.first_name, 80);
  const greeting = firstName ? `Xin chào <b>${escapeHtml(firstName)}</b>!\n\n` : "";

  return [
    `${greeting}<b>DUCHI LOCKET - LIÊN KẾT TELEGRAM</b>`,
    "",
    "Telegram Chat ID của bạn là:",
    `<code>${escapeHtml(chatId)}</code>`,
    "",
    "<b>Cách liên kết:</b>",
    "1. Sao chép Chat ID ở trên.",
    "2. Chọn đúng bản Duchi Locket bạn đang dùng: Vercel hoặc Railway.",
    "3. Vào Canh Slot → Telegram và dán Chat ID.",
    "4. Bật Telegram → Lưu → Gửi thử.",
    "",
    "<b>Xem slot ngay trên Telegram:</b>",
    "• /slots — xem tất cả Celeb đang canh từ dữ liệu Railway mới nhất.",
    "• /slot @username — xem riêng một Celeb và có nút Làm mới thật.",
    "",
    "Hai bản dùng chung tài khoản và cùng bot; link mở Duchi Locket sẽ ưu tiên đúng bản web đã dùng gần nhất.",
    "",
    "Lệnh nhanh: /id • /slots • /slot @username • /help",
  ].join("\n");
}

async function sendGuide(message) {
  const chatId = String(message?.chat?.id || "");
  if (!chatId) return;

  const { vercel, railway } = getWebUrls();

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: buildGuideMessage(message),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Mở bản Vercel",
            url: `${vercel}/friends?slot=1`,
          },
          {
            text: "Mở bản Railway",
            url: `${railway}/friends?slot=1`,
          },
        ],
      ],
    },
  });
}

async function getLinkedContext(chatId) {
  const userUid = await getUserUidByTelegramChatId(chatId);
  if (!userUid) return null;
  const [watches, settings] = await Promise.all([
    store.listUserWatches(userUid),
    getNotificationSettings(userUid),
  ]);
  return {
    userUid,
    watches: Array.isArray(watches) ? watches : [],
    webOrigin: clean(settings?.webOrigin, 500) || "https://duchi.vercel.app",
  };
}

function buildUnlinkedMessage() {
  return [
    "<b>Chưa tìm thấy tài khoản Duchi Locket liên kết với Telegram này.</b>",
    "",
    "Vào Duchi Locket → Canh Slot → Telegram, dán Chat ID, bật Telegram rồi bấm Lưu hoặc Gửi thử.",
    "Sau đó dùng lại /slots.",
  ].join("\n");
}

function buildWatchBlock(watch, { includeUpdatedAt = true } = {}) {
  const username = clean(watch?.username, 64).replace(/^@+/, "") || "unknown";
  const friendCount = Math.max(0, Number(watch?.friend_count) || 0);
  const maxFriends = Math.max(0, Number(watch?.max_friends) || 0);
  const slots = availableSlots(watch);
  const lines = [`<b>@${escapeHtml(username)}</b>`];

  if (maxFriends > 0) {
    lines.push(`👥 ${formatNumber(friendCount)} / ${formatNumber(maxFriends)}`);
    lines.push(
      slots > 0
        ? `✅ Còn <b>${formatNumber(slots)} slot</b>`
        : "🔴 <b>Hết slot</b>",
    );
  } else {
    lines.push("⚪ Chưa có dữ liệu giới hạn bạn bè.");
  }

  if (!watch?.enabled) lines.push("⏸ Đang tạm dừng Canh Slot");
  if (includeUpdatedAt) lines.push(`🕒 ${escapeHtml(formatUpdatedAt(watch?.last_checked_at))}`);
  return lines.join("\n");
}

function buildSlotKeyboard(watch, webOrigin) {
  const username = clean(watch?.username, 64).replace(/^@+/, "");
  const uid = clean(watch?.celeb_uid, 100);
  const url = `${String(webOrigin || "https://duchi.vercel.app").replace(/\/+$/, "")}/friends?slot=1&username=${encodeURIComponent(username)}`;
  return {
    inline_keyboard: [
      [{ text: "🔄 Làm mới thật", callback_data: `slot_refresh:${uid}` }],
      [{ text: "Mở Duchi Locket", url }],
    ],
  };
}

async function sendSlots(message) {
  const chatId = String(message?.chat?.id || "");
  if (!chatId) return;
  const context = await getLinkedContext(chatId);
  if (!context) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: buildUnlinkedMessage(),
      parse_mode: "HTML",
    });
    return;
  }

  if (!context.watches.length) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Chưa có Celeb nào trong danh sách Canh Slot.",
      reply_markup: {
        inline_keyboard: [[{ text: "Mở Canh Slot", url: `${context.webOrigin}/friends?slot=1` }]],
      },
    });
    return;
  }

  const sorted = [...context.watches].sort((a, b) => {
    const aSlots = availableSlots(a);
    const bSlots = availableSlots(b);
    if (aSlots === null && bSlots !== null) return 1;
    if (aSlots !== null && bSlots === null) return -1;
    if ((aSlots || 0) !== (bSlots || 0)) return (bSlots || 0) - (aSlots || 0);
    return String(a.username || "").localeCompare(String(b.username || ""));
  });

  const blocks = sorted.map((watch) => buildWatchBlock(watch));
  const text = [
    "🔥 <b>CANH SLOT DUCHI LOCKET</b>",
    "",
    ...blocks.flatMap((block, index) => (index ? ["", block] : [block])),
    "",
    "Dữ liệu trên là snapshot mới nhất Railway đã canh. Dùng <code>/slot @username</code> để kiểm tra riêng và làm mới trực tiếp từ Locket.",
  ].join("\n");

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: "Mở Duchi Locket", url: `${context.webOrigin}/friends?slot=1` }]],
    },
  });
}

async function sendSingleSlot(message, rawUsername) {
  const chatId = String(message?.chat?.id || "");
  if (!chatId) return;
  const username = clean(rawUsername, 64).replace(/^@+/, "").toLowerCase();
  if (!username) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Dùng: <code>/slot @username</code>",
      parse_mode: "HTML",
    });
    return;
  }

  const context = await getLinkedContext(chatId);
  if (!context) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: buildUnlinkedMessage(),
      parse_mode: "HTML",
    });
    return;
  }

  const watch = context.watches.find(
    (item) => clean(item?.username, 64).replace(/^@+/, "").toLowerCase() === username,
  );
  if (!watch) {
    const names = context.watches
      .slice(0, 12)
      .map((item) => `@${clean(item?.username, 64).replace(/^@+/, "")}`)
      .filter(Boolean)
      .join(", ");
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `Không tìm thấy <b>@${escapeHtml(username)}</b> trong danh sách Canh Slot.${names ? `\n\nĐang canh: ${escapeHtml(names)}` : ""}`,
      parse_mode: "HTML",
    });
    return;
  }

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: `🔥 <b>CHI TIẾT SLOT</b>\n\n${buildWatchBlock(watch)}`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: buildSlotKeyboard(watch, context.webOrigin),
  });
}

async function refreshIdTokenForUser(userUid) {
  const session = await store.getSession(userUid);
  if (!session?.enabled || !session?.refresh_token_enc) {
    const error = new Error("Chưa bật Canh Slot 24/7 hoặc phiên nền đã mất. Hãy mở Duchi Locket và bật lại Canh Slot 24/7.");
    error.code = "SLOT_SESSION_MISSING";
    throw error;
  }

  const refreshToken = decryptSecret(session.refresh_token_enc);
  const refreshed = await authServices.refreshIdToken(refreshToken);
  const idToken = refreshed?.id_token || refreshed?.access_token;
  const decodedUid = decodeFirebaseUid(idToken);
  if (!idToken || !decodedUid || String(decodedUid) !== String(userUid)) {
    const error = new Error("Phiên Locket nền không khớp tài khoản đang liên kết.");
    error.code = "SLOT_SESSION_MISMATCH";
    throw error;
  }

  const nextRefreshToken = refreshed?.refresh_token || refreshToken;
  await store.markSessionRefreshed(userUid, encryptSecret(nextRefreshToken));
  return idToken;
}

async function handleSlotRefresh(query) {
  const chatId = String(query?.message?.chat?.id || "");
  const data = clean(query?.data, 160);
  const celebUid = data.startsWith("slot_refresh:") ? data.slice("slot_refresh:".length) : "";
  if (!chatId || !celebUid) return;

  const context = await getLinkedContext(chatId);
  if (!context) {
    await telegramApi("answerCallbackQuery", {
      callback_query_id: query.id,
      text: "Chưa liên kết Duchi Locket với Telegram này.",
      show_alert: true,
    });
    return;
  }

  const watch = context.watches.find((item) => String(item?.celeb_uid) === celebUid);
  if (!watch) {
    await telegramApi("answerCallbackQuery", {
      callback_query_id: query.id,
      text: "Celeb này không còn trong danh sách Canh Slot.",
      show_alert: true,
    });
    return;
  }

  const cooldownKey = `${chatId}:${celebUid}`;
  const lastRefreshAt = Number(refreshCooldowns.get(cooldownKey) || 0);
  const remainingMs = REFRESH_COOLDOWN_MS - (Date.now() - lastRefreshAt);
  if (remainingMs > 0) {
    await telegramApi("answerCallbackQuery", {
      callback_query_id: query.id,
      text: `Chờ ${Math.ceil(remainingMs / 1000)} giây rồi làm mới lại.`,
    });
    return;
  }
  refreshCooldowns.set(cooldownKey, Date.now());

  await telegramApi("answerCallbackQuery", {
    callback_query_id: query.id,
    text: "Đang kiểm tra trực tiếp từ Locket...",
  });

  try {
    const idToken = await refreshIdTokenForUser(context.userUid);
    const result = await checkNowForUser(context.userUid, celebUid, idToken);
    if (!result?.ok) throw result?.error || new Error("Locket không trả dữ liệu slot hợp lệ.");

    const latest = (await store.listUserWatches(context.userUid)).find(
      (item) => String(item?.celeb_uid) === celebUid,
    );
    if (!latest) throw new Error("Không đọc lại được dữ liệu Celeb sau khi làm mới.");

    await telegramApi("editMessageText", {
      chat_id: chatId,
      message_id: query.message.message_id,
      text: `🔥 <b>CHI TIẾT SLOT — VỪA LÀM MỚI</b>\n\n${buildWatchBlock(latest)}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: buildSlotKeyboard(latest, context.webOrigin),
    });
  } catch (error) {
    console.warn("[telegram-bot] slot refresh failed", {
      chatId,
      celebUid,
      code: error?.code || null,
    });
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `⚠️ Không làm mới được slot trực tiếp.\n${escapeHtml(error?.message || "Vui lòng thử lại sau.")}`,
      parse_mode: "HTML",
    }).catch(() => {});
  }
}

async function handleUpdate(update) {
  if (update?.callback_query) {
    const query = update.callback_query;
    if (query?.message?.chat?.type === "private" && clean(query?.data, 160).startsWith("slot_refresh:")) {
      await handleSlotRefresh(query);
    }
    return;
  }

  const message = update?.message;
  if (!message || message?.chat?.type !== "private") return;

  const text = clean(message.text, 500);
  const parts = text.split(/\s+/).filter(Boolean);
  const command = (parts[0] || "").toLowerCase().split("@")[0];

  if (command === "/slots") {
    await sendSlots(message);
    return;
  }
  if (command === "/slot") {
    await sendSingleSlot(message, parts.slice(1).join(" "));
    return;
  }
  if (["/start", "/id", "/help"].includes(command) || !text) {
    await sendGuide(message);
    return;
  }

  await sendGuide(message);
}

async function configureBot() {
  const botUsername = getBotUsername();
  try {
    await telegramApi("deleteWebhook", { drop_pending_updates: false });
  } catch (error) {
    console.warn("[telegram-bot] deleteWebhook failed", {
      status: error?.status || null,
      code: error?.code || null,
    });
  }

  try {
    await telegramApi("setMyCommands", {
      commands: [
        { command: "start", description: "Bắt đầu và lấy Chat ID" },
        { command: "id", description: "Hiện Telegram Chat ID của bạn" },
        { command: "slots", description: "Xem slot của tất cả Celeb đang canh" },
        { command: "slot", description: "Xem một Celeb: /slot @username" },
        { command: "help", description: "Hướng dẫn liên kết Duchi Locket" },
      ],
    });
  } catch (error) {
    console.warn("[telegram-bot] setMyCommands failed", {
      status: error?.status || null,
      code: error?.code || null,
    });
  }

  console.log(
    `[telegram-bot] slot helper enabled${botUsername ? ` for @${botUsername}` : ""}`,
  );
}

async function pollLoop() {
  while (!pollingStopped) {
    try {
      const body = {
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      };
      if (nextOffset !== null) body.offset = nextOffset;

      const updates = await telegramApi("getUpdates", body, { timeoutMs: 35000 });
      const items = Array.isArray(updates) ? updates : [];

      for (const update of items) {
        const updateId = Number(update?.update_id);
        if (Number.isFinite(updateId)) nextOffset = updateId + 1;

        try {
          await handleUpdate(update);
        } catch (error) {
          console.warn("[telegram-bot] update handling failed", {
            updateId: Number.isFinite(updateId) ? updateId : null,
            status: error?.status || null,
            code: error?.code || null,
          });
        }
      }
    } catch (error) {
      if (pollingStopped) break;
      const status = Number(error?.status) || null;
      console.warn("[telegram-bot] polling retry", {
        status,
        code: error?.code || null,
      });
      await sleep(status === 401 ? 30000 : 5000);
    }
  }
}

function startTelegramBotPolling() {
  if (pollingStarted) return true;
  if (!getBotToken()) {
    console.warn("[telegram-bot] helper disabled: TELEGRAM_BOT_TOKEN missing");
    return false;
  }

  pollingStarted = true;
  pollingStopped = false;

  configureBot()
    .catch((error) => {
      console.warn("[telegram-bot] configure failed", {
        status: error?.status || null,
        code: error?.code || null,
      });
    })
    .finally(() => pollLoop());

  return true;
}

function stopTelegramBotPolling() {
  pollingStopped = true;
}

module.exports = {
  startTelegramBotPolling,
  stopTelegramBotPolling,
  handleUpdate,
  buildGuideMessage,
};
