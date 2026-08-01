const { neon } = require("@neondatabase/serverless");

function getDatabaseUrl() {
  return [process.env.DATABASE_URL, process.env.NEON_DATABASE_URL]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim() || null;
}

const databaseUrl = getDatabaseUrl();
const sql = databaseUrl ? neon(databaseUrl) : null;

let tableCreated = false;
async function ensureTable() {
  if (!sql || tableCreated) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS web_users (
        uid TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT,
        username TEXT,
        profile_picture TEXT,
        provider TEXT DEFAULT 'Locket Official',
        disabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_sign_in_at TIMESTAMPTZ DEFAULT NOW(),
        ip_address TEXT,
        browser TEXT,
        os TEXT
      );
    `;
    tableCreated = true;
  } catch (err) {
    console.error("⚠️ [userTracker] Failed to create web_users table:", err.message);
  }
}

/**
 * Tracks or updates user in PostgreSQL database when they interact with Huy Locket
 */
async function trackWebUser(userData, req = null) {
  if (!sql || !userData) return;
  try {
    await ensureTable();
    const uid = String(userData.uid || userData.localId || "").trim();
    if (!uid) return;

    const email = String(userData.email || "").trim().toLowerCase() || null;
    const displayName = String(userData.displayName || userData.username || userData.firstName || "").trim() || "Người dùng Locket";
    const username = String(userData.username || "").trim() || null;
    const profilePicture = String(userData.profilePicture || "").trim() || null;

    let ipAddress = null;
    let browser = "App / Web";
    let os = "iOS / Android / Desktop";

    if (req && req.headers) {
      ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null;
      if (ipAddress && typeof ipAddress === "string") {
        ipAddress = ipAddress.split(",")[0].trim();
      }
      const ua = String(req.headers["user-agent"] || "");
      if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
      else if (ua.includes("Firefox")) browser = "Firefox";

      if (ua.includes("Windows")) os = "Windows";
      else if (ua.includes("Mac OS")) os = "macOS";
      else if (ua.includes("Android")) os = "Android";
      else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    }

    await sql`
      INSERT INTO web_users (uid, email, display_name, username, profile_picture, provider, last_sign_in_at, ip_address, browser, os)
      VALUES (${uid}, ${email}, ${displayName}, ${username}, ${profilePicture}, 'Locket', NOW(), ${ipAddress}, ${browser}, ${os})
      ON CONFLICT (uid) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, web_users.email),
        display_name = CASE WHEN EXCLUDED.display_name = 'Người dùng Locket' THEN web_users.display_name ELSE COALESCE(EXCLUDED.display_name, web_users.display_name) END,
        username = COALESCE(EXCLUDED.username, web_users.username),
        profile_picture = COALESCE(EXCLUDED.profile_picture, web_users.profile_picture),
        last_sign_in_at = NOW(),
        ip_address = COALESCE(EXCLUDED.ip_address, web_users.ip_address),
        browser = COALESCE(EXCLUDED.browser, web_users.browser),
        os = COALESCE(EXCLUDED.os, web_users.os);
    `;
  } catch (err) {
    console.error("⚠️ [userTracker] Error tracking web user:", err.message);
  }
}

async function getWebUsers(search = "") {
  if (!sql) return [];
  try {
    await ensureTable();
    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      return await sql`
        SELECT * FROM web_users
        WHERE LOWER(email) LIKE ${s} OR LOWER(display_name) LIKE ${s} OR LOWER(username) LIKE ${s} OR LOWER(uid) LIKE ${s}
        ORDER BY last_sign_in_at DESC
        LIMIT 100;
      `;
    }
    return await sql`
      SELECT * FROM web_users
      ORDER BY last_sign_in_at DESC
      LIMIT 100;
    `;
  } catch (err) {
    console.error("⚠️ [userTracker] Error querying web users:", err.message);
    return [];
  }
}

async function updateWebUserLock(uid, disabled) {
  if (!sql || !uid) return;
  try {
    await ensureTable();
    await sql`
      UPDATE web_users SET disabled = ${Boolean(disabled)} WHERE uid = ${uid};
    `;
  } catch (err) {
    console.error("⚠️ [userTracker] Error updating lock status:", err.message);
  }
}

async function isWebUserDisabled(uid) {
  if (!sql || !uid) return false;
  try {
    await ensureTable();
    const rows = await sql`SELECT disabled FROM web_users WHERE uid = ${uid} LIMIT 1;`;
    return rows.length > 0 && rows[0].disabled === true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  sql,
  trackWebUser,
  getWebUsers,
  updateWebUserLock,
  isWebUserDisabled,
};
