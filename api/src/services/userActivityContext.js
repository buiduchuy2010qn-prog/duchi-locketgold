const net = require("node:net");

const UNKNOWN = "Không xác định";
const TRUSTED_ORIGINS = new Map([
  ["https://duchi.vercel.app", "vercel"],
  ["https://huy-locket-production.up.railway.app", "railway"],
]);

function firstHeaderValue(value) {
  return String(value || "").split(",")[0].trim();
}

function normalizePublicIp(value) {
  let candidate = firstHeaderValue(value);
  if (!candidate) return null;

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }
  if (candidate.toLowerCase().startsWith("::ffff:")) {
    candidate = candidate.slice(7);
  }

  const version = net.isIP(candidate);
  if (!version) return null;
  if (version === 4) {
    const octets = candidate.split(".").map(Number);
    const [a, b] = octets;
    const privateIp = a === 0
      || a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)
      || a >= 224;
    return privateIp ? null : candidate;
  }

  const lower = candidate.toLowerCase();
  if (lower === "::" || lower === "::1" || lower.startsWith("fc")
    || lower.startsWith("fd") || lower.startsWith("fe8")
    || lower.startsWith("fe9") || lower.startsWith("fea")
    || lower.startsWith("feb")) {
    return null;
  }
  return candidate;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function getWebSource(req) {
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (TRUSTED_ORIGINS.has(origin)) return TRUSTED_ORIGINS.get(origin);
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return "local";
  return "unknown";
}

function getRequestLocation(req, webSource) {
  if (webSource !== "vercel" || !req.headers["x-vercel-id"]) {
    return { country: UNKNOWN, region: UNKNOWN, city: UNKNOWN };
  }
  return {
    country: String(req.headers["x-vercel-ip-country"] || UNKNOWN).slice(0, 80),
    region: safeDecode(req.headers["x-vercel-ip-country-region"] || UNKNOWN).slice(0, 120),
    city: safeDecode(req.headers["x-vercel-ip-city"] || UNKNOWN).slice(0, 120),
  };
}

function parseUserAgent(userAgent) {
  const ua = String(userAgent || "").slice(0, 1000);
  const browserMatchers = [
    ["Edge", /Edg\/([\d.]+)/],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ];
  const browserMatch = browserMatchers.find(([, pattern]) => pattern.test(ua));
  const versionMatch = browserMatch ? ua.match(browserMatch[1]) : null;

  let os = UNKNOWN;
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let device = "Desktop";
  if (/iPad|Tablet/i.test(ua)) device = "Tablet";
  else if (/Mobi|Android|iPhone|iPod/i.test(ua)) device = "Mobile";

  return {
    browser: browserMatch?.[0] || UNKNOWN,
    browserVersion: versionMatch?.[1] || UNKNOWN,
    os,
    device,
  };
}

function getRequestContext(req) {
  const webSource = getWebSource(req);
  const vercelIp = webSource === "vercel" && req.headers["x-vercel-id"]
    ? req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"]
    : null;
  const ip = normalizePublicIp(vercelIp || req.headers["x-real-ip"] || req.ip);
  return {
    ipAddress: ip || UNKNOWN,
    webSource,
    ...getRequestLocation(req, webSource),
    ...parseUserAgent(req.headers["user-agent"]),
  };
}

module.exports = {
  UNKNOWN,
  getRequestContext,
  getWebSource,
  normalizePublicIp,
  parseUserAgent,
};
