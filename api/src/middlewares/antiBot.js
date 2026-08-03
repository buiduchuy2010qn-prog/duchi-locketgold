/**
 * Huy Locket Security Shield - Anti-Bot, Anti-Scraping & DDoS Shield
 * Bảo vệ máy chủ khỏi Bot cào dữ liệu, tool tự động, DDoS và tấn công mã độc (SQLi/XSS)
 */
const rateLimit = require("express-rate-limit");
const { isIpBlacklisted, recordSecurityThreat } = require("../services/userActivityStore");

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

function getRequestIp(req) {
  return req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || (req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : null) || req.socket?.remoteAddress || "unknown";
}

function antiBotMiddleware(req, res, next) {
  if (req.method === "OPTIONS" || EXEMPT_PATHS.includes(req.path)) {
    return next();
  }

  const userAgent = String(req.headers["user-agent"] || "").trim();
  const ip = getRequestIp(req);

  if (isIpBlacklisted(ip)) {
    recordSecurityThreat({
      threatType: "IP_BLACKLIST_PROBE",
      severity: "HIGH",
      targetEndpoint: req.originalUrl || req.path,
      attackerIp: ip,
      userAgent: userAgent,
      details: "Địa chỉ IP trong danh sách đen (Blacklisted IP) cố gắng kết nối vào máy chủ",
      status: "BLOCKED",
    }).catch(() => {});

    return res.status(403).json({
      success: false,
      code: "IP_BANNED",
      error: "Địa chỉ IP của bạn đã bị Huy Locket cấm truy cập vĩnh viễn do vi phạm chính sách bảo mật.",
    });
  }

  // 2. Chặn các yêu cầu thiếu User-Agent hoặc quá ngắn
  if (!userAgent || userAgent.length < 5) {
    console.warn(`[🚫 Huy Locket Anti-Bot] Blocked request with missing/empty User-Agent from IP: ${ip}`);
    recordSecurityThreat({
      threatType: "BOT_EMPTY_USER_AGENT",
      severity: "MEDIUM",
      targetEndpoint: req.originalUrl || req.path,
      attackerIp: ip,
      userAgent: "EMPTY/MISSING",
      details: "Truy cập tự động bị từ chối do thiếu hoặc sai định dạng User-Agent (nghi vấn Script VPS)",
      status: "BLOCKED",
    }).catch(() => {});

    return res.status(403).json({
      success: false,
      code: "BOT_DETECTED",
      error: "Hệ thống tường lửa Huy Locket từ chối truy cập: Không nhận diện được thông tin thiết bị/trình duyệt hợp lệ.",
    });
  }

  // 3. Kiểm tra từ khóa Bot và công cụ cào tự động
  const uaLower = userAgent.toLowerCase();
  const isBot = BLOCKED_UA_KEYWORDS.some((keyword) => uaLower.includes(keyword));
  if (isBot) {
    console.warn(`[🚫 Huy Locket Anti-Bot] Blocked Scraper/Bot (${userAgent}) from IP: ${ip}`);
    recordSecurityThreat({
      threatType: "AUTOMATED_SCRAPER_BOT",
      severity: "MEDIUM",
      targetEndpoint: req.originalUrl || req.path,
      attackerIp: ip,
      userAgent: userAgent,
      details: `Phát hiện công cụ cào tự động (${userAgent}) cố gắng quét và khai thác dữ liệu`,
      status: "BLOCKED",
    }).catch(() => {});

    return res.status(403).json({
      success: false,
      code: "BOT_BLOCKED",
      error: "Hệ thống bảo mật Huy Locket đã từ chối yêu cầu từ Bot hoặc công cụ tự động hóa.",
    });
  }

  req.isVerifiedUserClient = true;
  return next();
}

// 4. WAF Security Shield: Kiểm tra dấu hiệu tấn công SQL Injection, XSS, Path Traversal
function wafSecurityShield(req, res, next) {
  if (req.method === "OPTIONS" || EXEMPT_PATHS.includes(req.path)) {
    return next();
  }

  let urlStr = req.originalUrl || req.url || "";
  try {
    urlStr = decodeURIComponent(urlStr);
  } catch (e) {
    // Bỏ qua nếu lỗi giải mã url
  }
  const queryStr = JSON.stringify(req.query || {});
  const bodyStr = req.body && typeof req.body === "object" ? JSON.stringify(req.body) : "";
  const combined = `${urlStr} ${queryStr} ${bodyStr}`;

  const sqliRegex = /(\b(union\s+select|insert\s+into\s+\w+|drop\s+table|delete\s+from\s+\w+)\b|(%27|')\s*(or|and)\s*('|\d|\w+)\s*(=|LIKE))/i;
  const xssRegex = /(<script\b|javascript:|on(load|error|click|mouseover)\s*=\s*("|')|<iframe\b)/i;
  const traversalRegex = /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\/etc\/passwd|windows\/system32)/i;

  let detectedType = null;
  let severity = "HIGH";
  if (sqliRegex.test(combined)) {
    detectedType = "SQL_INJECTION";
    severity = "CRITICAL";
  } else if (xssRegex.test(combined)) {
    detectedType = "XSS_INJECTION";
    severity = "CRITICAL";
  } else if (traversalRegex.test(combined)) {
    detectedType = "PATH_TRAVERSAL";
    severity = "CRITICAL";
  }

  if (detectedType) {
    const ip = getRequestIp(req);
    const userAgent = String(req.headers["user-agent"] || "").trim();
    console.warn(`[🛑 Huy Locket WAF] Blocked ${detectedType} attack from IP: ${ip} on endpoint ${req.originalUrl}`);

    recordSecurityThreat({
      threatType: detectedType,
      severity: severity,
      targetEndpoint: req.originalUrl || req.path,
      attackerIp: ip,
      userAgent: userAgent,
      details: `Hệ thống WAF Tường Lửa phát hiện payload mã độc ${detectedType} trong yêu cầu gửi tới`,
      payloadSample: combined.slice(0, 400),
      status: "BLOCKED",
    }).catch(() => {});

    return res.status(403).json({
      success: false,
      code: "WAF_SECURITY_BLOCK",
      error: `Hệ thống Bảo Mật Huy Locket đã từ chối yêu cầu do phát hiện mã độc (${detectedType}). Lịch sử cảnh báo đã được ghi nhận.`,
    });
  }

  return next();
}

// Global DDoS Shield: Giới hạn tần suất gửi request từ 1 IP trong khoảng thời gian ngắn
const globalDDoSShield = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  limit: 300, // Tối đa 300 yêu cầu/phút từ 1 địa chỉ IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const ip = getRequestIp(req);
    recordSecurityThreat({
      threatType: "DDOS_RATE_FLOOD",
      severity: "HIGH",
      targetEndpoint: req.originalUrl || req.path,
      attackerIp: ip,
      userAgent: String(req.headers["user-agent"] || "").trim(),
      details: "Tần suất gửi request quá dày đặc, vượt ngưỡng an toàn tường lửa (>300 req/phút)",
      status: "BLOCKED",
    }).catch(() => {});
    res.status(429).json(options.message);
  },
  message: {
    success: false,
    code: "DDOS_SHIELD_TRIGGERED",
    error: "Hệ thống bảo mật chống DDoS Huy Locket phát hiện tần suất truy cập quá dày đặc. Vui lòng thử lại sau 1 phút.",
  },
});

module.exports = {
  antiBotMiddleware,
  wafSecurityShield,
  globalDDoSShield,
};
