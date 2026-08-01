/**
 * Huy Locket Security Shield - Anti-Bot, Anti-Scraping & DDoS Shield
 * Bảo vệ máy chủ Railway khỏi Bot cào dữ liệu, tool tự động (curl, python, postman...) và tấn công DDoS
 */
const rateLimit = require("express-rate-limit");

// Danh sách từ khóa trong User-Agent của Bot, Tool cào dữ liệu, Scraper và Trình duyệt ảo
const BLOCKED_UA_KEYWORDS = [
  "curl/",
  "wget/",
  "python-requests",
  "scrapy",
  "aiohttp",
  "httpx",
  "libcurl",
  "go-http-client",
  "java/",
  "perl/",
  "ruby/",
  "urllib",
  "libwww",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "semrushbot",
  "bytespider",
  "baiduspider",
  "yandexbot",
  "headlesschrome",
  "phantomjs",
  "selenium",
  "puppeteer",
  "playwright",
  "postmanruntime",
  "insomnia/",
  "httpie",
];

// Các tuyến đường công khai hoặc giám sát nhịp tim không bị can thiệp
const EXEMPT_PATHS = ["/api/meta", "/api/drive-status", "/"];

function antiBotMiddleware(req, res, next) {
  // 1. Cho phép phương thức OPTIONS (CORS preflight) hoặc đường dẫn miễn trừ
  if (req.method === "OPTIONS" || EXEMPT_PATHS.includes(req.path)) {
    return next();
  }

  const userAgent = String(req.headers["user-agent"] || "").trim();
  const ip =
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";

  // 2. Chặn các yêu cầu thiếu User-Agent hoặc quá ngắn (tool tự động / script cắm máy chủ VPS)
  if (!userAgent || userAgent.length < 5) {
    console.warn(
      `[🚫 Huy Locket Anti-Bot] Blocked request with missing/empty User-Agent from IP: ${ip}`
    );
    return res.status(403).json({
      success: false,
      code: "BOT_DETECTED",
      error:
        "Hệ thống tường lửa Huy Locket từ chối truy cập: Không nhận diện được thông tin thiết bị/trình duyệt hợp lệ.",
    });
  }

  // 3. Kiểm tra từ khóa Bot và công cụ cào tự động
  const uaLower = userAgent.toLowerCase();
  const isBot = BLOCKED_UA_KEYWORDS.some((keyword) =>
    uaLower.includes(keyword)
  );
  if (isBot) {
    console.warn(
      `[🚫 Huy Locket Anti-Bot] Blocked Scraper/Bot (${userAgent}) from IP: ${ip}`
    );
    return res.status(403).json({
      success: false,
      code: "BOT_BLOCKED",
      error:
        "Hệ thống bảo mật Huy Locket đã từ chối yêu cầu từ Bot hoặc công cụ tự động hóa.",
    });
  }

  req.isVerifiedUserClient = true;
  return next();
}

// Global DDoS Shield: Giới hạn tần suất gửi request từ 1 IP trong khoảng thời gian ngắn
const globalDDoSShield = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  limit: 300, // Tối đa 300 yêu cầu/phút từ 1 địa chỉ IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "DDOS_SHIELD_TRIGGERED",
    error:
      "Hệ thống bảo mật chống DDoS Huy Locket phát hiện tần suất truy cập quá dày đặc. Vui lòng thử lại sau 1 phút.",
  },
});

module.exports = {
  antiBotMiddleware,
  globalDDoSShield,
};
