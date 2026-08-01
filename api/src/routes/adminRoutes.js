const express = require("express");
const rateLimit = require("express-rate-limit");
const { neon } = require("@neondatabase/serverless");
const {
  ADMIN_FIREBASE_PROJECT_ID,
  getAdminAuth,
  getInitializationError,
} = require("../services/adminFirebase");

const router = express.Router();

function getDatabaseUrl() {
  return [process.env.DATABASE_URL, process.env.NEON_DATABASE_URL]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim() || null;
}

const databaseUrl = getDatabaseUrl();
const sql = databaseUrl ? neon(databaseUrl) : null;

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many admin sign-in attempts" },
});

function getAdminWebApiKey() {
  const value = process.env.ADMIN_FIREBASE_WEB_API_KEY;
  return typeof value === "string" ? value.trim() : "";
}

async function parseFirebaseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Firebase Authentication request failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}

router.post("/session/login", adminLoginLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const apiKey = getAdminWebApiKey();

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required" });
  }
  if (!apiKey) {
    return res.status(503).json({ success: false, error: "Admin authentication is not configured" });
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const session = await parseFirebaseResponse(response);
    return res.status(200).json({
      success: true,
      idToken: session.idToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      email: session.email,
      projectId: ADMIN_FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    const status = error.status === 400 ? 401 : 502;
    return res.status(status).json({ success: false, error: "Admin sign-in failed" });
  }
});

router.post("/session/refresh", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  const apiKey = getAdminWebApiKey();
  if (!refreshToken || !apiKey) {
    return res.status(400).json({ success: false, error: "Invalid refresh request" });
  }

  try {
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
      },
    );
    const session = await parseFirebaseResponse(response);
    return res.status(200).json({
      success: true,
      idToken: session.id_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      projectId: ADMIN_FIREBASE_PROJECT_ID,
    });
  } catch {
    return res.status(401).json({ success: false, error: "Admin session expired" });
  }
});

async function requireAdmin(req, res, next) {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    const initializationError = getInitializationError();
    if (initializationError) {
      console.error("Admin Firebase unavailable:", initializationError.message);
    }
    return res.status(503).json({ success: false, error: "Admin authentication is unavailable" });
  }

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(authorization.slice(7), true);
    if (decodedToken.admin !== true) {
      return res.status(403).json({ success: false, error: "Admin permission required" });
    }
    req.adminAuth = adminAuth;
    req.adminUid = decodedToken.uid;
    req.adminEmail = decodedToken.email || null;
    return next();
  } catch {
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

    await auditLog(req.adminUid, "LIST_USERS", null, "Listed admin identities");
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
    await req.adminAuth.deleteUser(targetUid);
    await auditLog(req.adminUid, "DELETE_AUTH", targetUid, "Admin identity deleted");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to delete admin identity:", error.message);
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
    await req.adminAuth.updateUser(targetUid, { disabled: true });
    await req.adminAuth.revokeRefreshTokens(targetUid);
    await auditLog(req.adminUid, "LOCK_USER", targetUid, "Admin identity locked");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to lock admin identity:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/users/:uid/unlock", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const targetUid = req.params.uid;
  if (!targetUid) return res.status(400).json({ success: false, error: "Bad Request" });
  try {
    await req.adminAuth.updateUser(targetUid, { disabled: false });
    await auditLog(req.adminUid, "UNLOCK_USER", targetUid, "Admin identity unlocked");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to unlock admin identity:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
