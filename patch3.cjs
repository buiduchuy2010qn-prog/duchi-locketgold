const fs = require('fs');
const path = 'api/src/middlewares/antiBot.js';
let content = fs.readFileSync(path, 'utf8');

const sensitiveShield = `
const sensitiveApiShield = rateLimit({
  windowMs: 60 * 1000,
  limit: 100, // Tăng lên 100 req/phút để an toàn hơn cho người dùng thật
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getRequestIp(req),
  skip: (req) => req.method === "OPTIONS" || isAdminRequest(req),
  handler: (req, res) => {
    const ip = getRequestIp(req);
    handleThreatDetected(req, ip, "SENSITIVE_API_FLOOD", "HIGH",
      \`Gửi quá nhiều request đến endpoint nhạy cảm \${req.originalUrl} (>100/phút)\`,
      null, false // instantBan = false để không khóa nhầm vĩnh viễn
    );
    res.status(429).json({
      success: false,
      code: "API_RATE_LIMITED",
      error: "Quá nhiều yêu cầu đến API bảo mật. Vui lòng thử lại sau.",
    });
  }
});
`;

content = content.replace(
  'const sensitiveApiShield = (req, res, next) => next();',
  sensitiveShield.trim()
);

fs.writeFileSync(path, content, 'utf8');
console.log('Re-enabled sensitiveApiShield securely');
