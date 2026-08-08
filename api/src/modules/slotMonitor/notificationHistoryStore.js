const { neon } = require("@neondatabase/serverless");
const store = require("./store");

const databaseUrl = String(
  process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "",
).trim();
const sql = databaseUrl ? neon(databaseUrl) : null;
let schemaPromise = null;

async function ensureSchema() {
  if (!sql) {
    const error = new Error("DATABASE_URL is required for notification history");
    error.code = "NOTIFICATION_HISTORY_DATABASE_UNAVAILABLE";
    throw error;
  }
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await store.ensureSchema();
    await sql`
      CREATE TABLE IF NOT EXISTS slot_notification_history (
        id BIGSERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL,
        event_id TEXT,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        notification_type TEXT,
        title TEXT,
        body TEXT,
        url TEXT,
        username TEXT,
        available_slots BIGINT NOT NULL DEFAULT 0,
        error_code TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_slot_notification_history_user_created
      ON slot_notification_history (user_uid, created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_slot_notification_history_user_channel_created
      ON slot_notification_history (user_uid, channel, created_at DESC)
    `;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

async function recordDelivery({
  userUid,
  eventId = "",
  channel,
  status,
  payload = {},
  errorCode = "",
  errorMessage = "",
}) {
  await ensureSchema();
  const celeb = payload?.celeb || {};
  await sql`
    INSERT INTO slot_notification_history (
      user_uid, event_id, channel, status, notification_type,
      title, body, url, username, available_slots,
      error_code, error_message, created_at
    ) VALUES (
      ${clip(userUid, 200)},
      ${clip(eventId, 240) || null},
      ${clip(channel, 40)},
      ${clip(status, 40)},
      ${clip(payload?.type, 80) || null},
      ${clip(payload?.title, 240) || null},
      ${clip(payload?.body, 1200) || null},
      ${clip(payload?.url, 1000) || null},
      ${clip(celeb?.username || payload?.username, 100) || null},
      ${Math.max(0, Number(celeb?.availableSlots) || 0)},
      ${clip(errorCode, 120) || null},
      ${clip(errorMessage, 800) || null},
      NOW()
    )
  `;
}

async function listDeliveries(userUid, { channel = "", limit = 160 } = {}) {
  await ensureSchema();
  const uid = clip(userUid, 200);
  const selectedChannel = clip(channel, 40).toLowerCase();
  const safeLimit = Math.max(1, Math.min(250, Number(limit) || 160));

  if (selectedChannel) {
    return sql`
      SELECT id, event_id, channel, status, notification_type,
             title, body, url, username, available_slots,
             error_code, error_message, created_at
      FROM slot_notification_history
      WHERE user_uid = ${uid} AND channel = ${selectedChannel}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit}
    `;
  }

  return sql`
    SELECT id, event_id, channel, status, notification_type,
           title, body, url, username, available_slots,
           error_code, error_message, created_at
    FROM slot_notification_history
    WHERE user_uid = ${uid}
    ORDER BY created_at DESC, id DESC
    LIMIT ${safeLimit}
  `;
}

module.exports = {
  ensureSchema,
  recordDelivery,
  listDeliveries,
};
