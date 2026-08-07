const TELEGRAM_API_BASE = "https://api.telegram.org";
const RESEND_API_BASE = "https://api.resend.com";
const DEFAULT_ZALO_MESSAGE_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";

const clean = (value, max = 1000) => String(value || "").trim().slice(0, max);

function getProviderConfig() {
  return {
    telegram: {
      configured: Boolean(clean(process.env.TELEGRAM_BOT_TOKEN)),
      botUsername: clean(process.env.TELEGRAM_BOT_USERNAME, 64).replace(/^@+/, ""),
    },
    email: {
      configured: Boolean(
        clean(process.env.RESEND_API_KEY) && clean(process.env.RESEND_FROM_EMAIL, 320),
      ),
    },
    zalo: {
      configured: Boolean(clean(process.env.ZALO_OA_ACCESS_TOKEN)),
    },
  };
}

function appUrl(relativeUrl = "/friends?slot=1") {
  const base = clean(
    process.env.PUBLIC_WEB_URL || process.env.APP_PUBLIC_URL || "https://duchi.vercel.app",
    500,
  ).replace(/\/+$/, "");
  const path = String(relativeUrl || "/friends?slot=1");
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("vi-VN");
}

function buildSlotMessage(payload = {}) {
  const celeb = payload.celeb || {};
  const username = clean(celeb.username || payload.username, 64).replace(/^@+/, "");
  const availableSlots = Math.max(0, Number(celeb.availableSlots) || 0);
  const friendCount = Math.max(0, Number(celeb.friendCount) || 0);
  const maxFriends = Math.max(0, Number(celeb.maxFriends) || 0);
  const title = clean(payload.title, 140) || "🔥 Slot vừa mở!";
  const body = username
    ? `@${username} hiện còn ${formatNumber(availableSlots)} slot trống.`
    : clean(payload.body, 1000) || "Canh Slot vừa phát hiện slot trống.";
  const countLine = maxFriends > 0
    ? `👥 ${formatNumber(friendCount)} / ${formatNumber(maxFriends)} bạn`
    : "";
  const url = appUrl(payload.url || "/friends?slot=1");
  return {
    title,
    body,
    url,
    text: [title, body, countLine, `Mở Huy Locket: ${url}`].filter(Boolean).join("\n"),
    username,
    availableSlots,
    friendCount,
    maxFriends,
  };
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw || null;
  }
  return { data, raw };
}

async function sendTelegram(chatId, payload) {
  const token = clean(process.env.TELEGRAM_BOT_TOKEN, 500);
  const target = clean(chatId, 120);
  if (!token) {
    const error = new Error("Telegram Bot chưa được cấu hình trên Railway.");
    error.code = "TELEGRAM_NOT_CONFIGURED";
    throw error;
  }
  if (!target) {
    const error = new Error("Chưa có Telegram Chat ID.");
    error.code = "TELEGRAM_CHAT_REQUIRED";
    throw error;
  }

  const message = buildSlotMessage(payload);
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: target,
      text: message.text,
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: "Mở Huy Locket", url: message.url }]],
      },
    }),
  });
  const { data } = await parseResponse(response);
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.description || "Telegram gửi thông báo thất bại.");
    error.code = "TELEGRAM_SEND_FAILED";
    error.status = response.status;
    throw error;
  }
  return { ok: true, provider: "telegram", messageId: data?.result?.message_id || null };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmail(email, payload, { idempotencyKey = "" } = {}) {
  const apiKey = clean(process.env.RESEND_API_KEY, 500);
  const from = clean(process.env.RESEND_FROM_EMAIL, 320);
  const target = clean(email, 320);
  if (!apiKey || !from) {
    const error = new Error("Email/Gmail chưa được cấu hình trên Railway.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
  if (!target) {
    const error = new Error("Chưa có địa chỉ Gmail/Email.");
    error.code = "EMAIL_ADDRESS_REQUIRED";
    throw error;
  }

  const message = buildSlotMessage(payload);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "Huy-Locket-Slot-Monitor/1.0",
  };
  const key = clean(idempotencyKey, 240);
  if (key) headers["Idempotency-Key"] = key;

  const response = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: [target],
      subject: message.title,
      text: message.text,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
          <h2 style="margin:0 0 12px">${escapeHtml(message.title)}</h2>
          <p style="margin:0 0 8px">${escapeHtml(message.body)}</p>
          ${message.maxFriends > 0 ? `<p style="margin:0 0 16px">👥 ${escapeHtml(formatNumber(message.friendCount))} / ${escapeHtml(formatNumber(message.maxFriends))} bạn</p>` : ""}
          <a href="${escapeHtml(message.url)}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#111827;color:#fff;text-decoration:none">Mở Huy Locket</a>
        </div>
      `,
    }),
  });
  const { data } = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(data?.message || "Email/Gmail gửi thông báo thất bại.");
    error.code = "EMAIL_SEND_FAILED";
    error.status = response.status;
    throw error;
  }
  return { ok: true, provider: "email", messageId: data?.id || null };
}

async function sendZalo(userId, payload) {
  const accessToken = clean(process.env.ZALO_OA_ACCESS_TOKEN, 2000);
  const target = clean(userId, 160);
  const endpoint = clean(process.env.ZALO_OA_MESSAGE_URL, 1000) || DEFAULT_ZALO_MESSAGE_URL;
  if (!accessToken) {
    const error = new Error("Zalo OA chưa được cấu hình trên Railway.");
    error.code = "ZALO_NOT_CONFIGURED";
    throw error;
  }
  if (!target) {
    const error = new Error("Chưa có Zalo User ID.");
    error.code = "ZALO_USER_REQUIRED";
    throw error;
  }

  const message = buildSlotMessage(payload);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      access_token: accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { user_id: target },
      message: { text: message.text.slice(0, 2000) },
    }),
  });
  const { data } = await parseResponse(response);
  const zaloError = Number(data?.error || 0);
  if (!response.ok || zaloError !== 0) {
    const error = new Error(data?.message || "Zalo gửi thông báo thất bại.");
    error.code = "ZALO_SEND_FAILED";
    error.status = response.status;
    throw error;
  }
  return {
    ok: true,
    provider: "zalo",
    messageId: data?.data?.message_id || data?.data?.messageId || null,
  };
}

module.exports = {
  getProviderConfig,
  buildSlotMessage,
  sendTelegram,
  sendEmail,
  sendZalo,
};
