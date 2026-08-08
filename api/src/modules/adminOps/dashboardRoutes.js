const express = require("express");
const { neon } = require("@neondatabase/serverless");
const {
  getAdminLocketEmails,
  getAdminLocketUids,
  getLocketAuthVerifier,
} = require("../../services/locketAdminVerifier");
const {
  getUserRole,
  hasActivityDatabase,
} = require("../../services/userActivityStore");
const { getRequestTelemetry } = require("../../services/requestTelemetry");
const slotStore = require("../slotMonitor/store");
const eventStore = require("../slotMonitor/eventStore");
const notificationHistoryStore = require("../slotMonitor/notificationHistoryStore");

const router = express.Router();
const databaseUrl = String(
  process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "",
).trim();
const sql = databaseUrl ? neon(databaseUrl) : null;

async function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED" });
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
      });
    }

    req.adminUid = decoded.uid;
    req.adminRole = role === "user" ? "super_admin" : role;
    return next();
  } catch {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED" });
  }
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeCommit() {
  return String(
    process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.SOURCE_COMMIT ||
      process.env.COMMIT_SHA ||
      "",
  )
    .trim()
    .slice(0, 12);
}

router.use(requireAdmin);

router.get("/", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!sql) {
    return res.status(503).json({
      success: false,
      code: "DATABASE_NOT_CONFIGURED",
      message: "Database vận hành chưa được cấu hình.",
    });
  }

  try {
    await Promise.all([
      slotStore.ensureSchema(),
      eventStore.ensureSchema(),
      notificationHistoryStore.ensureSchema(),
    ]);

    const [watchRows, sessionRows, eventRows, notificationRows, recentFailures] =
      await Promise.all([
        sql`
          SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(DISTINCT user_uid)::BIGINT AS users,
            COUNT(*) FILTER (WHERE enabled = TRUE)::BIGINT AS enabled,
            COUNT(*) FILTER (WHERE auto_request_enabled = TRUE)::BIGINT AS auto_enabled,
            COUNT(*) FILTER (
              WHERE enabled = TRUE
                AND COALESCE(max_friends, 0) > COALESCE(friend_count, 0)
            )::BIGINT AS open_now,
            COUNT(*) FILTER (
              WHERE last_checked_at >= NOW() - INTERVAL '1 minute'
            )::BIGINT AS checked_last_minute
          FROM slot_monitor_watches
        `,
        sql`
          SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE enabled = TRUE AND COALESCE(last_error, '') = '')::BIGINT AS healthy,
            COUNT(*) FILTER (WHERE enabled = FALSE OR COALESCE(last_error, '') <> '')::BIGINT AS attention
          FROM slot_monitor_sessions
        `,
        sql`
          SELECT
            COUNT(*) FILTER (
              WHERE event_type = 'SLOT_OPEN'
                AND created_at >= NOW() - INTERVAL '24 hours'
            )::BIGINT AS slot_open_24h,
            COUNT(*) FILTER (
              WHERE event_type = 'AUTO_REQUEST_SENT'
                AND created_at >= NOW() - INTERVAL '24 hours'
            )::BIGINT AS request_sent_24h,
            COUNT(*) FILTER (
              WHERE event_type = 'AUTO_REQUEST_FAILED'
                AND created_at >= NOW() - INTERVAL '24 hours'
            )::BIGINT AS request_failed_24h
          FROM slot_monitor_events
        `,
        sql`
          SELECT
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::BIGINT AS total_24h,
            COUNT(*) FILTER (
              WHERE created_at >= NOW() - INTERVAL '24 hours'
                AND status IN ('SUCCESS', 'PARTIAL')
            )::BIGINT AS success_24h,
            COUNT(*) FILTER (
              WHERE created_at >= NOW() - INTERVAL '24 hours'
                AND status = 'FAILED'
            )::BIGINT AS failed_24h,
            COUNT(*) FILTER (
              WHERE created_at >= NOW() - INTERVAL '24 hours'
                AND status = 'SKIPPED'
            )::BIGINT AS skipped_24h
          FROM slot_notification_history
        `,
        sql`
          SELECT channel, status, username, error_code, error_message, created_at
          FROM slot_notification_history
          WHERE status = 'FAILED'
          ORDER BY created_at DESC, id DESC
          LIMIT 12
        `,
      ]);

    const watches = watchRows[0] || {};
    const sessions = sessionRows[0] || {};
    const events = eventRows[0] || {};
    const notifications = notificationRows[0] || {};
    const traffic = getRequestTelemetry();
    const attempted = Math.max(
      0,
      number(notifications.success_24h) + number(notifications.failed_24h),
    );
    const successRate = attempted
      ? Math.round((number(notifications.success_24h) / attempted) * 1000) / 10
      : null;

    const pollIntervalMs = Math.min(
      3 * 60 * 1000,
      Math.max(5_000, Number(process.env.SLOT_POLL_INTERVAL_MS) || 45_000),
    );

    return res.json({
      success: true,
      data: {
        checkedAt: Date.now(),
        runtime: {
          uptimeSeconds: Math.round(process.uptime()),
          node: process.version,
          environment: String(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || ""),
          backendCommit: safeCommit(),
        },
        traffic: {
          requestsPerMinute: number(traffic.requestsPerMinute),
          errorsLastMinute: number(traffic.errorsLastMinute),
          recentErrors: Array.isArray(traffic.recentErrors) ? traffic.recentErrors : [],
        },
        worker: {
          pollIntervalMs,
          checkedWatchesLastMinute: number(watches.checked_last_minute),
        },
        slotMonitor: {
          users: number(watches.users),
          total: number(watches.total),
          enabled: number(watches.enabled),
          autoEnabled: number(watches.auto_enabled),
          openNow: number(watches.open_now),
          sessionsTotal: number(sessions.total),
          sessionsHealthy: number(sessions.healthy),
          sessionsAttention: number(sessions.attention),
          slotOpen24h: number(events.slot_open_24h),
          requestSent24h: number(events.request_sent_24h),
          requestFailed24h: number(events.request_failed_24h),
        },
        notifications: {
          total24h: number(notifications.total_24h),
          success24h: number(notifications.success_24h),
          failed24h: number(notifications.failed_24h),
          skipped24h: number(notifications.skipped_24h),
          successRate,
          recentFailures: recentFailures.map((row) => ({
            channel: row.channel || "",
            status: row.status || "FAILED",
            username: row.username || "",
            errorCode: row.error_code || "",
            errorMessage: row.error_message || "",
            createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
          })),
        },
      },
    });
  } catch (error) {
    console.error("[admin-ops] dashboard failed", error?.code || error?.message || error);
    return res.status(500).json({
      success: false,
      code: "ADMIN_OPS_DASHBOARD_FAILED",
      message: "Không tải được số liệu vận hành.",
    });
  }
});

module.exports = router;
