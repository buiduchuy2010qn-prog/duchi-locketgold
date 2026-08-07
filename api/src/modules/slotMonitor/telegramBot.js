const TELEGRAM_API_BASE = "https://api.telegram.org";

let pollingStarted = false;
let pollingStopped = false;
let nextOffset = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value, max = 1000) => String(value || "").trim().slice(0, max);

function getBotToken() {
  return clean(process.env.TELEGRAM_BOT_TOKEN, 500);
}

function getBotUsername() {
  return clean(process.env.TELEGRAM_BOT_USERNAME, 64).replace(/^@+/, "");
}

function getWebUrl() {
  return clean(
    process.env.PUBLIC_WEB_URL || process.env.APP_PUBLIC_URL || "https://duchi.vercel.app",
    500,
  ).replace(/\/+$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    "2. Mở Duchi Locket → Canh Slot → Telegram.",
    "3. Dán Chat ID vào ô Telegram Chat ID.",
    "4. Bật Telegram → Lưu → Gửi thử.",
    "",
    "Sau khi liên kết, khi Celeb mở slot thì bot sẽ gửi đúng vào Telegram của bạn.",
    "",
    "Lệnh nhanh: /id để xem lại Chat ID • /help để xem hướng dẫn.",
  ].join("\n");
}

async function sendGuide(message) {
  const chatId = String(message?.chat?.id || "");
  if (!chatId) return;

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: buildGuideMessage(message),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Mở Duchi Locket để liên kết",
            url: `${getWebUrl()}/friends?slot=1`,
          },
        ],
      ],
    },
  });
}

async function handleUpdate(update) {
  const message = update?.message;
  if (!message || message?.chat?.type !== "private") return;

  const text = clean(message.text, 500);
  const command = text.split(/\s+/)[0].toLowerCase().split("@")[0];

  if (["/start", "/id", "/help"].includes(command) || !text) {
    await sendGuide(message);
    return;
  }

  // Bot này chỉ dùng để nhận thông báo Canh Slot. Với tin nhắn thường,
  // vẫn hiện Chat ID + hướng dẫn để người dùng không phải tự gọi getUpdates.
  await sendGuide(message);
}

async function configureBot() {
  const botUsername = getBotUsername();
  try {
    // Long polling và webhook không thể chạy cùng lúc. Xóa webhook cũ nếu có,
    // nhưng giữ lại pending updates để không làm mất /start vừa gửi.
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
    `[telegram-bot] link helper enabled${botUsername ? ` for @${botUsername}` : ""}`,
  );
}

async function pollLoop() {
  while (!pollingStopped) {
    try {
      const body = {
        timeout: 25,
        allowed_updates: ["message"],
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
