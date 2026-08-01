const express = require("express");
const rateLimit = require("express-rate-limit");
const { getLocketAuthVerifier } = require("../services/locketAdminVerifier");
const { getUserInfoV2 } = require("../services/AuthSecurity/GetInfoUser");
const {
  getLoginRequestContext,
  getRequestContext,
} = require("../services/userActivityContext");
const {
  endSession,
  hasActivityDatabase,
  heartbeatSession,
  normalizeIdentity,
  upsertSession,
} = require("../services/userActivityStore");

const router = express.Router();
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const activityLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "RATE_LIMITED", error: "Too many activity requests" },
});

async function requireVerifiedLocketUser(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED", error: "Unauthorized" });
  }
  try {
    req.verifiedLocketUser = await getLocketAuthVerifier().verifyIdToken(
      authorization.slice(7),
      false,
    );
    return next();
  } catch (error) {
    console.warn("User activity token verification failed:", error?.code || error?.name || "unknown");
    return res.status(401).json({ success: false, code: "UNAUTHORIZED", error: "Unauthorized" });
  }
}

function requireDatabase(_req, res, next) {
  if (!hasActivityDatabase()) {
    return res.status(503).json({
      success: false,
      code: "DATABASE_NOT_CONFIGURED",
      error: "User activity database is not configured",
    });
  }
  return next();
}

function getSessionId(req, res) {
  const sessionId = String(req.body?.sessionId || "").trim();
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    res.status(400).json({ success: false, code: "INVALID_SESSION_ID", error: "Invalid session identifier" });
    return null;
  }
  return sessionId;
}

router.use(activityLimiter, requireVerifiedLocketUser, requireDatabase);

router.post("/session", async (req, res) => {
  const sessionId = getSessionId(req, res);
  if (!sessionId) return;
  const eventType = req.body?.eventType === "login" ? "login" : "resume";
  try {
    const idToken = req.headers.authorization.slice(7);
    let verifiedProfile = null;
    try {
      verifiedProfile = await getUserInfoV2(
        idToken,
        req.verifiedLocketUser.uid || req.verifiedLocketUser.user_id,
      );
    } catch (profileErr) {
      console.warn("[activity] profile fetch fallback:", profileErr.message || profileErr);
    }
    const identity = normalizeIdentity(req.verifiedLocketUser, verifiedProfile);
    const context = await getLoginRequestContext(req);
    const result = await upsertSession({
      identity,
      sessionId,
      eventType,
      loginMethod: req.body?.loginMethod,
      context,
      build: req.body?.build,
    });
    return res.status(200).json({ success: true, accountStatus: result.accountStatus });
  } catch (error) {
    if (error.code === "ACCOUNT_LOCKED") {
      return res.status(403).json({ success: false, code: "ACCOUNT_LOCKED", error: "Website account is locked" });
    }
    console.error("User activity session write failed:", error?.code || error?.name || "unknown");
    return res.status(500).json({ success: false, code: "ACTIVITY_WRITE_FAILED", error: "Unable to record user activity" });
  }
});

router.post("/heartbeat", async (req, res) => {
  const sessionId = getSessionId(req, res);
  if (!sessionId) return;
  try {
    const identity = normalizeIdentity(req.verifiedLocketUser);
    await heartbeatSession({
      uid: identity.uid,
      sessionId,
      webSource: getRequestContext(req).webSource,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("User activity heartbeat failed:", error?.code || error?.name || "unknown");
    return res.status(500).json({ success: false, code: "HEARTBEAT_FAILED", error: "Unable to update activity" });
  }
});

router.post("/logout", async (req, res) => {
  const sessionId = getSessionId(req, res);
  if (!sessionId) return;
  try {
    const identity = normalizeIdentity(req.verifiedLocketUser);
    await endSession({ uid: identity.uid, sessionId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("User activity logout failed:", error?.code || error?.name || "unknown");
    return res.status(500).json({ success: false, code: "LOGOUT_WRITE_FAILED", error: "Unable to close activity session" });
  }
});

module.exports = router;
