const fs = require('fs');
const path = 'api/src/middlewares/antiBot.js';
let content = fs.readFileSync(path, 'utf8');

const originalShield = `
const globalDDoSShield = rateLimit({
  windowMs: 60 * 1000,
  limit: 800, // Tăng lên 800 req/phút để không chặn nhầm người dùng tải lại trang
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS" || isExemptPath(req.path) || isAdminRequest(req),
  handler: (req, res, next, options) => {
    const ip = getRequestIp(req);
    // Thay vì instant ban (cấm vĩnh viễn), chỉ ghi nhận vi phạm (instantBan = false)
    handleThreatDetected(req, ip, "DDOS_RATE_FLOOD", "HIGH",
      "Vượt ngưỡng tường lửa (>800 req/phút)",
      null, false
    );
    res.status(429).json(options.message);
  },
  message: {
    success: false,
    code: "DDOS_SHIELD_TRIGGERED",
    error: "Bạn đang gửi quá nhiều yêu cầu. Vui lòng chậm lại một chút.",
  },
});
`;

content = content.replace(
  'const globalDDoSShield = (req, res, next) => next();',
  originalShield.trim()
);

fs.writeFileSync(path, content, 'utf8');
console.log('Re-enabled globalDDoSShield securely');
