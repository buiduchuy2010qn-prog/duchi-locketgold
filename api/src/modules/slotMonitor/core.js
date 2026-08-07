const SLOT_STATUS = Object.freeze({
  WATCHING: "WATCHING",
  SLOT_OPEN: "SLOT_OPEN",
  PAUSED: "PAUSED",
  ERROR: "ERROR",
});

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .trim()
    .slice(0, 64);
}

function sanitizeWatchInput(raw = {}) {
  const uid = String(raw.uid || "").trim().slice(0, 160);
  const username = normalizeUsername(raw.username);
  if (!uid || !username) return null;

  const friendCount = Math.max(0, Number(raw.friendCount) || 0);
  const maxFriends = Math.max(0, Number(raw.maxFriends) || 0);

  return {
    uid,
    username,
    displayName: String(raw.displayName || username).trim().slice(0, 120),
    avatar: String(raw.avatar || "").trim().slice(0, 1000),
    friendCount,
    maxFriends,
    status: SLOT_STATUS.WATCHING,
  };
}

function extractCelebritySnapshot(result) {
  const user = result?.data || result?.result?.data || result;
  const celebrity = user?.celebrity_data;
  if (!celebrity) return null;

  const friendCount = Math.max(0, Number(celebrity.friend_count) || 0);
  const maxFriends = Math.max(0, Number(celebrity.max_friends) || 0);
  if (!maxFriends) return null;

  return {
    friendCount,
    maxFriends,
    availableSlots: Math.max(0, maxFriends - friendCount),
    isFull: friendCount >= maxFriends,
  };
}

function computeTransition(previous, snapshot) {
  const wasFull =
    typeof previous?.last_was_full === "boolean"
      ? previous.last_was_full
      : typeof previous?.lastWasFull === "boolean"
        ? previous.lastWasFull
        : Number(previous?.max_friends ?? previous?.maxFriends ?? 0) > 0 &&
          Number(previous?.friend_count ?? previous?.friendCount ?? 0) >=
            Number(previous?.max_friends ?? previous?.maxFriends ?? 0);

  const shouldNotify = wasFull && !snapshot.isFull;

  return {
    friendCount: snapshot.friendCount,
    maxFriends: snapshot.maxFriends,
    availableSlots: snapshot.availableSlots,
    lastWasFull: snapshot.isFull,
    status: snapshot.isFull ? SLOT_STATUS.WATCHING : SLOT_STATUS.SLOT_OPEN,
    shouldNotify,
  };
}

function decodeFirebaseUid(idToken) {
  try {
    const payload = String(idToken || "").split(".")[1];
    if (!payload) return "";
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return String(json.user_id || json.uid || json.sub || "");
  } catch {
    return "";
  }
}

module.exports = {
  SLOT_STATUS,
  normalizeUsername,
  sanitizeWatchInput,
  extractCelebritySnapshot,
  computeTransition,
  decodeFirebaseUid,
};
