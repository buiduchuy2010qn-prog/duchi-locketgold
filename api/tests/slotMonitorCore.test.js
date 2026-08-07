const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizeWatchInput,
  extractCelebritySnapshot,
  computeTransition,
  decodeFirebaseUid,
} = require("../src/modules/slotMonitor/core");
const {
  encryptSecret,
  decryptSecret,
} = require("../src/modules/slotMonitor/crypto");

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
}

test("sanitizeWatchInput rejects invalid entries and normalizes username", () => {
  assert.equal(sanitizeWatchInput({}), null);
  assert.equal(sanitizeWatchInput({ uid: "abc" }), null);

  const watch = sanitizeWatchInput({
    uid: " celeb-1 ",
    username: " @Taylor ",
    displayName: " Taylor ",
    friendCount: "1000",
    maxFriends: 1000,
  });

  assert.equal(watch.uid, "celeb-1");
  assert.equal(watch.username, "Taylor");
  assert.equal(watch.friendCount, 1000);
  assert.equal(watch.maxFriends, 1000);
});

test("extractCelebritySnapshot reads friend_count and max_friends", () => {
  const snapshot = extractCelebritySnapshot({
    data: {
      celebrity_data: {
        friend_count: 998,
        max_friends: 1000,
      },
    },
  });

  assert.deepEqual(snapshot, {
    friendCount: 998,
    maxFriends: 1000,
    availableSlots: 2,
    isFull: false,
  });
});

test("full to open notifies exactly once until the celeb becomes full again", () => {
  const full = {
    friend_count: 1000,
    max_friends: 1000,
    last_was_full: true,
  };
  const openSnapshot = {
    friendCount: 999,
    maxFriends: 1000,
    availableSlots: 1,
    isFull: false,
  };

  const firstOpen = computeTransition(full, openSnapshot);
  assert.equal(firstOpen.shouldNotify, true);
  assert.equal(firstOpen.status, "SLOT_OPEN");
  assert.equal(firstOpen.lastWasFull, false);

  const stillOpen = computeTransition(
    {
      friend_count: firstOpen.friendCount,
      max_friends: firstOpen.maxFriends,
      last_was_full: firstOpen.lastWasFull,
    },
    openSnapshot,
  );
  assert.equal(stillOpen.shouldNotify, false);

  const fullAgain = computeTransition(
    {
      friend_count: 999,
      max_friends: 1000,
      last_was_full: false,
    },
    {
      friendCount: 1000,
      maxFriends: 1000,
      availableSlots: 0,
      isFull: true,
    },
  );
  assert.equal(fullAgain.shouldNotify, false);
  assert.equal(fullAgain.lastWasFull, true);

  const secondOpen = computeTransition(
    {
      friend_count: 1000,
      max_friends: 1000,
      last_was_full: fullAgain.lastWasFull,
    },
    openSnapshot,
  );
  assert.equal(secondOpen.shouldNotify, true);
});

test("decodeFirebaseUid extracts authenticated user id", () => {
  const token = makeJwt({ user_id: "user-123" });
  assert.equal(decodeFirebaseUid(token), "user-123");
  assert.equal(decodeFirebaseUid("bad-token"), "");
});

test("slot monitor encrypted session round-trips without exposing plaintext", () => {
  const previous = process.env.SLOT_MONITOR_ENCRYPTION_KEY;
  process.env.SLOT_MONITOR_ENCRYPTION_KEY = "test-only-slot-monitor-encryption-secret-123456";
  try {
    const value = "refresh-token-sensitive-value";
    const encrypted = encryptSecret(value);
    assert.notEqual(encrypted, value);
    assert.equal(encrypted.includes(value), false);
    assert.equal(decryptSecret(encrypted), value);
  } finally {
    if (previous === undefined) delete process.env.SLOT_MONITOR_ENCRYPTION_KEY;
    else process.env.SLOT_MONITOR_ENCRYPTION_KEY = previous;
  }
});
