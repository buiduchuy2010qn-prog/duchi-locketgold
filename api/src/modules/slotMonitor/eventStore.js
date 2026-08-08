const { neon } = require("@neondatabase/serverless");
const store = require("./store");

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
    const error = new Error("DATABASE_URL is required for Celeb Center history");
    error.code = "SLOT_EVENT_DATABASE_UNAVAILABLE";
    throw error;
  }
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    // Bảo đảm bảng watch gốc tồn tại trước khi cài trigger lịch sử.
    await store.ensureSchema();

    await sql`
      CREATE TABLE IF NOT EXISTS slot_monitor_events (
        id BIGSERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL,
        celeb_uid TEXT NOT NULL,
        username TEXT NOT NULL,
        event_type TEXT NOT NULL,
        available_slots BIGINT NOT NULL DEFAULT 0,
        friend_count BIGINT NOT NULL DEFAULT 0,
        max_friends BIGINT NOT NULL DEFAULT 0,
        detail TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_slot_monitor_events_user_created
      ON slot_monitor_events (user_uid, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_slot_monitor_events_user_celeb_created
      ON slot_monitor_events (user_uid, celeb_uid, created_at DESC)
    `;

    // Ghi lịch sử trực tiếp từ thay đổi DB để không phụ thuộc UI đang mở.
    // SLOT_OPEN chỉ được ghi khi full -> có slot hoặc Celeb tăng giới hạn bạn.
    // AUTO_REQUEST_* được ghi đúng lúc kết quả request thật được lưu.
    await sql`
      CREATE OR REPLACE FUNCTION slot_monitor_capture_watch_event()
      RETURNS TRIGGER AS $$
      DECLARE
        old_available BIGINT;
        new_available BIGINT;
      BEGIN
        old_available := GREATEST(
          0,
          COALESCE(OLD.max_friends, 0) - COALESCE(OLD.friend_count, 0)
        );
        new_available := GREATEST(
          0,
          COALESCE(NEW.max_friends, 0) - COALESCE(NEW.friend_count, 0)
        );

        IF NEW.enabled = TRUE
           AND new_available > 0
           AND (
             (COALESCE(OLD.last_was_full, FALSE) = TRUE
               AND COALESCE(NEW.last_was_full, FALSE) = FALSE)
             OR (
               COALESCE(NEW.max_friends, 0) > COALESCE(OLD.max_friends, 0)
               AND new_available > old_available
             )
           )
        THEN
          INSERT INTO slot_monitor_events (
            user_uid, celeb_uid, username, event_type,
            available_slots, friend_count, max_friends, detail, created_at
          ) VALUES (
            NEW.user_uid,
            NEW.celeb_uid,
            NEW.username,
            'SLOT_OPEN',
            new_available,
            COALESCE(NEW.friend_count, 0),
            COALESCE(NEW.max_friends, 0),
            NULL,
            COALESCE(NEW.last_checked_at, NOW())
          );
        END IF;

        IF NEW.last_auto_request_at IS DISTINCT FROM OLD.last_auto_request_at
           AND NEW.last_auto_request_at IS NOT NULL
           AND NEW.last_auto_request_status IN ('SENT', 'FAILED')
        THEN
          INSERT INTO slot_monitor_events (
            user_uid, celeb_uid, username, event_type,
            available_slots, friend_count, max_friends, detail, created_at
          ) VALUES (
            NEW.user_uid,
            NEW.celeb_uid,
            NEW.username,
            CASE
              WHEN NEW.last_auto_request_status = 'SENT'
                THEN 'AUTO_REQUEST_SENT'
              ELSE 'AUTO_REQUEST_FAILED'
            END,
            new_available,
            COALESCE(NEW.friend_count, 0),
            COALESCE(NEW.max_friends, 0),
            NEW.last_auto_request_error,
            NEW.last_auto_request_at
          );
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`
      DROP TRIGGER IF EXISTS slot_monitor_watch_event_trigger
      ON slot_monitor_watches
    `;

    await sql`
      CREATE TRIGGER slot_monitor_watch_event_trigger
      AFTER UPDATE ON slot_monitor_watches
      FOR EACH ROW
      EXECUTE FUNCTION slot_monitor_capture_watch_event()
    `;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}

async function listEvents(userUid, { celebUid = "", limit = 120 } = {}) {
  await ensureSchema();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 120));
  const uid = String(userUid || "");
  const celeb = String(celebUid || "").trim();

  if (celeb) {
    return sql`
      SELECT id, user_uid, celeb_uid, username, event_type,
             available_slots, friend_count, max_friends, detail, created_at
      FROM slot_monitor_events
      WHERE user_uid = ${uid} AND celeb_uid = ${celeb}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit}
    `;
  }

  return sql`
    SELECT id, user_uid, celeb_uid, username, event_type,
           available_slots, friend_count, max_friends, detail, created_at
    FROM slot_monitor_events
    WHERE user_uid = ${uid}
    ORDER BY created_at DESC, id DESC
    LIMIT ${safeLimit}
  `;
}

module.exports = {
  isConfigured,
  ensureSchema,
  listEvents,
};
