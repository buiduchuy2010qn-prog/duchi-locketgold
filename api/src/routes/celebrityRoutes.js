const express = require("express");
const { neon } = require("@neondatabase/serverless");
const { verifyIdToken } = require("../middlewares/Auth");
const { celebrityReadLimiter } = require("../middlewares/rateLimit");

const router = express.Router();

function getDatabaseUrl() {
  const candidates = [process.env.DATABASE_URL, process.env.NEON_DATABASE_URL];
  return candidates.find((value) => value?.trim())?.trim() || null;
}

const databaseUrl = getDatabaseUrl();
const sql = databaseUrl ? neon(databaseUrl) : null;

function mapCelebrity(row) {
  return {
    id: String(row.id),
    uid: row.uid,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || null,
    locketUrl: row.locket_url,
    countryCode: String(row.country_code || "OTHER").trim().toUpperCase(),
  };
}

router.get("/", celebrityReadLimiter, verifyIdToken, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (!sql) {
    return res.status(503).json({
      success: false,
      code: "DATABASE_UNAVAILABLE",
      message: "Cơ sở dữ liệu Celebrity chưa được cấu hình.",
    });
  }

  try {
    const rows = await sql`
      SELECT id, uid, username, display_name, avatar_url, locket_url,
             country_code
      FROM celebrity_profiles
      WHERE enabled = TRUE
      ORDER BY sort_order ASC, display_name ASC, id ASC
    `;

    return res.status(200).json({
      success: true,
      data: rows.map(mapCelebrity),
    });
  } catch (error) {
    const schemaMissing = error?.code === "42P01";
    console.error("[celebrity] catalog query failed", {
      code: error?.code || null,
      name: error?.name || "Error",
    });

    return res.status(schemaMissing ? 503 : 500).json({
      success: false,
      code: schemaMissing
        ? "CELEBRITY_SCHEMA_MISSING"
        : "CELEBRITY_QUERY_FAILED",
      message: schemaMissing
        ? "Dữ liệu Celebrity chưa được khởi tạo."
        : "Không thể tải dữ liệu Celebrity.",
    });
  }
});

module.exports = router;
