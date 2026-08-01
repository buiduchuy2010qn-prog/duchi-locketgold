const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getLoginRequestContext,
  getRequestContext,
  normalizePublicIp,
  parseUserAgent,
} = require("../src/services/userActivityContext");

test("normalizes public Railway client IP and rejects private addresses", () => {
  assert.equal(normalizePublicIp("203.0.113.9:443"), "203.0.113.9");
  assert.equal(normalizePublicIp("::ffff:8.8.8.8"), "8.8.8.8");
  assert.equal(normalizePublicIp("192.168.1.20"), null);
  assert.equal(normalizePublicIp("127.0.0.1"), null);
});

test("uses Vercel geo headers only when the request was handled by Vercel", () => {
  const context = getRequestContext({
    ip: "10.0.0.1",
    headers: {
      origin: "https://duchi.vercel.app",
      "x-vercel-id": "sin1::abc",
      "x-vercel-forwarded-for": "8.8.4.4",
      "x-vercel-ip-country": "VN",
      "x-vercel-ip-country-region": "HN",
      "x-vercel-ip-city": "H%C3%A0%20N%E1%BB%99i",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0 Safari/537.36",
    },
  });
  assert.equal(context.webSource, "vercel");
  assert.equal(context.ipAddress, "8.8.4.4");
  assert.equal(context.country, "VN");
  assert.equal(context.city, "Hà Nội");
  assert.equal(context.browser, "Chrome");
  assert.equal(context.os, "Windows");
});

test("does not mistake a Railway edge for the user location", () => {
  const context = getRequestContext({
    ip: "8.8.8.8",
    headers: {
      origin: "https://huy-locket-production.up.railway.app",
      "x-real-ip": "8.8.8.8",
      "x-railway-edge": "us-west2",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile Safari/604.1",
    },
  });
  assert.equal(context.webSource, "railway");
  assert.equal(context.country, "Không xác định");
  assert.equal(context.city, "Không xác định");
  assert.equal(context.device, "Mobile");
});

test("parses browser, version, operating system and device", () => {
  assert.deepEqual(
    parseUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel) Firefox/127.0 Mobile"),
    { browser: "Firefox", browserVersion: "127.0", os: "Android", device: "Mobile" },
  );
});

test("looks up an approximate location for a Railway login without geo headers", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async (url, options) => {
    assert.match(url, /^https:\/\/ipwho\.is\/8\.8\.8\.8\?/);
    assert.ok(options.signal);
    return {
      ok: true,
      async json() {
        return { success: true, country_code: "VN", region: "Hà Nội", city: "Hà Nội" };
      },
    };
  };

  const context = await getLoginRequestContext({
    ip: "10.0.0.1",
    headers: {
      origin: "https://huy-locket-production.up.railway.app",
      "x-real-ip": "8.8.8.8",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0 Safari/537.36",
    },
  });

  assert.equal(context.ipAddress, "8.8.8.8");
  assert.equal(context.country, "VN");
  assert.equal(context.region, "Hà Nội");
  assert.equal(context.city, "Hà Nội");
});
