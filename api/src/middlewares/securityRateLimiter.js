/**
 * ═══════════════════════════════════════════════════════════════════
 *  🛡️ Security Rate Limiter — Redis-backed với Local Fallback
 * ═══════════════════════════════════════════════════════════════════
 *
 * Cung cấp rate limit theo từng nhóm endpoint:
 *   - Auth (login/OTP/reset): 5 thất bại / 15 phút (IP + identifier)
 *   - Refresh token: 30 / 15 phút theo từng refresh-token/session
 *   - Upload: 30 / 15 phút per user
 *   - Music search: 60 / phút per IP (gõ liên tục)
 *   - General API: 200 / 15 phút per IP
 *   - Admin: 60 / phút per IP
 *
 * Redis fallback: nếu Redis chết → dùng memory store, không crash server.
 */
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { extractBestPublicIp } = require("../services/userActivityContext");

// ── Namespace prefix cho Redis keys ──
const NAMESPACE = "rl:";

// ── Cố gắng tạo Redis store ──
let RedisStore = null;
let redisClient = null;
let redisReady = false;

async function initRedisStore() {
  try {
    if (!process.env.REDIS_URL) return null;

    // Tái sử dụng pubClient từ socketRedis thay vì tạo connection mới
    const { pubClient } = require("../clients/redis/socketRedis");
    if (pubClient && pubClient.isOpen) {
      redisClient = pubClient;
      redisReady = true;

      // Dynamic import rate-limit-redis
      try {
        const mod = require("rate-limit-redis");
        RedisStore = mod.default || mod;
      } catch {
        // rate-limit-redis chưa cài → dùng memory
        console.warn("[RateLimiter] rate-limit-redis not installed, using memory store");
        return null;
      }

      return redisClient;
    }
  } catch (err) {
    console.warn("[RateLimiter] Redis init failed, using memory fallback:", err?.message);
  }
  return null;
}

// Khởi tạo async (không block startup)
const redisInitPromise = initRedisStore();

/**
 * Tạo store config: ưu tiên Redis, fallback memory
 */
function createStoreConfig(prefix) {
  if (redisReady && RedisStore && redisClient) {
    try {
      return {
        store: new RedisStore({
          sendCommand: (...args) => redisClient.sendCommand(args),
          prefix: NAMESPACE + prefix + ":",
        }),
      };
    } catch {
      // Fallback nếu Redis lỗi runtime
    }
  }
  // Memory fallback — chấp nhận hạn chế khi multi-instance
  return {};
}

/**
 * Key generator chuẩn: lấy IP thật qua trusted proxy
 */
function ipKeyGenerator(req) {
  return extractBestPublicIp(req) || req.ip || "unknown";
}

/**
 * Refresh từ frontend Vercel có thể đi qua cùng vài IP proxy cho nhiều user.
 * Nếu giới hạn theo IP, các tài khoản khác nhau sẽ vô tình dùng chung quota.
 * Dùng fingerprint SHA-256 của refresh token để tạo bucket riêng cho từng session,
 * tuyệt đối không đưa refresh token thô vào key/log.
 */
function refreshSessionKeyGenerator(req) {
  const refreshToken = String(req.body?.refreshToken || "").trim();
  if (refreshToken) {
    const fingerprint = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex")
      .slice(0, 32);
    return `session:${fingerprint}`;
  }
  return `ip:${ipKeyGenerator(req)}`;
}

/**
 * Key generator kết hợp IP + user identifier (cho auth routes)
 */
function authKeyGenerator(req) {
  const ip = extractBestPublicIp(req) || req.ip || "unknown";
  // Normalize email/phone từ body
  const identifier = (req.body?.email || req.body?.phone || req.body?.username || "")
    .toString()
    .toLowerCase()
    .trim();
  // Kết hợp IP + identifier để tránh:
  // 1. Kẻ xấu khóa tài khoản người khác (chỉ theo email)
  // 2. Brute force từ nhiều tài khoản trên cùng 1 IP
  return identifier ? `${ip}:${identifier}` : ip;
}

/**
 * Key generator theo user đã xác thực (cho refresh token, upload)
 */
function userKeyGenerator(req) {
  const ip = extractBestPublicIp(req) || req.ip || "unknown";
  const uid = req.user?.uid || req.user?.localId || "";
  return uid ? `${ip}:${uid}` : ip;
}

// ── Thông báo lỗi chung — không tiết lộ thông tin tài khoản ──
const GENERIC_AUTH_MESSAGE = {
  success: false,
  code: "RATE_LIMITED",
  error: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
};

const GENERIC_API_MESSAGE = {
  success: false,
  code: "RATE_LIMITED",
  error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
};

// ═══════════════════════════════════════════════════════════════════
// Rate Limiters theo nhóm
// ═══════════════════════════════════════════════════════════════════

/**
 * AUTH — Đăng nhập, OTP, reset password
 * 5 lần thất bại / 15 phút, kết hợp IP + identifier
 * Chỉ đếm thất bại (skipSuccessfulRequests)
 */
const authBruteForceLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Không tính request thành công
  keyGenerator: authKeyGenerator,
  handler: (req, res) => {
    const retryAfter = Math.ceil(15 * 60); // seconds
    res.set("Retry-After", String(retryAfter));
    res.status(429).json(GENERIC_AUTH_MESSAGE);
  },
  ...createStoreConfig("auth"),
});

/**
 * REFRESH TOKEN — Request tự động của app
 * 30 / 15 phút theo từng refresh-token/session.
 * Không dùng IP vì Vercel/Railway proxy có thể gom nhiều user vào cùng IP nguồn.
 */
const refreshTokenLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: refreshSessionKeyGenerator,
  handler: (req, res) => {
    res.set("Retry-After", String(15 * 60));
    res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      error: "Quá nhiều yêu cầu refresh. Vui lòng thử lại sau.",
    });
  },
  ...createStoreConfig("refresh"),
});

/**
 * UPLOAD — Giới hạn upload ảnh/video
 * 30 / 15 phút per user+IP
 */
const uploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: (req, res) => {
    res.set("Retry-After", String(15 * 60));
    res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      error: "Bạn đã tải lên quá nhiều. Vui lòng thử lại sau.",
    });
  },
  ...createStoreConfig("upload"),
});

/**
 * MUSIC SEARCH — Gõ liên tục cần giới hạn rộng
 * 60 / phút per IP (tối thiểu theo yêu cầu)
 */
const musicSearchLimit = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  handler: (req, res) => {
    res.set("Retry-After", "60");
    res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      error: "Bạn tìm kiếm quá nhanh. Vui lòng thử lại sau.",
    });
  },
  ...createStoreConfig("music"),
});

/**
 * GENERAL API — Đọc/ghi thông thường
 * 200 / 15 phút per IP
 */
const generalApiLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  handler: (req, res) => {
    res.set("Retry-After", String(15 * 60));
    res.status(429).json(GENERIC_API_MESSAGE);
  },
  ...createStoreConfig("api"),
});

/**
 * ADMIN — 60 / phút per IP
 */
const adminLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  handler: (req, res) => {
    res.set("Retry-After", "60");
    res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      error: "Quá nhiều yêu cầu quản trị. Vui lòng thử lại sau.",
    });
  },
  ...createStoreConfig("admin"),
});

module.exports = {
  authBruteForceLimit,
  refreshTokenLimit,
  uploadLimit,
  musicSearchLimit,
  generalApiLimit,
  adminLimit,
  redisInitPromise,
};
