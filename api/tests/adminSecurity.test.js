const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const repoRoot = resolve(__dirname, "../..");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

test("admin JWT requires a strong environment secret without a public fallback", () => {
  const source = read("api/src/routes/adminRoutes.js");

  assert.doesNotMatch(source, /HUY_LOCKET_SECURE_KEY_2FA/);
  assert.match(source, /process\.env\.JWT_SECRET/);
  assert.match(source, /JWT_SECRET\.length < 32/);
  assert.match(source, /JWT_SECRET is required and must be at least 32 characters/);
});

test("trusted-device JWT remains inside an HttpOnly cookie", () => {
  const apiSource = read("api/src/routes/adminRoutes.js");
  const clientSource = read("src/services/AdminAuthService.js");

  assert.match(apiSource, /req\.cookies\?\.trust_device_token/);
  assert.match(apiSource, /httpOnly:\s*true/);
  assert.doesNotMatch(apiSource, /trust_device_token:\s*trustToken/);
  assert.doesNotMatch(apiSource, /trustedDeviceToken/);
  assert.doesNotMatch(apiSource, /x-trust-device-token/i);

  assert.doesNotMatch(clientSource, /X-Trust-Device-Token/i);
  assert.doesNotMatch(clientSource, /setItem\(["']huy_locket_trust_device/);
  assert.doesNotMatch(clientSource, /result\.trust_device_token/);
  assert.match(clientSource, /credentials:\s*["']include["']/);
});

test("Vercel builds the current source instead of accepting stale output", () => {
  const config = JSON.parse(read("vercel.json"));

  assert.equal(config.installCommand, "npm ci --no-audit --no-fund");
  assert.equal(config.buildCommand, "npm run build:deploy");
  assert.equal(config.outputDirectory, "vercel-static");
});
