/**
 * Huy Locket Security Shield - Anti-Bot, Anti-Scraping & DDoS Shield
 * Bảo vệ máy chủ khỏi Bot cào dữ liệu, tool tự động, DDoS và tấn công mã độc (SQLi/XSS)
 */
const rateLimit = require("express-rate-limit");
const { isIpBlacklisted, addIpBlacklist, recordSecurityThreat } = require("../services/userActivityStore");

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

// Các tuyến đường công khai, giám sát nhịp tim (health/uptime check) hoặc tài nguyên tĩnh không bị can thiệp
const EXEMPT_PATHS = [
  "/",
  "/health",
  "/api/health",
  "/ping",
  "/api/ping",
  "/api/meta",
  "/api/drive-status",
  "/favicon.ico",
  "/robots.txt",
  "/manifest.json",
];

function isExemptPath(path = "") {
  const p = String(path).split("?")[0].replace(/\/+$/, "") || "/";
  if (EXEMPT_PATHS.includes(p)) return true;
  if (p.startsWith("/assets/") || p.startsWith("/static/") || /\.(png|jpg|jpeg|svg|ico|gif|woff|woff2|css|js|map|txt)$/i.test(p)) {
    return true;
  }
  return false;
}

function getRequestIp(req) {
  return req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || (req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : null) || req.socket?.remoteAddress || "unknown";
}

// Bộ lưu trữ tạm thời trong RAM để chống spam log và theo dõi vi phạm để khóa IP tự động
const recentThreatLogs = new Map();
const ipViolationCount = new Map();
const LOG_THROTTLING_MS = 15 * 60 * 1000; // 15 phút mới ghi log vi phạm giống nhau 1 lần cho mỗi IP
const AUTO_BAN_THRESHOLD = 3; // Vi phạm 3 lần -> Tự động ban IP vĩnh viễn
const VIOLATION_WINDOW_MS = 5 * 60 * 1000; // Khung thời gian đếm vi phạm: 5 phút

async function handleThreatDetected(req, ip, threatType, severity, details, payloadSample = null) {
  if (!ip || ip === "unknown") return;
  const userAgent = String(req.headers["user-agent"] || "").trim();
  const now = Date.now();

  // 1. Kiểm tra vi phạm để TỰ ĐỘNG KHÓA VĨNH VIỄN (Auto-Blacklist)
  if (!isIpBlacklisted(ip)) {
    const v = ipViolationCount.get(ip) || { count: 0, lastViolation: now };
    if (now - v.lastViolation > VIOLATION_WINDOW_MS) {
      v.count = 1;
    } else {
      v.count += 1;
    }
    v.lastViolation = now;
    ipViolationCount.set(ip, v);

    // Nếu vi phạm vượt quá ngưỡng hoặc tấn công mã độc -> Ban Vĩnh Viễn ngay lập tức
    if (v.count >= AUTO_BAN_THRESHOLD || severity === "CRITICAL") {
      console.warn(`[🛑 Huy Locket WAF] AUTO-BANNING IP: ${ip} do liên tục tấn công hoặc vi phạm (${threatType})`);
      await addIpBlacklist(ip, `Tự động cấm vĩnh viễn bởi WAF do vi phạm lặp đi lặp lại hoặc tấn công mã độc (${threatType})`, "SYSTEM_WAF").catch(() => {});
      ipViolationCount.delete(ip);
      
      recordSecurityThreat({
        threatType: "AUTO_WAF_IP_BANNED",
        severity: "CRITICAL",
        targetEndpoint: req.originalUrl || req.path,
        attackerIp: ip,
        userAgent: userAgent,
        details: `Tự động phong tỏa IP vĩnh viễn vào Blacklist sau nhiều lần vi phạm (${threatType})`,
        payloadSample: payloadSample,
        status: "BANNED_FOREVER",
      }).catch(() => {});
      return;
    }
  }

  // 2. Chống Spam Log (Throttling) vào Cơ sở dữ liệu
  const logKey = `${ip}_${threatType}`;
  const lastLogTime = recentThreatLogs.get(logKey);
  if (lastLogTime && (now - lastLogTime < LOG_THROTTLING_MS)) {
    return; // Đã ghi log trong 15 phút qua -> Bỏ qua để chống spam Database & Bảng Admin
  }
  recentThreatLogs.set(logKey, now);

  recordSecurityThreat({
    threatType,
    severity,
    targetEndpoint: req.originalUrl || req.path,
    attackerIp: ip,
    userAgent,
    details,
    payloadSample,
    status: "BLOCKED",
  }).catch(() => {});
}

function antiBotMiddleware(req, res, next) {
  if (req.method === "OPTIONS" || isExemptPath(req.path)) {
    return next();
  }

  const userAgent = String(req.headers["user-agent"] || "").trim();
  const ip = getRequestIp(req);

  if (isIpBlacklisted(ip)) {
    handleThreatDetected(req, ip, "IP_BLACKLIST_PROBE", "HIGH", "Địa chỉ IP trong danh sách đen (Blacklisted IP) cố gắng kết nối vào máy chủ");

    return res.status(403).json({
      success: false,
      code: "IP_BANNED",
      error: "Địa chỉ IP của bạn đã bị Huy Locket cấm truy cập vĩnh viễn do vi phạm chính sách bảo mật.",
    });
  }

  // Chặn các yêu cầu thiếu User-Agent hoặc quá ngắn
  if (!userAgent || userAgent.length < 5) {
    console.warn(`[🚫 Huy Locket Anti-Bot] Blocked request with missing/empty User-Agent from IP: ${ip}`);
    handleThreatDetected(req, ip, "BOT_EMPTY_USER_AGENT", "MEDIUM", "Truy cập tự động bị từ chối do thiếu hoặc sai định dạng User-Agent (nghi vấn Script VPS)");

    return res.status(403).json({
      success: false,
      code: "BOT_DETECTED",
      error: "Hệ thống tường lửa Huy Locket từ chối truy cập: Không nhận diện được thông tin thiết bị/trình duyệt hợp lệ.",
    });
  }

  // Kiểm tra từ khóa Bot và công cụ cào tự động
  const uaLower = userAgent.toLowerCase();
  const isBot = BLOCKED_UA_KEYWORDS.some((keyword) => uaLower.includes(keyword));
  if (isBot) {
    console.warn(`[🚫 Huy Locket Anti-Bot] Blocked Scraper/Bot (${userAgent}) from IP: ${ip}`);
    handleThreatDetected(req, ip, "AUTOMATED_SCRAPER_BOT", "MEDIUM", `Phát hiện công cụ cào tự động (${userAgent}) cố gắng quét và khai thác dữ liệu`);

    return res.status(403).json({
      success: false,
      code: "BOT_BLOCKED",
      error: "Hệ thống bảo mật Huy Locket đã từ chối yêu cầu từ Bot hoặc công cụ tự động hóa.",
    });
  }

  req.isVerifiedUserClient = true;
  return next();
}

// WAF Security Shield: Kiểm tra dấu hiệu tấn công SQL Injection, XSS, Path Traversal
function wafSecurityShield(req, res, next) {
  if (req.method === "OPTIONS" || isExemptPath(req.path)) {
    return next();
  }

  let urlStr = req.originalUrl || req.url || "";
  try {
    urlStr = decodeURIComponent(urlStr);
  } catch (e) {
    /* ignore */
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
    console.warn(`[🛑 Huy Locket WAF] Blocked ${detectedType} attack from IP: ${ip} on endpoint ${req.originalUrl}`);
    handleThreatDetected(req, ip, detectedType, severity, `Hệ thống WAF Tường Lửa phát hiện payload mã độc ${detectedType} trong yêu cầu`, combined.slice(0, 400));

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
  skip: (req) => req.method === "OPTIONS" || isExemptPath(req.path),
  handler: (req, res, next, options) => {
    const ip = getRequestIp(req);
    handleThreatDetected(req, ip, "DDOS_RATE_FLOOD", "HIGH", "Tần suất gửi request quá dày đặc, vượt ngưỡng an toàn tường lửa (>300 req/phút)");
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

