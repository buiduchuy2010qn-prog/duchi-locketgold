const express = require("express");
const crypto = require("node:crypto");
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
  addIpBlacklist,
  checkAdminPinSet,
  clearLoginHistory,
  createAdminSession,
  getGlobalBroadcast,
  getLoginHistory,
  getServerHealthStats,
  getUserPasswordRecoveryStatus,
  getUserRole,
  getWebUser,
  hasActivityDatabase,
  listAuditLogs,
  listBlacklistedIps,
  listReportedContent,
  listWebUsers,
  nukeUserPermanently,
  purgeBotUsers,
  removeIpBlacklist,
  resolveReport,
  revokeUserSessions,
  setAccountStatus,
  setAdminPin,
  setGlobalBroadcast,
  listGlobalBroadcasts,
  toggleGlobalBroadcast,
  deleteGlobalBroadcast,
  setUserRole,
  verifyAdminPin,
  verifyAdminSessionToken,
  writeAudit,
  healIpLocationInDb,
} = require("../services/userActivityStore");
const { getRequestContext, lookupPublicIpLocation } = require("../services/userActivityContext");

const router = express.Router();

async function requireAdmin(req, res, next) {
  const allowedUids = getAdminLocketUids();
  const allowedEmails = getAdminLocketEmails();

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
    
    let role = "user";
    if (hasActivityDatabase()) {
      role = await getUserRole(decodedToken.uid, tokenEmail);
    } else if (allowedUids.has(decodedToken.uid) || allowedEmails.has(tokenEmail)) {
      role = "super_admin";
    }

    if (role === "user" && !allowedUids.has(decodedToken.uid) && !allowedEmails.has(tokenEmail)) {
      return res.status(403).json({
        success: false,
        code: "ADMIN_PERMISSION_REQUIRED",
        error: "Admin permission required",
      });
    }

    if (role === "user") role = "super_admin"; // fallback for bootstrap allowlist

    req.adminUid = decodedToken.uid;
    req.adminEmail = decodedToken.email || null;
    req.adminRole = role;
    req.authTime = decodedToken.auth_time || Math.floor(Date.now() / 1000);
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

async function requireActiveAdminSession(req, res, next) {
  // Check short-term token first (30-minute window)
  const sessionToken = req.headers["x-admin-session"];
  if (sessionToken && typeof sessionToken === "string") {
    const hash = crypto.createHash("sha256").update(sessionToken).digest("hex");
    const isValid = await verifyAdminSessionToken(req.adminUid, hash, 30);
    if (isValid) return next();
  }
  
  // Or check if token auth_time is very fresh (< 30 mins)
  const now = Math.floor(Date.now() / 1000);
  if (now - (req.authTime || 0) < 1800) {
    return next();
  }

  return res.status(401).json({
    success: false,
    code: "ADMIN_SESSION_EXPIRED",
    error: "Phiên quản trị nhạy cảm đã hết hạn. Vui lòng xác minh lại mật khẩu.",
  });
}

function isAdminIdentity(uid, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return getAdminLocketUids().has(uid) || getAdminLocketEmails().has(normalizedEmail);
}

async function isProtectedAdmin(uid) {
  if (getAdminLocketUids().has(uid)) return true;
  const user = await getWebUser(uid);
  if (user && isAdminIdentity(user.uid, user.email)) return true;
  if (hasActivityDatabase()) {
    const role = await getUserRole(uid, user?.email);
    return role === "super_admin";
  }
  return false;
}

async function audit(req, action, targetUid, details, status = "success") {
  try {
    const ctx = getRequestContext(req);
    await writeAudit({
      adminUid: req.adminUid,
      role: req.adminRole || "unknown",
      action,
      targetUid,
      details,
      ipAddress: ctx.ipAddress,
      webSource: ctx.webSource,
      status,
    });
  } catch (error) {
    console.error("Admin audit write failed:", error?.code || error?.name || "unknown");
  }
}

router.use(requireAdmin);

router.get("/verify", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  let hasPin = false;
  if (hasActivityDatabase()) {
    try {
      hasPin = await checkAdminPinSet(req.adminUid);
    } catch (e) {
      console.warn("Failed to check admin PIN status:", e.message);
    }
  }
  return res.status(200).json({
    success: true,
    email: req.adminEmail,
    uid: req.adminUid,
    role: req.adminRole,
    isAdmin: true,
    hasPin,
    projectId: ADMIN_FIREBASE_PROJECT_ID,
    activityDatabaseConfigured: hasActivityDatabase(),
  });
});

router.post("/session/create", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const { pin } = req.body || {};
    if (!pin || typeof pin !== "string" || !/^\d{4,8}$/.test(pin.trim())) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PIN_FORMAT",
        error: "Mã PIN bảo mật phải là dãy số gồm từ 4 đến 8 chữ số.",
      });
    }
    const pinStr = pin.trim();
    const alreadySet = await checkAdminPinSet(req.adminUid);
    if (!alreadySet) {
      await setAdminPin(req.adminUid, pinStr, req.adminRole);
      await audit(req, "SETUP_ADMIN_PIN", req.adminUid, "First time admin PIN set");
    } else {
      const isCorrect = await verifyAdminPin(req.adminUid, pinStr);
      if (!isCorrect) {
        await audit(req, "FAILED_ADMIN_PIN", req.adminUid, "Failed PIN verification", "failure");
        return res.status(401).json({
          success: false,
          code: "INVALID_ADMIN_PIN",
          error: "Mã PIN bảo mật không chính xác. Vui lòng thử lại!",
        });
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    await createAdminSession(req.adminUid, hash, 30);
    await audit(req, "CREATE_ADMIN_SESSION", req.adminUid, "Started 30-minute privileged admin session via PIN");
    return res.status(200).json({
      success: true,
      adminSessionToken: token,
      expiresAt: Date.now() + 30 * 60 * 1000,
      role: req.adminRole,
    });
  } catch (error) {
    console.error("Failed to create admin session:", error?.message || "unknown");
    return res.status(500).json({ success: false, error: "Không thể tạo phiên quản trị" });
  }
});

router.post("/pin/change", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const { oldPin, newPin } = req.body || {};
    if (!oldPin || !newPin) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập đầy đủ mã PIN hiện tại và mới" });
    }
    if (!/^\d{4,8}$/.test(String(newPin).trim())) {
      return res.status(400).json({ success: false, error: "Mã PIN mới phải là dãy số gồm từ 4 đến 8 chữ số" });
    }
    const alreadySet = await checkAdminPinSet(req.adminUid);
    if (alreadySet) {
      const correct = await verifyAdminPin(req.adminUid, String(oldPin).trim());
      if (!correct) {
        return res.status(401).json({ success: false, error: "Mã PIN hiện tại không chính xác!" });
      }
    }
    await setAdminPin(req.adminUid, String(newPin).trim(), req.adminRole);
    await audit(req, "CHANGE_ADMIN_PIN", req.adminUid, "Changed admin numeric PIN");
    return res.status(200).json({ success: true, message: "Đổi mã PIN Quản Trị thành công!" });
  } catch (error) {
    console.error("Failed to change admin PIN:", error?.message || "unknown");
    return res.status(500).json({ success: false, error: "Lỗi hệ thống khi đổi mã PIN" });
  }
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
    const users = result.users.map((user) => {
      const userRole = user.role || "user";
      return {
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
        role: userRole,
        isAdmin: userRole === "super_admin" || userRole === "admin" || isAdminIdentity(user.uid, user.email),
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
      };
    });

    await Promise.all(users.map(async (u) => {
      const data = u.latestLoginData;
      if (data && data.ip_address && data.ip_address !== "Không xác định" && data.ip_address !== "Unknown") {
        if (!data.city || data.city === "Không xác định" || data.city === "Unknown" || !data.country || data.country === "Không xác định") {
          try {
            const loc = await lookupPublicIpLocation(data.ip_address);
            if (loc && (loc.city !== "Không xác định" || loc.country !== "Không xác định")) {
              data.city = loc.city;
              data.region = loc.region;
              data.country = loc.country;
              healIpLocationInDb(data.ip_address, loc).catch(() => {});
            }
          } catch { /* ignore geo error */ }
        }
      }
    }));

    if (req.query.live !== "1") {
      await audit(req, "LIST_WEB_USERS", null, "Listed verified Huy Locket website users");
    }
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

router.post("/users/purge-bots", requireActivityDatabase, requireActiveAdminSession, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin") {
    return res.status(403).json({ success: false, error: "Quyền hiện tại không được phép thực hiện thao tác càn quét bot" });
  }
  try {
    const result = await purgeBotUsers(req.adminUid);
    await audit(req, "PURGE_BOT_USERS", null, `Càn quét và khóa ${result.purgedCount} tài khoản Bot/Clone tự động`);
    return res.status(200).json({ success: true, count: result.purgedCount, purgedUsers: result.purgedUsers });
  } catch (error) {
    console.error("Failed to purge bot users:", error?.message || "unknown");
    return res.status(500).json({ success: false, code: "PURGE_BOTS_FAILED", error: `Không thể càn quét bot: ${error?.message || "Lỗi hệ thống"}` });
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
    await Promise.all(history.map(async (item) => {
      if (item.ip_address && item.ip_address !== "Không xác định" && item.ip_address !== "Unknown") {
        if (!item.city || item.city === "Không xác định" || item.city === "Unknown") {
          try {
            const loc = await lookupPublicIpLocation(item.ip_address);
            if (loc && (loc.city !== "Không xác định" || loc.country !== "Không xác định")) {
              item.city = loc.city;
              item.region = loc.region;
              item.country = loc.country;
              healIpLocationInDb(item.ip_address, loc).catch(() => {});
            }
          } catch { /* ignore */ }
        }
      }
    }));
    await audit(req, "VIEW_LOGIN_HISTORY", req.params.uid, "Viewed website login history");
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

router.delete("/users/:uid/login-history", requireActivityDatabase, requireActiveAdminSession, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin") {
    return res.status(403).json({ success: false, error: "Quyền Moderator hoặc Support không được xóa lịch sử" });
  }
  try {
    const deleted = await clearLoginHistory(req.params.uid);
    await audit(req, "DELETE_LOGIN_HISTORY", req.params.uid, `Deleted ${deleted} login events`);
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

router.post("/users/:uid/lock", requireActivityDatabase, requireActiveAdminSession, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin") {
    return res.status(403).json({ success: false, error: "Quyền hiện tại không được phép khóa tài khoản" });
  }
  if (req.params.uid === req.adminUid) {
    return res.status(403).json({ success: false, error: "Không được tự khóa tài khoản của chính mình" });
  }
  try {
    if (await isProtectedAdmin(req.params.uid)) {
      return res.status(403).json({
        success: false,
        code: "PROTECTED_ADMIN",
        error: "Cannot lock a protected Super Admin account",
      });
    }
    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, error: "Bắt buộc phải nhập lý do khi khóa tài khoản" });
    }
    const updated = await setAccountStatus(req.params.uid, "locked");
    if (!updated) return res.status(404).json({ success: false, code: "USER_NOT_FOUND", error: "User not found" });
    await audit(req, "LOCK_WEB_USER", req.params.uid, `Locked account. Reason: ${reason}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to lock website user:", error?.code || error?.name || "unknown");
    return res.status(500).json({ success: false, code: "LOCK_FAILED", error: "Unable to lock user" });
  }
});

router.post("/users/:uid/unlock", requireActivityDatabase, requireActiveAdminSession, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin") {
    return res.status(403).json({ success: false, error: "Quyền hiện tại không được phép mở khóa tài khoản" });
  }
  try {
    const reason = String(req.body?.reason || "Mở khóa bởi quản trị viên").trim();
    const updated = await setAccountStatus(req.params.uid, "active");
    if (!updated) return res.status(404).json({ success: false, code: "USER_NOT_FOUND", error: "User not found" });
    await audit(req, "UNLOCK_WEB_USER", req.params.uid, `Unlocked account. Reason: ${reason}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to unlock website user:", error?.code || error?.name || "unknown");
    return res.status(500).json({ success: false, code: "UNLOCK_FAILED", error: "Unable to unlock user" });
  }
});

router.post("/users/:uid/revoke-sessions", requireActivityDatabase, requireActiveAdminSession, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin") {
    return res.status(403).json({ success: false, error: "Quyền Moderator hoặc Support không được thu hồi phiên" });
  }
  if (req.params.uid === req.adminUid) {
    return res.status(403).json({ success: false, error: "Không được tự thu hồi phiên đang dùng của chính mình" });
  }
  try {
    if (req.adminRole === "admin" && (await isProtectedAdmin(req.params.uid))) {
      return res.status(403).json({ success: false, error: "Admin thường không được thu hồi phiên của Super Admin" });
    }
    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, error: "Bắt buộc nhập lý do khi thu hồi phiên làm việc" });
    }
    const count = await revokeUserSessions(req.params.uid);
    await audit(req, "REVOKE_SESSIONS", req.params.uid, `Revoked ${count} active web sessions. Reason: ${reason}`);
    return res.status(200).json({ success: true, revokedSessions: count });
  } catch (error) {
    console.error("Failed to revoke user sessions:", error?.message || "unknown");
    return res.status(500).json({ success: false, error: "Không thể thu hồi phiên của người dùng" });
  }
});

router.post("/users/:uid/role", requireActivityDatabase, requireActiveAdminSession, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin") {
    return res.status(403).json({ success: false, error: "Chỉ Super Admin mới được quyền gán hoặc thu hồi vai trò" });
  }
  try {
    const newRole = String(req.body?.role || "").trim().toLowerCase();
    const allowedRoles = ["super_admin", "admin", "moderator", "support", "user"];
    if (!allowedRoles.includes(newRole)) {
      return res.status(400).json({ success: false, error: "Vai trò không hợp lệ" });
    }
    if (await isProtectedAdmin(req.params.uid) || req.params.uid === req.adminUid) {
      return res.status(403).json({ success: false, error: "Tài khoản Super Admin tối thượng hoặc tài khoản của chính bạn được cố định, không thể tự thay đổi vai trò" });
    }
    const reason = String(req.body?.reason || "").trim();
    if (!reason && newRole !== "user") {
      return res.status(400).json({ success: false, error: "Bắt buộc nhập lý do khi thay đổi vai trò quản trị" });
    }
    await setUserRole(req.params.uid, newRole, req.adminUid);
    await audit(req, "ASSIGN_ROLE", req.params.uid, `Assigned role '${newRole}'. Reason: ${reason || "Revoked to standard user"}`);
    return res.status(200).json({ success: true, role: newRole });
  } catch (error) {
    console.error("Failed to assign role:", error?.message || "unknown");
    return res.status(500).json({ success: false, error: "Không thể gán vai trò người dùng" });
  }
});

router.get("/audit-logs", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin") {
    return res.status(403).json({ success: false, error: "Chỉ Super Admin hoặc Admin mới được xem Nhật ký quản trị" });
  }
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const action = String(req.query.action || "").trim();
    const adminUid = String(req.query.adminUid || "").trim();
    const result = await listAuditLogs({ action, adminUid, limit, offset });
    return res.status(200).json({ success: true, logs: result.logs, total: result.total });
  } catch (error) {
    console.error("Failed to list audit logs:", error?.message || "unknown");
    return res.status(500).json({ success: false, error: "Không thể tải nhật ký quản trị" });
  }
});

router.get("/content/reports", requireActivityDatabase, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole === "support") {
    return res.status(403).json({ success: false, error: "Quyền Support không được truy cập quản lý vi phạm" });
  }
  try {
    const status = String(req.query.status || "").trim();
    const reports = await listReportedContent({ status, limit: 100 });
    return res.status(200).json({ success: true, reports });
  } catch (error) {
    console.error("Failed to list reported content:", error?.message || "unknown");
    return res.status(500).json({ success: false, error: "Không thể tải danh sách báo cáo vi phạm" });
  }
});

router.post("/content/reports/:id/resolve", requireActivityDatabase, requireActiveAdminSession, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin" && req.adminRole !== "moderator") {
    return res.status(403).json({ success: false, error: "Quyền Support không được phép xử lý vi phạm" });
  }
  try {
    const actionTaken = String(req.body?.actionTaken || "dismissed").trim();
    const ok = await resolveReport({ id: req.params.id, actionTaken, resolvedBy: req.adminUid });
    if (!ok) return res.status(404).json({ success: false, error: "Báo cáo vi phạm không tồn tại" });
    await audit(req, "RESOLVE_REPORT", null, `Resolved report #${req.params.id} with action: ${actionTaken}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to resolve report:", error?.message || "unknown");
    return res.status(500).json({ success: false, error: "Không thể xử lý báo cáo vi phạm" });
  }
});

router.delete("/users/:uid/auth", requireActiveAdminSession, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin") {
    return res.status(403).json({ success: false, error: "Quyền Moderator hoặc Support không được xóa tài khoản" });
  }
  if (req.params.uid === req.adminUid) {
    return res.status(403).json({ success: false, error: "Không được tự xóa tài khoản của chính mình" });
  }
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
    await audit(req, "DELETE_ADMIN_IDENTITY", req.params.uid, "Deleted Huy Locket admin Firebase identity");
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

// 1. Quyền Phát Sóng Thông Báo
router.get("/broadcast", async (req, res) => {
  try {
    const data = await getGlobalBroadcast();
    const list = await listGlobalBroadcasts();
    res.json({ success: true, data, list });
  } catch (err) {
    res.json({ success: false, error: err?.message });
  }
});

router.post("/broadcast", requireActiveAdminSession, async (req, res) => {
  try {
    const { id, message, level, active, targetUser, action } = req.body || {};
    if (action === "toggle" && id) {
      const result = await toggleGlobalBroadcast(id, active);
      await audit(req, "TOGGLE_GLOBAL_BROADCAST", null, `Toggled broadcast #${id} to ${active ? "ACTIVE" : "OFF"}`);
      return res.json({ success: true, data: result });
    }
    if (action === "delete" && id) {
      const result = await deleteGlobalBroadcast(id);
      await audit(req, "DELETE_GLOBAL_BROADCAST", null, `Deleted broadcast #${id}`);
      return res.json({ success: true, data: result });
    }
    const result = await setGlobalBroadcast(message || "", level || "info", Boolean(active ?? true), targetUser || "ALL");
    if (!result || !result.success) {
      return res.status(500).json({ success: false, error: result?.error || "Không thể lưu vào CSDL" });
    }
    await audit(req, "SET_GLOBAL_BROADCAST", null, `Created global broadcast (${targetUser || "ALL"}): "${message}"`);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("POST /broadcast error:", err);
    res.status(500).json({ success: false, error: err?.message || "Lỗi xử lý máy chủ" });
  }
});

router.delete("/broadcast/:id", requireActiveAdminSession, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteGlobalBroadcast(id);
    await audit(req, "DELETE_GLOBAL_BROADCAST", null, `Deleted broadcast #${id}`);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 2. Quyền Khóa IP Vĩnh Viễn
router.get("/ip-blacklist", async (req, res) => {
  const list = await listBlacklistedIps();
  res.json({ success: true, count: list.length, list });
});

router.post("/ip-blacklist", requireActiveAdminSession, async (req, res) => {
  const { ip_address, reason } = req.body;
  if (!ip_address) return res.status(400).json({ success: false, error: "Thiếu IP address" });
  await addIpBlacklist(ip_address, reason || "Khóa từ Admin Panel", req.adminRole || "SUPER_ADMIN");
  await audit(req, "BAN_IP_ADDRESS", null, `Banned IP: ${ip_address} - Reason: ${reason || "Banned by Admin"}`);
  res.json({ success: true, message: `Đã cấm vĩnh viễn địa chỉ IP: ${ip_address}` });
});

router.delete("/ip-blacklist/:ip", requireActiveAdminSession, async (req, res) => {
  const ip = decodeURIComponent(req.params.ip);
  await removeIpBlacklist(ip);
  await audit(req, "UNBAN_IP_ADDRESS", null, `Unbanned IP: ${ip}`);
  res.json({ success: true, message: `Đã mở khóa IP: ${ip}` });
});

// 3. Quyền Xóa Khởi Tử Vĩnh Viễn Từng Tài Khoản (Nuke User)
router.delete("/users/:uid/nuke", requireActiveAdminSession, async (req, res) => {
  if (req.adminRole !== "super_admin" && req.adminRole !== "admin") {
    return res.status(403).json({ success: false, error: "Quyền Moderator hoặc Support không được nuke tài khoản" });
  }
  const targetUid = req.params.uid;
  if (targetUid === req.adminUid) {
    return res.status(403).json({ success: false, error: "Không thể xóa chính tài khoản Admin của mình" });
  }
  if (await isProtectedAdmin(targetUid)) {
    return res.status(403).json({ success: false, error: "Đây là tài khoản bảo vệ tối thượng (Protected Admin), không thể xóa!" });
  }
  await nukeUserPermanently(targetUid);
  await audit(req, "NUKE_USER_PERMANENTLY", targetUid, "Permanently deleted user and all login histories");
  res.json({ success: true, message: "Đã tiêu hủy vĩnh viễn toàn bộ hồ sơ và lịch sử tài khoản khỏi cơ sở dữ liệu Huy Locket!" });
});

// 4. Cảm Biến Giám Sát Tài Nguyên Máy Chủ
router.get("/server-health", async (req, res) => {
  const health = getServerHealthStats();
  res.json({ success: true, data: health });
});

// 5. Quyền Quản lý Khôi phục & Trạng thái Mật Khẩu (Password Status)
router.get("/users/:uid/password-status", async (req, res) => {
  const u = await getWebUser(req.params.uid);
  if (!u) return res.status(404).json({ success: false, error: "Không tìm thấy người dùng trong hệ thống Huy Locket" });
  const status = getUserPasswordRecoveryStatus(u.email);
  res.json({ success: true, data: { uid: u.uid, displayName: u.displayName || u.email, ...status } });
});

module.exports = router;

