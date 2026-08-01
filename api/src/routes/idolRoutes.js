const express = require("express");
const admin = require("firebase-admin");
const { neon } = require("@neondatabase/serverless");
const { friendservices } = require("../services");
const {
  idolAdminLimiter,
  idolReadLimiter,
} = require("../middlewares/rateLimit");
const {
  IdolValidationError,
  normalizeIdolInput,
} = require("../utils/idolValidation");

const router = express.Router();

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return;
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) return;

  try {
    const serviceAccount = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) {
    console.error("[idols] Firebase Admin initialization failed", {
      name: error?.name || "Error",
    });
  }
}

initializeFirebaseAdmin();

const databaseUrl =
  process.env.DATABASE_URL?.trim() || process.env.NEON_DATABASE_URL?.trim();
const sql = databaseUrl ? neon(databaseUrl) : null;
let schemaPromise = null;

function requireDatabase(res) {
  if (sql) return true;
  res.status(503).json({
    success: false,
    code: "DATABASE_UNAVAILABLE",
    message: "Cơ sở dữ liệu idol chưa được cấu hình.",
  });
  return false;
}

async function ensureSchema() {
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS locket_idols (
          id BIGSERIAL PRIMARY KEY,
          uid TEXT NOT NULL,
          username TEXT NOT NULL,
          username_normalized TEXT NOT NULL,
          display_name TEXT NOT NULL,
          avatar_url TEXT,
          locket_url TEXT NOT NULL,
          normalized_url TEXT NOT NULL,
          country_code VARCHAR(8) NOT NULL DEFAULT 'OTHER',
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS locket_idols_uid_unique
        ON locket_idols (uid)
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS locket_idols_username_unique
        ON locket_idols (username_normalized)
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS locket_idols_url_unique
        ON locket_idols (normalized_url)
      `;
    })();
  }
  return schemaPromise;
}

function mapIdol(row) {
  return {
    id: String(row.id),
    uid: row.uid,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || null,
    locketUrl: row.locket_url,
    countryCode: row.country_code,
    enabled: Boolean(row.enabled),
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Bạn chưa đăng nhập.",
    });
  }

  if (admin.apps.length === 0) {
    return res.status(503).json({
      success: false,
      code: "ADMIN_AUTH_UNAVAILABLE",
      message: "Dịch vụ xác thực quản trị chưa được cấu hình.",
    });
  }

  const idToken = authorization.slice("Bearer ".length).trim();
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken, true);
  } catch {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
    });
  }

  let isAdmin = decoded.admin === true;
  if (!isAdmin && process.env.ADMIN_BOOTSTRAP_UID) {
    isAdmin = decoded.uid === process.env.ADMIN_BOOTSTRAP_UID;
  }

  if (!isAdmin && sql) {
    try {
      const rows = await sql`
        SELECT uid FROM admin_roles WHERE uid = ${decoded.uid} LIMIT 1
      `;
      isAdmin = rows.length > 0;
    } catch (error) {
      console.error("[idols] admin role lookup failed", {
        code: error?.code || null,
      });
    }
  }

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      code: "FORBIDDEN",
      message: "Bạn không có quyền quản trị idol.",
    });
  }

  req.idolAdmin = { uid: decoded.uid, email: decoded.email || null, idToken };
  return next();
}

async function resolveLocketUser(idToken, username) {
  try {
    const result = await friendservices.FindFriendByUserName(idToken, username);
    if (result?.status === 404 || !result?.data?.uid) return null;
    return result.data;
  } catch (error) {
    if (Number(error?.response?.status) === 404) return null;
    const wrapped = new Error("LOCKET_LOOKUP_FAILED");
    wrapped.status = Number(error?.response?.status) || 502;
    throw wrapped;
  }
}

function sendRouteError(res, error) {
  if (error instanceof IdolValidationError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  if (error?.code === "23505") {
    return res.status(409).json({
      success: false,
      code: "IDOL_ALREADY_EXISTS",
      message: "Idol này đã có trong danh sách.",
    });
  }
  if (error?.message === "LOCKET_LOOKUP_FAILED") {
    const status = error.status === 429 ? 429 : error.status === 401 ? 401 : 502;
    return res.status(status).json({
      success: false,
      code: status === 429 ? "RATE_LIMITED" : "LOCKET_LOOKUP_FAILED",
      message:
        status === 429
          ? "Bạn thao tác quá nhanh. Vui lòng thử lại sau."
          : "Không thể xác minh hồ sơ với Locket.",
    });
  }

  console.error("[idols] route failed", {
    code: error?.code || null,
    name: error?.name || "Error",
  });
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "Không thể xử lý dữ liệu idol.",
  });
}

async function buildStoredIdol(req) {
  const input = normalizeIdolInput(req.body);
  const locketUser = await resolveLocketUser(
    req.idolAdmin.idToken,
    input.username,
  );
  if (!locketUser) {
    const error = new IdolValidationError(
      "LOCKET_USER_NOT_FOUND",
      "Không tìm thấy hồ sơ tương ứng trên Locket.",
    );
    error.status = 422;
    throw error;
  }

  const resolvedUsername = String(locketUser.username || input.username);
  if (resolvedUsername.toLowerCase() !== input.normalizedUsername) {
    const error = new IdolValidationError(
      "LOCKET_PROFILE_MISMATCH",
      "Hồ sơ Locket trả về không khớp với liên kết đã nhập.",
    );
    error.status = 422;
    throw error;
  }

  const resolvedDisplayName = [locketUser.first_name, locketUser.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  let avatarUrl = null;
  if (typeof locketUser.profile_picture_url === "string") {
    try {
      const parsedAvatar = new URL(locketUser.profile_picture_url);
      if (
        parsedAvatar.protocol === "https:" &&
        !parsedAvatar.username &&
        !parsedAvatar.password
      ) {
        avatarUrl = parsedAvatar.toString();
      }
    } catch {
      avatarUrl = null;
    }
  }

  return {
    ...input,
    uid: String(locketUser.uid),
    username: resolvedUsername,
    normalizedUsername: resolvedUsername.toLowerCase(),
    displayName: input.displayName || resolvedDisplayName || input.username,
    avatarUrl,
  };
}

router.get("/", idolReadLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!requireDatabase(res)) return;

  try {
    await ensureSchema();
    const rows = await sql`
      SELECT id, uid, username, display_name, avatar_url, locket_url,
             country_code, enabled, sort_order, created_at, updated_at
      FROM locket_idols
      WHERE enabled = TRUE
      ORDER BY sort_order ASC, display_name ASC, id ASC
    `;
    return res.status(200).json({ success: true, data: rows.map(mapIdol) });
  } catch (error) {
    return sendRouteError(res, error);
  }
});

router.get("/admin", idolAdminLimiter, requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!requireDatabase(res)) return;

  try {
    await ensureSchema();
    const rows = await sql`
      SELECT id, uid, username, display_name, avatar_url, locket_url,
             country_code, enabled, sort_order, created_at, updated_at
      FROM locket_idols
      ORDER BY sort_order ASC, display_name ASC, id ASC
    `;
    return res.status(200).json({ success: true, data: rows.map(mapIdol) });
  } catch (error) {
    return sendRouteError(res, error);
  }
});

router.post("/admin", idolAdminLimiter, requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!requireDatabase(res)) return;

  try {
    await ensureSchema();
    const idol = await buildStoredIdol(req);
    const rows = await sql`
      INSERT INTO locket_idols (
        uid, username, username_normalized, display_name, avatar_url,
        locket_url, normalized_url, country_code, enabled, sort_order
      ) VALUES (
        ${idol.uid}, ${idol.username}, ${idol.normalizedUsername},
        ${idol.displayName}, ${idol.avatarUrl}, ${idol.locketUrl},
        ${idol.normalizedUrl}, ${idol.countryCode}, ${idol.enabled},
        ${idol.sortOrder}
      )
      RETURNING id, uid, username, display_name, avatar_url, locket_url,
                country_code, enabled, sort_order, created_at, updated_at
    `;
    return res.status(201).json({ success: true, data: mapIdol(rows[0]) });
  } catch (error) {
    return sendRouteError(res, error);
  }
});

router.put("/admin/:id", idolAdminLimiter, requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!requireDatabase(res)) return;
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ID",
      message: "Idol không hợp lệ.",
    });
  }

  try {
    await ensureSchema();
    const idol = await buildStoredIdol(req);
    const rows = await sql`
      UPDATE locket_idols
      SET uid = ${idol.uid},
          username = ${idol.username},
          username_normalized = ${idol.normalizedUsername},
          display_name = ${idol.displayName},
          avatar_url = ${idol.avatarUrl},
          locket_url = ${idol.locketUrl},
          normalized_url = ${idol.normalizedUrl},
          country_code = ${idol.countryCode},
          enabled = ${idol.enabled},
          sort_order = ${idol.sortOrder},
          updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING id, uid, username, display_name, avatar_url, locket_url,
                country_code, enabled, sort_order, created_at, updated_at
    `;
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "IDOL_NOT_FOUND",
        message: "Không tìm thấy idol.",
      });
    }
    return res.status(200).json({ success: true, data: mapIdol(rows[0]) });
  } catch (error) {
    return sendRouteError(res, error);
  }
});

router.patch(
  "/admin/:id/enabled",
  idolAdminLimiter,
  requireAdmin,
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (!requireDatabase(res)) return;
    if (!/^\d+$/.test(req.params.id) || typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        code: "INVALID_REQUEST",
        message: "Trạng thái idol không hợp lệ.",
      });
    }

    try {
      await ensureSchema();
      const rows = await sql`
        UPDATE locket_idols
        SET enabled = ${req.body.enabled}, updated_at = NOW()
        WHERE id = ${req.params.id}
        RETURNING id, uid, username, display_name, avatar_url, locket_url,
                  country_code, enabled, sort_order, created_at, updated_at
      `;
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: "IDOL_NOT_FOUND",
          message: "Không tìm thấy idol.",
        });
      }
      return res.status(200).json({ success: true, data: mapIdol(rows[0]) });
    } catch (error) {
      return sendRouteError(res, error);
    }
  },
);

router.delete("/admin/:id", idolAdminLimiter, requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!requireDatabase(res)) return;
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ID",
      message: "Idol không hợp lệ.",
    });
  }

  try {
    await ensureSchema();
    const rows = await sql`
      DELETE FROM locket_idols WHERE id = ${req.params.id} RETURNING id
    `;
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "IDOL_NOT_FOUND",
        message: "Không tìm thấy idol.",
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendRouteError(res, error);
  }
});

module.exports = router;
