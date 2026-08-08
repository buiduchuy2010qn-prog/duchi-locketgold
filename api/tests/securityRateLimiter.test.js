const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generalApiKeyGenerator,
} = require("../src/middlewares/securityRateLimiter");

function request({ token = "", forwardedFor = "34.87.71.102" } = {}) {
  return {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-forwarded-for": forwardedFor,
    },
    ip: "34.87.71.102",
  };
}

test("general API quota separates authenticated sessions behind one Vercel proxy", () => {
  const first = generalApiKeyGenerator(request({ token: "firebase-token-a" }));
  const second = generalApiKeyGenerator(request({ token: "firebase-token-b" }));

  assert.match(first, /^session:[a-f0-9]{32}$/);
  assert.match(second, /^session:[a-f0-9]{32}$/);
  assert.notEqual(first, second);
});

test("general API quota key never contains the raw bearer token", () => {
  const token = "secret-firebase-id-token";
  const key = generalApiKeyGenerator(request({ token }));

  assert.equal(key.includes(token), false);
  assert.equal(key, generalApiKeyGenerator(request({ token })));
});

test("unauthenticated requests still fall back to the best public IP", () => {
  const key = generalApiKeyGenerator(
    request({ forwardedFor: "203.0.113.25, 34.87.71.102" }),
  );

  assert.equal(key, "ip:203.0.113.25");
});
