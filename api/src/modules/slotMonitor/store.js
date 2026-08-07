const { neon } = require("@neondatabase/serverless");

const databaseUrl = String(
  process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "",
).trim();
const sql = databaseUrl ? neon(databaseUrl) : null;
let schemaPromise = null;

function isConfigured() {
  return Boolean(sql);
}

async function ensureSchema() {
  if (!sql) {
    const error = new Error("DATABASE_URL is required for 24/7 Slot Monitor");
    error.code = "SLOT_DATABASE_UNAVAILABLE";
    throw error;
  }
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS slot_monitor_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS slot_monitor_sessions (
        user_uid TEXT PRIMARY KEY,
        refresh_token_enc TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_refresh_at TIMESTAMPTZ,
        last_error TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS slot_monitor_watches (
        user_uid TEXT NOT NULL,
        celeb_uid TEXT NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        friend_count BIGINT NOT NULL DEFAULT 0,
        max_friends BIGINT NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'WATCHING',
        last_was_full BOOLEAN NOT NULL DEFAULT TRUE,
        last_checked_at TIMESTAMPTZ,
        notified_at TIMESTAMPTZ,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_uid, celeb_uid)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_slot_monitor_watches_user_enabled
      ON slot_monitor_watches (user_uid, enabled)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS slot_push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        user_uid TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_slot_push_subscriptions_user_active
      ON slot_push_subscriptions (user_uid, active)
    `;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}

async function getConfigValue(key) {
  await ensureSchema();
  const rows = await sql`
    SELECT value FROM slot_monitor_config WHERE key = ${String(key)} LIMIT 1
  `;
  return rows[0]?.value || null;
}

async function setConfigValue(key, value) {
  await ensureSchema();
  await sql`
    INSERT INTO slot_monitor_config (key, value, updated_at)
    VALUES (${String(key)}, ${String(value)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

async function saveSession(userUid, refreshTokenEnc) {
  await ensureSchema();
  await sql`
    INSERT INTO slot_monitor_sessions
      (user_uid, refresh_token_enc, enabled, last_error, updated_at)
    VALUES (${String(userUid)}, ${String(refreshTokenEnc)}, TRUE, NULL, NOW())
    ON CONFLICT (user_uid) DO UPDATE SET
      refresh_token_enc = EXCLUDED.refresh_token_enc,
      enabled = TRUE,
      last_error = NULL,
      updated_at = NOW()
  `;
}

async function getSession(userUid) {
  await ensureSchema();
  const rows = await sql`
    SELECT user_uid, refresh_token_enc, enabled, last_refresh_at, last_error
    FROM slot_monitor_sessions
    WHERE user_uid = ${String(userUid)}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function markSessionRefreshed(userUid, refreshTokenEnc = null) {
  await ensureSchema();
  if (refreshTokenEnc) {
    await sql`
      UPDATE slot_monitor_sessions
      SET refresh_token_enc = ${String(refreshTokenEnc)}, last_refresh_at = NOW(),
          last_error = NULL, enabled = TRUE, updated_at = NOW()
      WHERE user_uid = ${String(userUid)}
    `;
  } else {
    await sql`
      UPDATE slot_monitor_sessions
      SET last_refresh_at = NOW(), last_error = NULL, enabled = TRUE, updated_at = NOW()
      WHERE user_uid = ${String(userUid)}
    `;
  }
}

async function markSessionError(userUid, message) {
  await ensureSchema();
  await sql`
    UPDATE slot_monitor_sessions
    SET last_error = ${String(message || "Session refresh failed").slice(0, 400)}, updated_at = NOW()
    WHERE user_uid = ${String(userUid)}
  `;
}

async function upsertWatch(userUid, watch) {
  await ensureSchema();
  await sql`
    INSERT INTO slot_monitor_watches (
      user_uid, celeb_uid, username, display_name, avatar_url,
      friend_count, max_friends, status, last_was_full, enabled, updated_at
    ) VALUES (
      ${String(userUid)}, ${String(watch.uid)}, ${String(watch.username)},
      ${String(watch.displayName || watch.username)}, ${String(watch.avatar || "")},
      ${Number(watch.friendCount) || 0}, ${Number(watch.maxFriends) || 0},
      ${String(watch.status || "WATCHING")},
      ${Boolean((Number(watch.maxFriends) || 0) > 0 && (Number(watch.friendCount) || 0) >= (Number(watch.maxFriends) || 0))},
      TRUE, NOW()
    )
    ON CONFLICT (user_uid, celeb_uid) DO UPDATE SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      friend_count = EXCLUDED.friend_count,
      max_friends = EXCLUDED.max_friends,
      enabled = TRUE,
      updated_at = NOW()
  `;
}

async function removeWatch(userUid, celebUid) {
  await ensureSchema();
  await sql`
    DELETE FROM slot_monitor_watches
    WHERE user_uid = ${String(userUid)} AND celeb_uid = ${String(celebUid)}
  `;
}

async function setWatchEnabled(userUid, celebUid, enabled) {
  await ensureSchema();
  await sql`
    UPDATE slot_monitor_watches
    SET enabled = ${Boolean(enabled)},
        status = ${enabled ? "WATCHING" : "PAUSED"},
        updated_at = NOW()
    WHERE user_uid = ${String(userUid)} AND celeb_uid = ${String(celebUid)}
  `;
}

async function listUserWatches(userUid) {
  await ensureSchema();
  return sql`
    SELECT user_uid, celeb_uid, username, display_name, avatar_url,
           friend_count, max_friends, status, last_was_full,
           last_checked_at, notified_at, enabled
    FROM slot_monitor_watches
    WHERE user_uid = ${String(userUid)}
    ORDER BY created_at ASC
  `;
}

async function listActiveUsers() {
  await ensureSchema();
  return sql`
    SELECT DISTINCT w.user_uid
    FROM slot_monitor_watches w
    INNER JOIN slot_monitor_sessions s ON s.user_uid = w.user_uid
    WHERE w.enabled = TRUE AND s.enabled = TRUE
    ORDER BY w.user_uid ASC
  `;
}

async function listActiveWatchesForUser(userUid) {
  await ensureSchema();
  return sql`
    SELECT user_uid, celeb_uid, username, display_name, avatar_url,
           friend_count, max_friends, status, last_was_full,
           last_checked_at, notified_at, enabled
    FROM slot_monitor_watches
    WHERE user_uid = ${String(userUid)} AND enabled = TRUE
    ORDER BY created_at ASC
    LIMIT 20
  `;
}

async function updateWatchSnapshot(userUid, celebUid, snapshot) {
  await ensureSchema();
  await sql`
    UPDATE slot_monitor_watches
    SET friend_count = ${Number(snapshot.friendCount) || 0},
        max_friends = ${Number(snapshot.maxFriends) || 0},
        status = ${String(snapshot.status || "WATCHING")},
        last_was_full = ${Boolean(snapshot.lastWasFull)},
        last_checked_at = NOW(),
        notified_at = CASE WHEN ${Boolean(snapshot.shouldNotify)} THEN NOW() ELSE notified_at END,
        updated_at = NOW()
    WHERE user_uid = ${String(userUid)} AND celeb_uid = ${String(celebUid)}
  `;
}

async function upsertSubscription(userUid, subscription, userAgent = "") {
  await ensureSchema();
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");
  if (!endpoint || !p256dh || !auth) {
    const error = new Error("Invalid push subscription");
    error.code = "INVALID_PUSH_SUBSCRIPTION";
    throw error;
  }

  await sql`
    INSERT INTO slot_push_subscriptions
      (endpoint, user_uid, p256dh, auth, active, user_agent, updated_at)
    VALUES (
      ${endpoint}, ${String(userUid)}, ${p256dh}, ${auth}, TRUE,
      ${String(userAgent || "").slice(0, 500)}, NOW()
    )
    ON CONFLICT (endpoint) DO UPDATE SET
      user_uid = EXCLUDED.user_uid,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      active = TRUE,
      user_agent = EXCLUDED.user_agent,
      updated_at = NOW()
  `;
}

async function listSubscriptionsForUser(userUid) {
  await ensureSchema();
  return sql`
    SELECT endpoint, p256dh, auth
    FROM slot_push_subscriptions
    WHERE user_uid = ${String(userUid)} AND active = TRUE
  `;
}

async function deactivateSubscription(endpoint) {
  await ensureSchema();
  await sql`
    UPDATE slot_push_subscriptions
    SET active = FALSE, updated_at = NOW()
    WHERE endpoint = ${String(endpoint)}
  `;
}

module.exports = {
  isConfigured,
  ensureSchema,
  getConfigValue,
  setConfigValue,
  saveSession,
  getSession,
  markSessionRefreshed,
  markSessionError,
  upsertWatch,
  removeWatch,
  setWatchEnabled,
  listUserWatches,
  listActiveUsers,
  listActiveWatchesForUser,
  updateWatchSnapshot,
  upsertSubscription,
  listSubscriptionsForUser,
  deactivateSubscription,
};
