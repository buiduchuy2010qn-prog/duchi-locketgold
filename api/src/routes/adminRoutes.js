const express = require("express");
const { neon } = require("@neondatabase/serverless");
const {
  ADMIN_FIREBASE_PROJECT_ID,
  getAdminAuth,
  getInitializationError,
} = require("../services/adminFirebase");
const {
  getAdminLocketEmails,
  getAdminLocketUids,
  getLocketAuthVerifier,
} = require("../services/locketAdminVerifier");
const { getWebUsers, updateWebUserLock } = require("../services/userTracker");

const router = express.Router();

function getDatabaseUrl() {
  return [process.env.DATABASE_URL, process.env.NEON_DATABASE_URL]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim() || null;
}

const databaseUrl = getDatabaseUrl();
const sql = databaseUrl ? neon(databaseUrl) : null;

async function requireAdmin(req, res, next) {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    const initializationError = getInitializationError();
    if (initializationError) {
      console.error("Admin Firebase unavailable:", initializationError.message);
    }
    return res.status(503).json({ success: false, error: "Admin authentication is unavailable" });
  }

  const allowedUids = getAdminLocketUids();
  const allowedEmails = getAdminLocketEmails();
  if (allowedUids.size === 0 && allowedEmails.size === 0) {
    return res.status(503).json({ success: false, error: "Admin allowlist is unavailable" });
  }

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const decodedToken = await getLocketAuthVerifier().verifyIdToken(
      authorization.slice(7),
      false,
    );
    const tokenEmail = String(decodedToken.email || "").trim().toLowerCase();
    if (!allowedUids.has(decodedToken.uid) && !allowedEmails.has(tokenEmail)) {
      return res.status(403).json({ success: false, error: "Admin permission required" });
    }
    req.adminAuth = adminAuth;
    req.adminUid = decodedToken.uid;
    req.adminEmail = decodedToken.email || null;
    return next();
  } catch (error) {
    console.warn("Admin Locket token verification failed:", error?.code || error?.name || "unknown");
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
}

async function auditLog(adminUid, action, targetUid, details) {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO admin_audit_log (admin_uid, action, target_uid, details)
      VALUES (${adminUid}, ${action}, ${targetUid}, ${details});
    `;
  } catch (error) {
    console.error("Failed to write admin audit log:", error.message);
  }
}

router.get("/verify", requireAdmin, (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({
    success: true,
    email: req.adminEmail,
    isAdmin: true,
    projectId: ADMIN_FIREBASE_PROJECT_ID,
  });
});

router.get("/users", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const maxResults = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50;
    const pageToken = req.query.pageToken || undefined;
    const search = String(req.query.search || "").trim().toLowerCase();
    const listUsersResult = await req.adminAuth.listUsers(maxResults, pageToken);

    let users = listUsersResult.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      disabled: user.disabled,
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
      provider: user.providerData[0]?.providerId || "custom",
      isAdmin: user.customClaims?.admin === true,
    }));

    if (search) {
      users = users.filter((user) =>
        user.email?.toLowerCase().includes(search)
        || user.displayName?.toLowerCase().includes(search)
        || user.uid.toLowerCase().includes(search));
    }

    const uids = users.map((user) => user.uid);
    let loginData = [];
    if (sql && uids.length > 0) {
      try {
        loginData = await sql`
          SELECT DISTINCT ON (uid) uid, ip_address, country, city, browser, os, device, created_at
          FROM login_history
          WHERE uid = ANY(${uids})
          ORDER BY uid, created_at DESC
        `;
      } catch (error) {
        console.error("Admin login history query failed:", error.message);
      }
    }

    const historyByUid = Object.fromEntries(loginData.map((entry) => [entry.uid, entry]));
    users = users.map((user) => ({
      ...user,
      latestLoginData: historyByUid[user.uid] || null,
    }));

    // Pull real web users tracked in PostgreSQL DB and merge them with Firebase Admin accounts
    const webUsers = await getWebUsers(search);
    const webUserMapped = webUsers.map((u) => ({
      uid: u.uid,
      email: u.email || null,
      displayName: u.display_name || u.username || "Người dùng Locket",
      photoURL: u.profile_picture || null,
      disabled: u.disabled === true,
      creationTime: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
      lastSignInTime: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : new Date().toISOString(),
      provider: u.provider || "Locket Official",
      isAdmin: (u.email && u.email.toLowerCase() === "buiduchuy2010qn@gmail.com") || getAdminLocketUids().has(u.uid) || getAdminLocketEmails().has((u.email || "").toLowerCase()),
      latestLoginData: {
        created_at: u.last_sign_in_at || u.created_at || new Date().toISOString(),
        os: u.os || "Desktop / App",
        browser: u.browser || "App / Web",
        ip_address: u.ip_address || "N/A",
      },
    }));

    const userMap = new Map();
    for (const u of users) {
      userMap.set(u.uid, u);
    }
    for (const u of webUserMapped) {
      if (userMap.has(u.uid)) {
        const existing = userMap.get(u.uid);
        userMap.set(u.uid, {
          ...existing,
          displayName: u.displayName !== "Người dùng Locket" ? u.displayName : existing.displayName,
          latestLoginData: u.latestLoginData || existing.latestLoginData,
          isAdmin: existing.isAdmin || u.isAdmin,
        });
      } else {
        userMap.set(u.uid, u);
      }
    }
    users = Array.from(userMap.values());

    await auditLog(req.adminUid, "LIST_USERS", null, "Listed admin identities and web users");
    return res.status(200).json({
      success: true,
      users,
      pageToken: listUsersResult.pageToken,
      projectId: ADMIN_FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    console.error("Failed to list admin identities:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.delete("/users/:uid/auth", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const targetUid = req.params.uid;
  if (!targetUid) return res.status(400).json({ success: false, error: "Bad Request" });
  if (req.adminUid === targetUid) {
    return res.status(403).json({ success: false, error: "Cannot delete yourself" });
  }
  try {
    try {
      await req.adminAuth.deleteUser(targetUid);
    } catch {
      // Ignore if user is only in web_users database
    }
    if (sql) {
      try { await sql`DELETE FROM web_users WHERE uid = ${targetUid}`; } catch {}
    }
    await auditLog(req.adminUid, "DELETE_AUTH", targetUid, "User account deleted");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to delete user account:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/users/:uid/lock", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const targetUid = req.params.uid;
  if (!targetUid) return res.status(400).json({ success: false, error: "Bad Request" });
  if (req.adminUid === targetUid) {
    return res.status(403).json({ success: false, error: "Cannot lock yourself" });
  }
  try {
    try {
      await req.adminAuth.updateUser(targetUid, { disabled: true });
      await req.adminAuth.revokeRefreshTokens(targetUid);
    } catch {
      // Ignore if user is only in web_users database
    }
    await updateWebUserLock(targetUid, true);
    await auditLog(req.adminUid, "LOCK_USER", targetUid, "User account locked");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to lock user account:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/users/:uid/unlock", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const targetUid = req.params.uid;
  if (!targetUid) return res.status(400).json({ success: false, error: "Bad Request" });
  try {
    try {
      await req.adminAuth.updateUser(targetUid, { disabled: false });
    } catch {
      // Ignore if user is only in web_users database
    }
    await updateWebUserLock(targetUid, false);
    await auditLog(req.adminUid, "UNLOCK_USER", targetUid, "User account unlocked");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to unlock user account:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
