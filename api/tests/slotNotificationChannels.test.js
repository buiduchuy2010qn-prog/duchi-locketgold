const test = require("node:test");
const assert = require("node:assert/strict");

const { sanitizeSettings } = require("../src/modules/slotMonitor/notificationService");
const {
  buildSlotMessage,
  getProviderConfig,
} = require("../src/modules/slotMonitor/notifiers");

test("notification settings keep only valid destinations and enabled channels", () => {
  const settings = sanitizeSettings({
    telegramChatId: "123456789",
    telegramEnabled: true,
    emailAddress: "User@Gmail.com",
    emailEnabled: true,
    zaloUserId: "186729651760683225",
    zaloEnabled: true,
  });

  assert.deepEqual(settings, {
    telegramChatId: "123456789",
    telegramEnabled: true,
    emailAddress: "user@gmail.com",
    emailEnabled: true,
    zaloUserId: "186729651760683225",
    zaloEnabled: true,
  });
});

test("disabled destination cannot become enabled without an address/id", () => {
  const settings = sanitizeSettings({
    telegramEnabled: true,
    emailEnabled: true,
    zaloEnabled: true,
  });
  assert.equal(settings.telegramEnabled, false);
  assert.equal(settings.emailEnabled, false);
  assert.equal(settings.zaloEnabled, false);
});

test("invalid email is rejected", () => {
  assert.throws(
    () => sanitizeSettings({ emailAddress: "not-an-email", emailEnabled: true }),
    (error) => error?.code === "INVALID_EMAIL_ADDRESS",
  );
});

test("Gmail provider is configured only with Apps Script URL and secret", () => {
  const previousUrl = process.env.GMAIL_APPS_SCRIPT_URL;
  const previousSecret = process.env.GMAIL_APPS_SCRIPT_SECRET;
  try {
    delete process.env.GMAIL_APPS_SCRIPT_URL;
    delete process.env.GMAIL_APPS_SCRIPT_SECRET;
    assert.equal(getProviderConfig().email.configured, false);

    process.env.GMAIL_APPS_SCRIPT_URL = "https://script.google.com/macros/s/test/exec";
    assert.equal(getProviderConfig().email.configured, false);

    process.env.GMAIL_APPS_SCRIPT_SECRET = "test-secret";
    assert.equal(getProviderConfig().email.configured, true);
  } finally {
    if (previousUrl === undefined) delete process.env.GMAIL_APPS_SCRIPT_URL;
    else process.env.GMAIL_APPS_SCRIPT_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.GMAIL_APPS_SCRIPT_SECRET;
    else process.env.GMAIL_APPS_SCRIPT_SECRET = previousSecret;
  }
});

test("slot message shows available slots and new capacity", () => {
  const previousWeb = process.env.PUBLIC_WEB_URL;
  process.env.PUBLIC_WEB_URL = "https://duchi.vercel.app";
  try {
    const message = buildSlotMessage({
      title: "🔥 Slot vừa mở!",
      url: "/friends?slot=1&username=celeb",
      celeb: {
        username: "celeb",
        availableSlots: 10000,
        friendCount: 20000,
        maxFriends: 30000,
      },
    });

    assert.match(message.text, /10[.\s]?000 slot trống/);
    assert.match(message.text, /20[.\s]?000 \/ 30[.\s]?000/);
    assert.match(message.url, /duchi\.vercel\.app/);
  } finally {
    if (previousWeb === undefined) delete process.env.PUBLIC_WEB_URL;
    else process.env.PUBLIC_WEB_URL = previousWeb;
  }
});
