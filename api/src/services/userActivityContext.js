const net = require("node:net");

const UNKNOWN = "Không xác định";
const IP_LOCATION_TIMEOUT_MS = 1800;
const IP_LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const IP_LOCATION_FAILURE_TTL_MS = 5 * 60 * 1000;
const ipLocationCache = new Map();
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
  const origin = String(req.headers.origin || req.headers.referer || "").replace(/\/$/, "");
  if (TRUSTED_ORIGINS.has(origin)) return TRUSTED_ORIGINS.get(origin);
  if (origin.includes("vercel.app") || req.headers["x-vercel-id"] || req.headers["x-vercel-forwarded-for"]) return "vercel";
  if (origin.includes("railway.app") || req.headers["x-locket-source"] === "railway") return "railway";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) || origin.includes("localhost:") || origin.includes("127.0.0.1:")) return "local";
  if (String(req.headers.host || "").includes("railway.app")) return "railway";
  return "vercel";
}

function getRequestLocation(req, webSource) {
  if (!req.headers["x-vercel-id"]) {
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
  const rawIp = req.headers["cf-connecting-ip"] ||
                req.headers["x-vercel-forwarded-for"] ||
                req.headers["x-real-ip"] ||
                req.headers["x-forwarded-for"] ||
                req.ip;
  const ip = normalizePublicIp(rawIp);
  return {
    ipAddress: ip || UNKNOWN,
    webSource,
    ...getRequestLocation(req, webSource),
    ...parseUserAgent(req.headers["user-agent"]),
  };
}

function cacheIpLocation(ip, value, ttl) {
  if (ipLocationCache.size >= 500) {
    ipLocationCache.delete(ipLocationCache.keys().next().value);
  }
  ipLocationCache.set(ip, { value, expiresAt: Date.now() + ttl });
}

async function lookupPublicIpLocation(ipAddress) {
  if (!ipAddress || ipAddress === UNKNOWN || typeof fetch !== "function") return null;
  const cached = ipLocationCache.get(ipAddress);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) ipLocationCache.delete(ipAddress);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IP_LOCATION_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://ipwho.is/${encodeURIComponent(ipAddress)}?fields=success,country_code,region,city`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`IP location lookup failed with ${response.status}`);
    const data = await response.json();
    if (data?.success !== true) throw new Error("IP location lookup returned no location");
    const value = {
      country: String(data.country_code || UNKNOWN).slice(0, 80),
      region: String(data.region || UNKNOWN).slice(0, 120),
      city: String(data.city || UNKNOWN).slice(0, 120),
    };
    cacheIpLocation(ipAddress, value, IP_LOCATION_CACHE_TTL_MS);
    return value;
  } catch {
    cacheIpLocation(ipAddress, null, IP_LOCATION_FAILURE_TTL_MS);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getLoginRequestContext(req) {
  const context = getRequestContext(req);
  if (context.ipAddress === UNKNOWN || context.city !== UNKNOWN || context.country !== UNKNOWN) {
    return context;
  }
  const location = await lookupPublicIpLocation(context.ipAddress);
  return location ? { ...context, ...location } : context;
}

module.exports = {
  UNKNOWN,
  getLoginRequestContext,
  getRequestContext,
  getWebSource,
  normalizePublicIp,
  parseUserAgent,
};
