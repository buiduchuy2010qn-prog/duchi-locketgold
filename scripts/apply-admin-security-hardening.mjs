import { readFile, writeFile, mkdir } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");

function replaceExact(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

function replaceAllExact(source, before, after, expected, label) {
  const count = source.split(before).length - 1;
  if (count !== expected) throw new Error(`${label}: expected ${expected} matches, found ${count}`);
  return source.split(before).join(after);
}

{
  const path = "api/src/routes/adminRoutes.js";
  let source = await read(path);

  source = replaceExact(
    source,
    'const jwt = require("jsonwebtoken");\n',
    'const jwt = require("jsonwebtoken");\n\nconst JWT_SECRET = String(process.env.JWT_SECRET || "").trim();\nif (JWT_SECRET.length < 32) {\n  throw new Error("JWT_SECRET is required and must be at least 32 characters");\n}\n\nconst TRUST_DEVICE_COOKIE_OPTIONS = {\n  httpOnly: true,\n  secure: process.env.NODE_ENV === "production",\n  sameSite: "none",\n  path: "/api/admin",\n};\n',
    "insert JWT validation",
  );

  source = replaceAllExact(
    source,
    'process.env.JWT_SECRET || "HUY_LOCKET_SECURE_KEY_2FA"',
    "JWT_SECRET",
    4,
    "remove public JWT fallback",
  );

  source = replaceExact(
    source,
    '      // 🟢 TÍNH NĂNG MỚI: Kiểm tra Token "Ghi nhớ thiết bị" (Trusted Device) từ Cookie hoặc Header\n      const trustToken = req.cookies?.trust_device_token || req.body?.trustedDeviceToken || req.headers["x-trust-device-token"];',
    '      // Token thiết bị tin cậy chỉ được nhận từ cookie HttpOnly.\n      const trustToken = req.cookies?.trust_device_token;',
    "cookie-only trusted token input",
  );

  source = replaceExact(
    source,
    '      res.cookie("trust_device_token", trustToken, {\n        httpOnly: true,\n        secure: process.env.NODE_ENV === "production",\n        sameSite: "none",\n        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày (ms)\n      });',
    '      res.cookie("trust_device_token", trustToken, {\n        ...TRUST_DEVICE_COOKIE_OPTIONS,\n        maxAge: 30 * 24 * 60 * 60 * 1000,\n      });',
    "secure cookie options",
  );

  source = replaceExact(
    source,
    '      adminSessionToken: token,\n      trust_device_token: trustToken, // Hỗ trợ lưu dự phòng trong localStorage nếu Cookie cross-domain bị chặn\n      expiresAt: Date.now() + 30 * 60 * 1000,',
    '      adminSessionToken: token,\n      trustedDeviceSet: Boolean(trustToken),\n      expiresAt: Date.now() + 30 * 60 * 1000,',
    "remove trusted token from JSON",
  );

  source = replaceExact(
    source,
    '    res.clearCookie("trust_device_token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "none" });',
    '    res.clearCookie("trust_device_token", TRUST_DEVICE_COOKIE_OPTIONS);',
    "matching cookie clear options",
  );

  await write(path, source);
}

{
  const path = "src/services/AdminAuthService.js";
  let source = await read(path);

  source = replaceExact(
    source,
    'import { CONFIG } from "@/config";\n',
    'import { CONFIG } from "@/config";\n\n// Delete legacy trusted-device JWTs exposed by older builds.\ntry {\n  localStorage.removeItem("huy_locket_trust_device");\n} catch {\n  /* storage may be unavailable */\n}\n',
    "legacy token cleanup",
  );

  source = replaceExact(
    source,
    'export function getTrustedDeviceToken() {\n  try {\n    return localStorage.getItem("huy_locket_trust_device") || "";\n  } catch {\n    return "";\n  }\n}\n\nexport function setTrustedDeviceToken(token) {\n  try {\n    if (token) localStorage.setItem("huy_locket_trust_device", token);\n    else localStorage.removeItem("huy_locket_trust_device");\n  } catch {\n    /* ignore */\n  }\n}\n\n',
    "",
    "remove localStorage token helpers",
  );

  source = replaceExact(
    source,
    '  const adminSessionToken = getShortAdminSessionToken();\n  const trustedToken = getTrustedDeviceToken();\n',
    '  const adminSessionToken = getShortAdminSessionToken();\n',
    "remove trusted token read",
  );

  source = replaceExact(
    source,
    '  if (trustedToken) {\n    headers["X-Trust-Device-Token"] = trustedToken;\n  }\n\n',
    "",
    "remove trusted token header",
  );

  source = replaceExact(
    source,
    'export async function startShortAdminSession(pin) {\n  const trustedDeviceToken = getTrustedDeviceToken();\n  const result = await adminRequest("/session/create", {\n    method: "POST",\n    body: JSON.stringify({ pin, trustedDeviceToken }),\n  });',
    'export async function startShortAdminSession(pin) {\n  const result = await adminRequest("/session/create", {\n    method: "POST",\n    body: JSON.stringify({ pin }),\n  });',
    "cookie-only session request",
  );

  source = replaceExact(
    source,
    '  if (result.trust_device_token) {\n    setTrustedDeviceToken(result.trust_device_token);\n  }\n',
    "",
    "remove response token persistence",
  );

  await write(path, source);
}

{
  const path = "vercel.json";
  const config = JSON.parse(await read(path));
  config.buildCommand = "npm run build:deploy";
  config.installCommand = "npm ci --no-audit --no-fund";
  await write(path, `${JSON.stringify(config, null, 2)}\n`);
}

{
  const path = "api/package.json";
  const pkg = JSON.parse(await read(path));
  pkg.scripts.test = "node --test tests/*.test.js";
  pkg.scripts["test:security"] = "node --test tests/adminSecurity.test.js";
  await write(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

{
  const path = "package.json";
  const pkg = JSON.parse(await read(path));
  pkg.scripts["lint:quality"] += " && node --check api/src/routes/adminRoutes.js && node --check src/services/AdminAuthService.js && node --check api/tests/adminSecurity.test.js";
  await write(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

await mkdir("api/tests", { recursive: true });
await write(
  "api/tests/adminSecurity.test.js",
  `const test = require("node:test");\nconst assert = require("node:assert/strict");\nconst { readFileSync } = require("node:fs");\nconst { resolve } = require("node:path");\n\nconst root = resolve(__dirname, "../..");\nconst read = (path) => readFileSync(resolve(root, path), "utf8");\n\ntest("admin JWT requires an environment secret with no public fallback", () => {\n  const source = read("api/src/routes/adminRoutes.js");\n  assert.doesNotMatch(source, /HUY_LOCKET_SECURE_KEY_2FA/);\n  assert.match(source, /process\\.env\\.JWT_SECRET/);\n  assert.match(source, /JWT_SECRET\\.length < 32/);\n});\n\ntest("trusted-device JWT is HttpOnly cookie-only", () => {\n  const apiSource = read("api/src/routes/adminRoutes.js");\n  const clientSource = read("src/services/AdminAuthService.js");\n  assert.doesNotMatch(apiSource, /trust_device_token:\\s*trustToken/);\n  assert.doesNotMatch(apiSource, /trustedDeviceToken/);\n  assert.doesNotMatch(apiSource, /x-trust-device-token/i);\n  assert.match(apiSource, /req\\.cookies\\?\\.trust_device_token/);\n  assert.doesNotMatch(clientSource, /X-Trust-Device-Token/);\n  assert.doesNotMatch(clientSource, /setItem\\(\"huy_locket_trust_device\"/);\n});\n\ntest("Vercel builds the current source", () => {\n  const config = JSON.parse(read("vercel.json"));\n  assert.equal(config.buildCommand, "npm run build:deploy");\n  assert.equal(config.outputDirectory, "vercel-static");\n});\n`,
);

{
  const path = "api/.env.example";
  let source = await read(path);
  source = replaceExact(
    source,
    'COOKIE_SECRET=\nLOCKETDIO_JWT_SECRET=\n',
    'COOKIE_SECRET=\nLOCKETDIO_JWT_SECRET=\n# Required for Admin PIN/2FA JWT signing; server-only, minimum 32 characters.\nJWT_SECRET=\n',
    "document JWT secret",
  );
  await write(path, source);
}

{
  const path = "railway.toml";
  let source = await read(path);
  source = replaceExact(
    source,
    '#     LOCKETDIO_JWT_SECRET=<cố định>\n#     COOKIE_SECRET=<cố định>\n',
    '#     LOCKETDIO_JWT_SECRET=<cố định>\n#     COOKIE_SECRET=<cố định>\n#     JWT_SECRET=<chuỗi ngẫu nhiên tối thiểu 32 ký tự, dùng riêng cho Admin PIN/2FA>\n',
    "document Railway JWT secret",
  );
  await write(path, source);
}

console.log("Admin security hardening applied.");
