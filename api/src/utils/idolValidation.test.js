const test = require("node:test");
const assert = require("node:assert/strict");
const {
  IdolValidationError,
  normalizeIdolInput,
  normalizeLocketProfileUrl,
} = require("./idolValidation");

test("normalizes a verified locket.cam profile URL", () => {
  assert.deepEqual(normalizeLocketProfileUrl("https://locket.cam/Hang_Test"), {
    locketUrl: "https://locket.cam/Hang_Test",
    normalizedUrl: "https://locket.cam/hang_test",
    username: "Hang_Test",
    normalizedUsername: "hang_test",
  });
});

test("rejects dangerous protocols and unverified hosts", () => {
  for (const unsafe of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://evil.example/hang_bingboong",
    "http://locket.cam/hang_bingboong",
  ]) {
    assert.throws(() => normalizeLocketProfileUrl(unsafe), IdolValidationError);
  }
});

test("rejects query, hash, nested path and username mismatch", () => {
  for (const invalid of [
    "https://locket.cam/hang_bingboong?next=https://evil.example",
    "https://locket.cam/hang_bingboong#profile",
    "https://locket.cam/a/b",
  ]) {
    assert.throws(() => normalizeLocketProfileUrl(invalid), IdolValidationError);
  }

  assert.throws(
    () =>
      normalizeIdolInput({
        locketUrl: "https://locket.cam/hang_bingboong",
        username: "someone_else",
      }),
    (error) => error.code === "USERNAME_MISMATCH",
  );
});

test("normalizes safe admin fields without accepting client HTML or invalid order", () => {
  const normalized = normalizeIdolInput({
    locketUrl: "https://locket.cam/hang_bingboong",
    displayName: "  Hằng  ",
    username: "@hang_bingboong",
    countryCode: "vn",
    sortOrder: "12",
    enabled: false,
  });
  assert.equal(normalized.displayName, "Hằng");
  assert.equal(normalized.countryCode, "VN");
  assert.equal(normalized.sortOrder, 12);
  assert.equal(normalized.enabled, false);

  assert.throws(
    () =>
      normalizeIdolInput({
        locketUrl: "https://locket.cam/hang_bingboong",
        displayName: '<img src=x onerror="alert(1)">',
      }),
    (error) => error.code === "INVALID_FIELD",
  );

  assert.throws(
    () =>
      normalizeIdolInput({
        locketUrl: "https://locket.cam/hang_bingboong",
        sortOrder: "not-a-number",
      }),
    (error) => error.code === "INVALID_SORT_ORDER",
  );
});
