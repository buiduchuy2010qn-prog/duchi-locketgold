/**
 * ═══════════════════════════════════════════════════════════════════
 *  🛡️ Security Headers Middleware
 * ═══════════════════════════════════════════════════════════════════
 *
 * Thêm các HTTP security headers chuẩn OWASP.
 * CSP ở chế độ Report-Only để không phá camera/blob/Firebase/media.
 */

function securityHeaders(req, res, next) {
  // Chống clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Chống MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // XSS Protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy — gửi origin nhưng không gửi full URL
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Chống phishing: chặn site khác embed qua window.opener
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // Permissions Policy — hạn chế API nhạy cảm cho third-party
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), ambient-light-sensor=(), autoplay=(self), battery=(), " +
    "camera=(self), display-capture=(), document-domain=(), encrypted-media=(self), " +
    "fullscreen=(self), geolocation=(self), gyroscope=(), layout-animations=(self), " +
    "magnetometer=(), microphone=(self), midi=(), payment=(), " +
    "picture-in-picture=(self), publickey-credentials-get=(), " +
    "speaker-selection=(), sync-xhr=(self), usb=(), xr-spatial-tracking=()"
  );

  // CSP Report-Only — KHÔNG block, chỉ báo cáo
  // Rộng đủ cho: camera blob, Firebase, Railway API, Vercel, media, nhạc
  res.setHeader(
    "Content-Security-Policy-Report-Only",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' blob: data: https: http:",
      "media-src 'self' blob: data: https: http:",
      "connect-src 'self' blob: https: wss: ws: http://localhost:*",
      "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // Strict Transport Security (chỉ production)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}

module.exports = { securityHeaders };
