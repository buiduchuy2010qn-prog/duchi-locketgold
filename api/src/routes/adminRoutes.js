const express = require("express");
const {
  ADMIN_FIREBASE_PROJECT_ID,
  getAdminAuth,
} = require("../services/adminFirebase");
const {
  getAdminLocketEmails,
  getAdminLocketUids,
  getLocketAuthVerifier,
} = require("../services/locketAdminVerifier");
const {
  clearLoginHistory,
  getLoginHistory,
  getWebUser,
  hasActivityDatabase,
  listWebUsers,
  setAccountStatus,
  writeAudit,
} = require("../services/userActivityStore");

const router = express.Router();

async function requireAdmin(req, res, next) {
  const allowedUids = getAdminLocketUids();
  const allowedEmails = getAdminLocketEmails();
  if (allowedUids.size === 0 && allowedEmails.size === 0) {
    return res.status(503).json({
      success: false,
      code: "ADMIN_ALLOWLIST_NOT_CONFIGURED",
      error: "Admin allowlist is unavailable",
    });
  }

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED", error: "Unauthorized" });
  }

  try {
    const decodedToken = await getLocketAuthVerifier().verifyIdToken(
      authorization.slice(7),
      false,
    );
    const tokenEmail = String(decodedToken.email || "").trim().toLowerCase();
    if (!allowedUids.has(decodedToken.uid) && !allowedEmails.has(tokenEmail)) {
      return res.status(403).json({
        success: false,
        code: "ADMIN_PERMISSION_REQUIRED",
        error: "Admin permission required",
      });
    }
    req.adminUid = decodedToken.uid;
    req.adminEmail = decodedToken.email || null;
    return next();
  } catch (error) {
    console.warn("Admin Locket token verification failed:", error?.code || error?.name || "unknown");
    return res.status(401).json({ success: false, code: "UNAUTHORIZED", error: "Unauthorized" });
  }
}

function requireActivityDatabase(_req, res, next) {
  if (!hasActivityDatabase()) {
    return res.status(503).json({
      success: false,
      code: "DATABASE_NOT_CONFIGURED",
      error: "User activity database is not configured",
    });
  }
  return next();
}

function isAdminIdentity(uid, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return getAdminLocketUids().has(uid) || getAdminLocketEmails().has(normalizedEmail);
}

async function isProtectedAdmin(uid) {
  if (getAdminLocketUids().has(uid)) return true;
  const user = await getWebUser(uid);
  return Boolean(user && isAdminIdentity(user.uid, user.email));
}

async function audit(adminUid, action, targetUid, details) {
  try {
    await writeAudit({ adminUid, action, targetUid, details });
  } catch (error) {
    console.error("Admin audit write failed:", error?.code || error?.name || "unknown");
  }
}

router.use(requireAdmin);

router.get("/verify", (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({
    success: true,
    email: req.adminEmail,
    isAdmin: true,
    projectId: ADMIN_FIREBASE_PROJECT_ID,
    activityDatabaseConfigured: hasActivityDatabase(),
  });
});

router.get("/users", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50;
    const requestedOffset = Number.parseInt(req.query.pageToken, 10);
    const offset = Number.isFinite(requestedOffset) && requestedOffset >= 0
      ? requestedOffset
      : 0;
    const search = String(req.query.search || "").trim();
    const result = await listWebUsers({ search, limit, offset });
    const users = result.users.map((user) => ({
      uid: user.uid,
      internalId: user.internal_id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      photoURL: user.profile_picture,
      provider: user.auth_provider,
      loginMethod: user.login_method,
      accountStatus: user.account_status,
      disabled: user.account_status === "locked",
      creationTime: user.created_at,
      lastSignInTime: user.last_login_at,
      lastSeenAt: user.last_seen_at,
      lastLogoutAt: user.last_logout_at,
      webSource: user.current_web_source || "unknown",
      activeSessions: user.active_sessions,
      isAdmin: isAdminIdentity(user.uid, user.email),
      latestLoginData: user.latest_login_event_at ? {
        created_at: user.latest_login_event_at,
        ended_at: user.latest_session_ended_at,
        ip_address: user.ip_address,
        country: user.country,
        region: user.region,
        city: user.city,
        browser: user.browser,
        browser_version: user.browser_version,
        os: user.os,
        device: user.device,
        login_method: user.latest_login_method,
        web_source: user.latest_web_source,
        web_version: user.web_version,
        build_id: user.build_id,
        commit_hash: user.commit_hash,
      } : null,
    }));

    await audit(req.adminUid, "LIST_WEB_USERS", null, "Listed verified Huy Locket website users");
    return res.status(200).json({
      success: true,
      users,
      totalUsers: result.total,
      pageToken: result.nextOffset === null ? null : String(result.nextOffset),
      onlineWindowSeconds: result.onlineWindowSeconds,
      historyStartedAt: users.reduce((oldest, user) => {
        const value = user.latestLoginData?.created_at;
        return value && (!oldest || new Date(value) < new Date(oldest)) ? value : oldest;
      }, null),
    });
  } catch (error) {
    console.error("Failed to list website users:", error?.code || error?.name || "unknown");
    return res.status(500).json({
      success: false,
      code: "USER_REGISTRY_QUERY_FAILED",
      error: "Unable to load website users",
    });
  }
});

router.get("/users/:uid/login-history", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 200)
      : 100;
    const history = await getLoginHistory(req.params.uid, limit);
    await audit(req.adminUid, "VIEW_LOGIN_HISTORY", req.params.uid, "Viewed website login history");
    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("Failed to load login history:", error?.code || error?.name || "unknown");
    return res.status(500).json({
      success: false,
      code: "LOGIN_HISTORY_QUERY_FAILED",
      error: "Unable to load login history",
    });
  }
});

router.delete("/users/:uid/login-history", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const deleted = await clearLoginHistory(req.params.uid);
    await audit(req.adminUid, "DELETE_LOGIN_HISTORY", req.params.uid, `Deleted ${deleted} login events`);
    return res.status(200).json({ success: true, deleted });
  } catch (error) {
    console.error("Failed to delete login history:", error?.code || error?.name || "unknown");
    return res.status(500).json({
      success: false,
      code: "LOGIN_HISTORY_DELETE_FAILED",
      error: "Unable to delete login history",
    });
  }
});

router.post("/users/:uid/lock", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    if (await isProtectedAdmin(req.params.uid)) {
      return res.status(403).json({
        success: false,
        code: "PROTECTED_ADMIN",
        error: "Cannot lock the protected admin account",
      });
    }
    const updated = await setAccountStatus(req.params.uid, "locked");
    if (!updated) return res.status(404).json({ success: false, code: "USER_NOT_FOUND", error: "User not found" });
    await audit(req.adminUid, "LOCK_WEB_USER", req.params.uid, "Locked Huy Locket website registry account");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to lock website user:", error?.code || error?.name || "unknown");
    return res.status(500).json({ success: false, code: "LOCK_FAILED", error: "Unable to lock user" });
  }
});

router.post("/users/:uid/unlock", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const updated = await setAccountStatus(req.params.uid, "active");
    if (!updated) return res.status(404).json({ success: false, code: "USER_NOT_FOUND", error: "User not found" });
    await audit(req.adminUid, "UNLOCK_WEB_USER", req.params.uid, "Unlocked Huy Locket website registry account");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to unlock website user:", error?.code || error?.name || "unknown");
    return res.status(500).json({ success: false, code: "UNLOCK_FAILED", error: "Unable to unlock user" });
  }
});

router.delete("/users/:uid/auth", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (await isProtectedAdmin(req.params.uid)) {
    return res.status(403).json({ success: false, code: "PROTECTED_ADMIN", error: "Cannot delete the protected admin account" });
  }
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return res.status(503).json({ success: false, code: "ADMIN_FIREBASE_UNAVAILABLE", error: "Admin Firebase is unavailable" });
  }
  try {
    await adminAuth.getUser(req.params.uid);
    await adminAuth.deleteUser(req.params.uid);
    await audit(req.adminUid, "DELETE_ADMIN_IDENTITY", req.params.uid, "Deleted Huy Locket admin Firebase identity");
    return res.status(200).json({ success: true });
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      return res.status(409).json({
        success: false,
        code: "OFFICIAL_LOCKET_ACCOUNT",
        error: "Official Locket accounts cannot be deleted from Huy Locket",
      });
    }
    console.error("Failed to delete admin identity:", error?.code || error?.name || "unknown");
    return res.status(500).json({ success: false, code: "DELETE_FAILED", error: "Unable to delete admin identity" });
  }
});

module.exports = router;
