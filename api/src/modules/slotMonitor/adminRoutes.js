const express = require("express");
const { neon } = require("@neondatabase/serverless");
const {
  getAdminLocketEmails,
  getAdminLocketUids,
  getLocketAuthVerifier,
} = require("../../services/locketAdminVerifier");
const {
  getUserRole,
  getWebUser,
  hasActivityDatabase,
} = require("../../services/userActivityStore");

const router = express.Router();

const databaseUrl = String(
  process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "",
).trim();
const sql = databaseUrl ? neon(databaseUrl) : null;

async function requireSlotAdmin(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Bạn cần đăng nhập tài khoản Admin.",
    });
  }

  try {
    const decoded = await getLocketAuthVerifier().verifyIdToken(
      authorization.slice(7),
      false,
    );
    const email = String(decoded.email || "").trim().toLowerCase();
    const allowedUids = getAdminLocketUids();
    const allowedEmails = getAdminLocketEmails();

    let role = "user";
    if (hasActivityDatabase()) {
      role = await getUserRole(decoded.uid, email);
    } else if (allowedUids.has(decoded.uid) || allowedEmails.has(email)) {
      role = "super_admin";
    }

    if (
      role === "user" &&
      !allowedUids.has(decoded.uid) &&
      !allowedEmails.has(email)
    ) {
      return res.status(403).json({
        success: false,
        code: "ADMIN_PERMISSION_REQUIRED",
        message: "Khu vực này chỉ dành cho Admin.",
      });
    }

    req.adminUid = decoded.uid;
    req.adminEmail = decoded.email || null;
    req.adminRole = role === "user" ? "super_admin" : role;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Phiên Admin không hợp lệ hoặc đã hết hạn.",
    });
  }
}

function requireDatabase(_req, res, next) {
  if (!sql) {
    return res.status(503).json({
      success: false,
      code: "SLOT_DATABASE_UNAVAILABLE",
      message: "Database Canh Slot chưa được cấu hình.",
    });
  }
  return next();
}

function mapWatch(row) {
  return {
    userUid: row.user_uid,
    uid: row.celeb_uid,
    username: row.username,
    displayName: row.display_name || row.username,
    avatar: row.avatar_url || "",
    friendCount: Number(row.friend_count) || 0,
    maxFriends: Number(row.max_friends) || 0,
    status: row.status || "WATCHING",
    enabled: Boolean(row.enabled),
    lastWasFull: Boolean(row.last_was_full),
    lastCheckedAt: row.last_checked_at
      ? new Date(row.last_checked_at).getTime()
      : null,
    notifiedAt: row.notified_at ? new Date(row.notified_at).getTime() : null,
    autoRequestEnabled: Boolean(row.auto_request_enabled),
    lastAutoRequestAt: row.last_auto_request_at
      ? new Date(row.last_auto_request_at).getTime()
      : null,
    lastAutoRequestStatus: row.last_auto_request_status || "",
    lastAutoRequestError: row.last_auto_request_error || "",
    sessionEnabled: Boolean(row.session_enabled),
    sessionLastRefreshAt: row.session_last_refresh_at
      ? new Date(row.session_last_refresh_at).getTime()
      : null,
    sessionLastError: row.session_last_error || "",
  };
}

function mapEvent(row) {
  return {
    id: String(row.id),
    userUid: row.user_uid,
    uid: row.celeb_uid,
    username: row.username,
    type: row.event_type,
    availableSlots: Number(row.available_slots) || 0,
    friendCount: Number(row.friend_count) || 0,
    maxFriends: Number(row.max_friends) || 0,
    detail: row.detail || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
  };
}

async function getSafeUserProfiles(userUids) {
  const pairs = await Promise.all(
    [...new Set(userUids.filter(Boolean))].map(async (uid) => {
      try {
        const user = await getWebUser(uid);
        return [uid, {
          uid,
          displayName:
            user?.displayName || user?.username || user?.email || `UID ${uid}`,
          email: user?.email || "",
          username: user?.username || "",
        }];
      } catch {
        return [uid, { uid, displayName: `UID ${uid}`, email: "", username: "" }];
      }
    }),
  );
  return Object.fromEntries(pairs);
}

router.use(requireSlotAdmin, requireDatabase);

router.get("/watches", async (_req, res, next) => {
  try {
    const rows = await sql`
      SELECT
        w.user_uid, w.celeb_uid, w.username, w.display_name, w.avatar_url,
        w.friend_count, w.max_friends, w.status, w.last_was_full,
        w.last_checked_at, w.notified_at, w.enabled,
        w.auto_request_enabled, w.last_auto_request_at,
        w.last_auto_request_status, w.last_auto_request_error,
        COALESCE(s.enabled, FALSE) AS session_enabled,
        s.last_refresh_at AS session_last_refresh_at,
        s.last_error AS session_last_error
      FROM slot_monitor_watches w
      LEFT JOIN slot_monitor_sessions s ON s.user_uid = w.user_uid
      ORDER BY w.user_uid ASC, w.created_at ASC
      LIMIT 1000
    `;
    const users = await getSafeUserProfiles(rows.map((row) => row.user_uid));
    return res.json({
      success: true,
      data: {
        watches: rows.map(mapWatch),
        users,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/events", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 250));
    const userUid = String(req.query?.userUid || "").trim();
    const celebUid = String(req.query?.uid || "").trim();
    let rows;

    if (userUid && celebUid) {
      rows = await sql`
        SELECT id, user_uid, celeb_uid, username, event_type,
               available_slots, friend_count, max_friends, detail, created_at
        FROM slot_monitor_events
        WHERE user_uid = ${userUid} AND celeb_uid = ${celebUid}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `;
    } else if (userUid) {
      rows = await sql`
        SELECT id, user_uid, celeb_uid, username, event_type,
               available_slots, friend_count, max_friends, detail, created_at
        FROM slot_monitor_events
        WHERE user_uid = ${userUid}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `;
    } else if (celebUid) {
      rows = await sql`
        SELECT id, user_uid, celeb_uid, username, event_type,
               available_slots, friend_count, max_friends, detail, created_at
        FROM slot_monitor_events
        WHERE celeb_uid = ${celebUid}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT id, user_uid, celeb_uid, username, event_type,
               available_slots, friend_count, max_friends, detail, created_at
        FROM slot_monitor_events
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `;
    }

    return res.json({ success: true, data: rows.map(mapEvent) });
  } catch (error) {
    return next(error);
  }
});

router.patch("/watches/:userUid/:celebUid", async (req, res, next) => {
  try {
    const userUid = String(req.params.userUid || "");
    const celebUid = String(req.params.celebUid || "");
    const hasEnabled = typeof req.body?.enabled === "boolean";
    const hasAutoRequest = typeof req.body?.autoRequestEnabled === "boolean";

    if (!hasEnabled && !hasAutoRequest) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SLOT_ADMIN_UPDATE",
        message: "Không có thay đổi hợp lệ để lưu.",
      });
    }

    if (hasEnabled && hasAutoRequest) {
      await sql`
        UPDATE slot_monitor_watches
        SET enabled = ${Boolean(req.body.enabled)},
            status = ${req.body.enabled ? "WATCHING" : "PAUSED"},
            auto_request_enabled = ${Boolean(req.body.autoRequestEnabled)},
            updated_at = NOW()
        WHERE user_uid = ${userUid} AND celeb_uid = ${celebUid}
      `;
    } else if (hasEnabled) {
      await sql`
        UPDATE slot_monitor_watches
        SET enabled = ${Boolean(req.body.enabled)},
            status = ${req.body.enabled ? "WATCHING" : "PAUSED"},
            updated_at = NOW()
        WHERE user_uid = ${userUid} AND celeb_uid = ${celebUid}
      `;
    } else {
      await sql`
        UPDATE slot_monitor_watches
        SET auto_request_enabled = ${Boolean(req.body.autoRequestEnabled)},
            updated_at = NOW()
        WHERE user_uid = ${userUid} AND celeb_uid = ${celebUid}
      `;
    }

    const rows = await sql`
      SELECT
        w.user_uid, w.celeb_uid, w.username, w.display_name, w.avatar_url,
        w.friend_count, w.max_friends, w.status, w.last_was_full,
        w.last_checked_at, w.notified_at, w.enabled,
        w.auto_request_enabled, w.last_auto_request_at,
        w.last_auto_request_status, w.last_auto_request_error,
        COALESCE(s.enabled, FALSE) AS session_enabled,
        s.last_refresh_at AS session_last_refresh_at,
        s.last_error AS session_last_error
      FROM slot_monitor_watches w
      LEFT JOIN slot_monitor_sessions s ON s.user_uid = w.user_uid
      WHERE w.user_uid = ${userUid} AND w.celeb_uid = ${celebUid}
      LIMIT 1
    `;
    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        code: "SLOT_WATCH_NOT_FOUND",
        message: "Không tìm thấy Celeb của người dùng này.",
      });
    }
    return res.json({ success: true, data: mapWatch(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/watches/:userUid/:celebUid", async (req, res, next) => {
  try {
    const userUid = String(req.params.userUid || "");
    const celebUid = String(req.params.celebUid || "");
    const rows = await sql`
      DELETE FROM slot_monitor_watches
      WHERE user_uid = ${userUid} AND celeb_uid = ${celebUid}
      RETURNING celeb_uid
    `;
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        code: "SLOT_WATCH_NOT_FOUND",
        message: "Celeb này đã không còn trên server.",
      });
    }
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
