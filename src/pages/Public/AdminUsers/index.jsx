import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Clock,
  FileText,
  Info,
  Key,
  Lock,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Unlock,
  Users,
  ArrowLeft,
  CheckCircle,
  Zap,
} from "lucide-react";
import { SonnerInfo, SonnerSuccess, SonnerWarning } from "@/components/uikit/SonnerToast";
import { updateAndSyncGpsLocation } from "@/services/UserActivityService";
import {
  adminRequest,
  changeAdminPin,
  clearShortAdminSessionToken,
  getAdminRoleInfo,
  hasAdminSession,
  hasShortAdminSession,
  startShortAdminSession,
} from "@/services/AdminAuthService";

const UNKNOWN = "Không xác định";
const LIVE_REFRESH_INTERVAL_MS = 5_000;

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN");
}

function relativeActivity(value) {
  if (!value) return "Chưa ghi nhận hoạt động";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Vừa hoạt động";
  if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hoạt động ${hours} giờ trước`;
  return `Hoạt động ${Math.floor(hours / 24)} ngày trước`;
}

function getFixedNumericUid(uid) {
  if (!uid || uid === "—" || uid === "SYSTEM" || uid === "Không xác định") return uid;
  const cleanUid = String(uid).trim();
  if (/^\d+$/.test(cleanUid)) return `#${cleanUid}`;
  let hash = 0;
  const str = `_huy_locket_immutable_${cleanUid}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) >>> 0;
  }
  const numericId = 10000000 + (hash % 90000000);
  return `UID: #${numericId}`;
}

function sourceLabel(source) {
  if (source === "vercel") return "Vercel";
  if (source === "railway") return "Railway";
  if (source === "local") return "Local";
  return "Vercel / Railway";
}

function loginMethodLabel(method) {
  if (method === "session-resume") return "Khôi phục phiên";
  return method || UNKNOWN;
}

function userName(user) {
  return user.displayName || user.username || "Chưa có tên hồ sơ";
}

function roleBadge(role) {
  const r = (role || "user").toLowerCase();
  if (r === "super_admin") {
    return <span className="badge badge-primary font-black text-xs gap-1 shadow-md px-2.5 py-3 border-2 border-primary-content/30">👑 SUPER ADMIN</span>;
  }
  if (r === "admin") {
    return <span className="badge badge-secondary font-bold text-xs gap-1 shadow-sm px-2.5 py-3">🛡️ ADMIN</span>;
  }
  if (r === "moderator") {
    return <span className="badge badge-accent font-semibold text-xs gap-1 py-2.5 px-2">⚖️ MODERATOR</span>;
  }
  if (r === "support") {
    return <span className="badge badge-info text-xs gap-1 py-2.5 px-2">🎧 SUPPORT</span>;
  }
  return <span className="badge badge-ghost badge-xs font-mono">User</span>;
}

function errorMessage(error) {
  if (error?.code === "DATABASE_NOT_CONFIGURED") {
    return "Database theo dõi người dùng chưa được cấu hình trên Railway API.";
  }
  if (error?.status === 403 || error?.code === "ADMIN_PERMISSION_REQUIRED") {
    return "Tài khoản này không có quyền xem dữ liệu quản trị.";
  }
  if (error?.status === 401 || error?.code === "ADMIN_SESSION_EXPIRED") {
    return "Phiên làm việc nhạy cảm đã hết hạn hoặc cần xác minh Mã PIN số bảo mật.";
  }
  return `Không thể tải dữ liệu. ${error?.message || "Lỗi không xác định"}`;
}

function renderUserLocation(user, latestLogin) {
  const data = latestLogin || user;
  const gpsLoc = data?.gps_coordinates || user.gps_coordinates;
  const ipLoc = [data?.city || user.city, data?.region || user.region, data?.country || user.country]
    .filter((v) => v && v !== UNKNOWN && v !== "Unknown").join(", ") || UNKNOWN;

  if (gpsLoc) {
    return (
      <a
        href={`https://www.google.com/maps?q=${encodeURIComponent(gpsLoc)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-500 hover:text-emerald-400 font-extrabold inline-flex items-center gap-1 underline decoration-emerald-500/50 hover:decoration-emerald-400"
        title="Tọa độ GPS chính xác (do người dùng đã bật định vị trên thiết bị)"
      >
        <span>📍 GPS chính xác: {gpsLoc}</span>
      </a>
    );
  }
  return (
    <span className="text-amber-500 font-semibold inline-flex items-center gap-1.5 text-xs" title="Vị trí trạm nhà mạng gần đúng theo IP (do người dùng không bật định vị GPS)">
      <span>🌐 Vị trí IP (gần đúng): {ipLoc}</span>
      <span className="text-[10px] opacity-90 border border-amber-500/50 px-1.5 py-0.5 rounded font-mono bg-amber-500/10">Chưa bật GPS</span>
    </span>
  );
}

function VirtualNumPad({ value, onChange, disabled, maxLength = 8 }) {
  const handlePress = (digit) => {
    if (disabled || value.length >= maxLength) return;
    onChange(value + digit);
  };
  const handleClear = () => {
    if (disabled || !value) return;
    onChange(value.slice(0, -1));
  };

  const buttons = [
    { label: "1", val: "1" }, { label: "2", val: "2" }, { label: "3", val: "3" },
    { label: "4", val: "4" }, { label: "5", val: "5" }, { label: "6", val: "6" },
    { label: "7", val: "7" }, { label: "8", val: "8" }, { label: "9", val: "9" },
    { label: "⌫", action: handleClear, bg: "btn-error btn-outline" }, { label: "0", val: "0" }, { label: "C", action: () => !disabled && onChange(""), bg: "btn-warning btn-outline" }
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mt-4 mb-2">
      {buttons.map((btn, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled || (!btn.action && value.length >= maxLength)}
          onClick={btn.action ? btn.action : () => handlePress(btn.val)}
          className={`btn ${btn.bg || "btn-base-200 hover:bg-primary hover:text-primary-content border border-base-300"} h-12 rounded-2xl font-black text-lg shadow-sm transition-all active:scale-95 flex items-center justify-center cursor-pointer`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentRole, setCurrentRole] = useState("user");
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentUserUid, setCurrentUserUid] = useState("");
  const [checkingAdmin, setCheckingAdmin] = useState(hasAdminSession());
  const [activeTab, setActiveTab] = useState("users"); // "users" | "audit" | "reports"

  // Cổng bảo mật Quản trị viên (PIN Gate) right on entering Admin Page
  const [hasPin, setHasPin] = useState(false);
  const [isGateUnlocked, setIsGateUnlocked] = useState(hasShortAdminSession());
  const [gatePassword, setGatePassword] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState(null);

  // Change PIN modal states
  const [changePinModalOpen, setChangePinModalOpen] = useState(false);
  const [changePinOld, setChangePinOld] = useState("");
  const [changePinNew, setChangePinNew] = useState("");
  const [changePinLoading, setChangePinLoading] = useState(false);
  const [changePinError, setChangePinError] = useState(null);

  // User tab states
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [pageToken, setPageToken] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineWindowSeconds, setOnlineWindowSeconds] = useState(150);
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyState, setHistoryState] = useState("idle");
  const [historyError, setHistoryError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [clearHistoryConfirm, setClearHistoryConfirm] = useState(false);
  const [purgingBots, setPurgingBots] = useState(false);
  const rootRefreshInFlight = useRef(false);

  // Audit Logs states
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditFilterAction, setAuditFilterAction] = useState("");
  const [auditFilterAdmin, setAuditFilterAdmin] = useState("");

  // Reports states
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);

  // Advanced Super Admin tools states
  const [serverHealth, setServerHealth] = useState(null);
  const [clientTelemetry, setClientTelemetry] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastActive, setBroadcastActive] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState("ALL");
  const [broadcastList, setBroadcastList] = useState([]);
  const [blacklistedIps, setBlacklistedIps] = useState([]);
  const [banIpInput, setBanIpInput] = useState("");
  const [banReasonInput, setBanReasonInput] = useState("");
  const [passwordStatusModal, setPasswordStatusModal] = useState(null);

  const updateClientTelemetry = useCallback(async (pingMs) => {
    let connectionType = "WiFi / Băng thông rộng";
    let downlinkMbps = "Tối đa";
    if (navigator.connection) {
      if (navigator.connection.effectiveType) connectionType = `${navigator.connection.effectiveType.toUpperCase()} Network`;
      if (navigator.connection.downlink) downlinkMbps = `${navigator.connection.downlink} Mbps`;
      if (!pingMs && navigator.connection.rtt) pingMs = navigator.connection.rtt;
    }

    let storageBytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        storageBytes += ((key ? key.length : 0) + (localStorage.getItem(key)?.length || 0)) * 2;
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        storageBytes += ((key ? key.length : 0) + (sessionStorage.getItem(key)?.length || 0)) * 2;
      }
    } catch (e) {}

    let cachedItemsCount = 0;
    try {
      if ("caches" in window && caches.keys) {
        const keys = await caches.keys();
        for (const k of keys) {
          const c = await caches.open(k);
          const reqs = await c.keys();
          cachedItemsCount += reqs.length;
        }
      }
    } catch (e) {}

    let userAgentBrand = "Web Browser";
    if (navigator.userAgentData?.brands?.length) {
      userAgentBrand = navigator.userAgentData.brands.map((b) => b.brand).join(", ");
    } else if (navigator.userAgent.includes("Chrome") || navigator.userAgent.includes("Edg")) {
      userAgentBrand = "Google Chrome / Chromium Edge";
    } else if (navigator.userAgent.includes("Safari")) {
      userAgentBrand = "Apple Safari / iOS";
    } else if (navigator.userAgent.includes("Firefox")) {
      userAgentBrand = "Mozilla Firefox";
    }

    setClientTelemetry({
      pingMs: typeof pingMs === "number" ? `${pingMs} ms` : "⚡ < 15 ms",
      connectionType,
      downlinkMbps,
      userAgentBrand,
      cpuThreads: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Lõi CPU` : "8 Lõi",
      deviceRAM: navigator.deviceMemory ? `${navigator.deviceMemory} GB RAM` : "Tối ưu hóa dung lượng",
      localStorageBytes: Math.max(1, Math.round(storageBytes / 1024)),
      cachedItemsCount,
      protocol: `${window.location.protocol.toUpperCase().replace(":", "")} (SSL/TLS 1.3 Active)`,
    });
  }, []);

  const fetchAdvancedData = useCallback(async () => {
    try {
      const tStart = performance.now();
      const h = await adminRequest("/server-health");
      const tEnd = performance.now();
      if (h?.data) {
        setServerHealth(h.data);
        updateClientTelemetry(Math.round(tEnd - tStart));
      } else {
        updateClientTelemetry(null);
      }
      const b = await adminRequest("/broadcast");
      if (b?.data) {
        setBroadcastMsg("");
        setBroadcastActive(Boolean(b.data.active && b.data.message));
        setBroadcastTarget(b.data.targetUser || "ALL");
      }
      if (b?.list) setBroadcastList(b.list || []);
      const p = await adminRequest("/ip-blacklist");
      if (p?.list) setBlacklistedIps(p.list || []);
    } catch (err) {
      console.warn("Failed fetching advanced tools data:", err);
    }
  }, [updateClientTelemetry]);

  // Modals state
  const [actionModal, setActionModal] = useState(null); // { type: 'lock'|'unlock'|'revoke'|'role', user, newRole, reason }
  const [reauthModalOpen, setReauthModalOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState(null);
  const [pendingCallback, setPendingCallback] = useState(null);

  const fetchUsers = useCallback(async (token = "", { silent = false, live = false } = {}) => {
    const isRootRefresh = !token;
    if (isRootRefresh && rootRefreshInFlight.current) return;
    if (isRootRefresh) rootRefreshInFlight.current = true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (token) query.set("pageToken", token);
      if (live) query.set("live", "1");
      const data = await adminRequest(`/users?${query.toString()}`);
      const nextUsers = data.users || [];
      setUsers((current) => {
        if (!token && !live) return nextUsers;
        if (!token && live) {
          const refreshed = new Set(nextUsers.map((entry) => entry.uid));
          return [...nextUsers, ...current.filter((entry) => !refreshed.has(entry.uid))];
        }
        const merged = new Map(current.map((entry) => [entry.uid, entry]));
        for (const entry of nextUsers) merged.set(entry.uid, entry);
        return Array.from(merged.values());
      });
      if (!token) {
        setSelectedUser((current) => {
          if (!current) return current;
          const updated = nextUsers.find((entry) => entry.uid === current.uid);
          return updated ? { ...current, ...updated } : current;
        });
      }
      setPageToken((current) => live && current ? current : data.pageToken || null);
      setTotalUsers(Number(data.totalUsers || 0));
      setOnlineWindowSeconds(data.onlineWindowSeconds || 150);
      setError(null);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.code === "ADMIN_SESSION_EXPIRED") {
        clearShortAdminSessionToken();
        setIsGateUnlocked(false);
      }
      if (!silent || requestError.status === 401 || requestError.status === 403) {
        setError({ code: requestError.code, message: errorMessage(requestError) });
      }
    } finally {
      if (isRootRefresh) rootRefreshInFlight.current = false;
      if (!silent) {
        setLoading(false);
        setCheckingAdmin(false);
      }
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (auditFilterAction) query.set("action", auditFilterAction);
      if (auditFilterAdmin) query.set("adminUid", auditFilterAdmin);
      const data = await adminRequest(`/audit-logs?${query.toString()}`);
      setAuditLogs(data.logs || []);
    } catch (err) {
      if (err?.code === "ADMIN_SESSION_EXPIRED" || err?.status === 401) {
        clearShortAdminSessionToken();
        setIsGateUnlocked(false);
      }
      setAuditError(errorMessage(err));
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilterAction, auditFilterAdmin]);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const data = await adminRequest("/content/reports?status=pending");
      setReports(data.reports || []);
    } catch (err) {
      if (err?.code === "ADMIN_SESSION_EXPIRED" || err?.status === 401) {
        clearShortAdminSessionToken();
        setIsGateUnlocked(false);
      }
      setReportsError(errorMessage(err));
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAdminSession()) {
      setCheckingAdmin(false);
      navigate("/login", { replace: true });
      return undefined;
    }

    let active = true;
    getAdminRoleInfo()
      .then((info) => {
        if (!active) return;
        setIsAdmin(info.isAdmin);
        setCurrentRole(info.role || "user");
        setCurrentUserUid(info.uid || "");
        setCurrentEmail(info.email || localStorage.getItem("email") || "");
        setHasPin(info.hasPin || false);

        // If already unlocked (valid session in last 30 mins), load users
        if (info.isAdmin && hasShortAdminSession()) {
          setIsGateUnlocked(true);
          fetchUsers();
        } else {
          setCheckingAdmin(false);
          setIsGateUnlocked(false);
        }
      })
      .catch((requestError) => {
        if (!active) return;
        setIsAdmin(false);
        setCheckingAdmin(false);
        SonnerInfo(errorMessage(requestError));
        navigate("/locket", { replace: true });
      });
    return () => {
      active = false;
    };
  }, [fetchUsers, navigate]);

  useEffect(() => {
    if (!isAdmin || !isGateUnlocked || activeTab !== "users") return undefined;
    const refreshLiveUsers = () => {
      if (document.hidden) return;
      fetchUsers("", { silent: true, live: true });
    };
    const timer = window.setInterval(refreshLiveUsers, LIVE_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshLiveUsers();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchUsers, isAdmin, isGateUnlocked, activeTab]);

  useEffect(() => {
    if (!isAdmin || !isGateUnlocked) return;
    if (activeTab === "audit" && (currentRole === "super_admin" || currentRole === "admin")) {
      fetchAuditLogs();
    }
    if (activeTab === "reports" && currentRole !== "support") {
      fetchReports();
    }
  }, [activeTab, isAdmin, isGateUnlocked, currentRole, fetchAuditLogs, fetchReports]);

  const { adminTeam, normalUsers } = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = !normalized ? users : users.filter((user) =>
      user.displayName?.toLowerCase().includes(normalized)
      || user.username?.toLowerCase().includes(normalized)
      || user.email?.toLowerCase().includes(normalized)
      || user.uid.toLowerCase().includes(normalized)
    );
    const admins = [];
    const regulars = [];
    for (const u of list) {
      if (u.role !== "user" || u.isAdmin || u.role === "super_admin") admins.push(u);
      else regulars.push(u);
    }
    return { adminTeam: admins, normalUsers: regulars };
  }, [search, users]);

  const isOnline = useCallback((user) => {
    if (!user.lastSeenAt || Number(user.activeSessions || 0) < 1) return false;
    return Date.now() - new Date(user.lastSeenAt).getTime() <= onlineWindowSeconds * 1000;
  }, [onlineWindowSeconds]);

  const openUser = async (user) => {
    setSelectedUser(user);
    setClearHistoryConfirm(false);
    setHistory([]);
    setHistoryError(null);
    setHistoryState("loading");
    try {
      const data = await adminRequest(`/users/${encodeURIComponent(user.uid)}/login-history?limit=100`);
      setHistory(data.history || []);
      setHistoryState((data.history || []).length ? "success" : "empty");
    } catch (requestError) {
      if (requestError?.code === "ADMIN_SESSION_EXPIRED" || requestError?.status === 401) {
        clearShortAdminSessionToken();
        setIsGateUnlocked(false);
        setSelectedUser(null);
      } else {
        setHistoryError(errorMessage(requestError));
        setHistoryState("error");
      }
    }
  };

  const handleGateSubmit = async (e) => {
    e.preventDefault();
    if (!gatePassword.trim() || !/^\d{4,8}$/.test(gatePassword.trim())) {
      setGateError("Vui lòng nhập mã PIN bảo mật (dãy số từ 4 đến 8 chữ số).");
      return;
    }
    setGateLoading(true);
    setGateError(null);
    try {
      await startShortAdminSession(gatePassword.trim());
      if (!hasPin) {
        SonnerInfo("🎉 Thiết lập Mã PIN số Quản Trị viên thành công! Cổng bảo mật đã mở.");
        setHasPin(true);
      } else {
        SonnerInfo("Xác minh mã PIN thành công! Cổng bảo mật Admin đã mở cho 30 phút tới.");
      }
      setIsGateUnlocked(true);
      fetchUsers();
      fetchAdvancedData();
    } catch (err) {
      setGateError(err.message || "Xác minh mã PIN thất bại. Vui lòng kiểm tra lại mã PIN.");
    } finally {
      setGatePassword("");
      setGateLoading(false);
    }
  };

  const handleActionWithSessionCheck = async (actionFn) => {
    try {
      await actionFn();
    } catch (err) {
      if (err?.code === "ADMIN_SESSION_EXPIRED" || err?.code === "FRESH_AUTH_REQUIRED" || err?.status === 401) {
        clearShortAdminSessionToken();
        setPendingCallback(() => actionFn);
        setReauthError("Phiên thao tác nhạy cảm đã hết hạn sau 30 phút. Vui lòng xác minh lại mã PIN bảo mật.");
        setReauthModalOpen(true);
      } else {
        SonnerInfo(`Lỗi thao tác: ${err.message || "Không xác định"}`);
      }
    }
  };

  const executeModalAction = async () => {
    if (!actionModal) return;
    const { type, user, newRole, reason } = actionModal;
    if (!reason?.trim() && type !== "unlock") {
      SonnerInfo("Vui lòng nhập đầy đủ lý do bắt buộc để tiếp tục");
      return;
    }

    setActionLoading(`${type}-${user.uid}`);
    const fn = async () => {
      if (type === "lock" || type === "unlock") {
        await adminRequest(`/users/${encodeURIComponent(user.uid)}/${type}`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        const nextDisabled = type === "lock";
        const update = (entry) => entry.uid === user.uid
          ? { ...entry, disabled: nextDisabled, accountStatus: nextDisabled ? "locked" : "active" }
          : entry;
        setUsers((current) => current.map(update));
        setSelectedUser((current) => current && current.uid === user.uid ? update(current) : current);
        SonnerInfo(nextDisabled ? "Đã khóa quyền truy cập Huy Locket" : "Đã mở khóa quyền truy cập");
      } else if (type === "revoke") {
        const res = await adminRequest(`/users/${encodeURIComponent(user.uid)}/revoke-sessions`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        SonnerInfo(`Đã thu hồi thành công ${res.revokedSessions || "toàn bộ"} phiên làm việc của user`);
        fetchUsers("", { silent: true });
      } else if (type === "role") {
        await adminRequest(`/users/${encodeURIComponent(user.uid)}/role`, {
          method: "POST",
          body: JSON.stringify({ role: newRole, reason: reason.trim() }),
        });
        SonnerInfo(`Đã gán thành công vai trò ${newRole.toUpperCase()} cho user`);
        const update = (entry) => entry.uid === user.uid
          ? { ...entry, role: newRole, isAdmin: newRole !== "user" }
          : entry;
        setUsers((current) => current.map(update));
        setSelectedUser((current) => current && current.uid === user.uid ? update(current) : current);
      } else if (type === "nuke") {
        await adminRequest(`/users/${encodeURIComponent(user.uid)}/nuke`, {
          method: "DELETE",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        SonnerInfo(`🔥 Đã Tiêu Hủy (Nuke) vĩnh viễn tài khoản của ${user.email || user.uid} khỏi hệ thống!`);
        setUsers((current) => current.filter((entry) => entry.uid !== user.uid));
        if (selectedUser?.uid === user.uid) setSelectedUser(null);
      }
      setActionModal(null);
    };

    try {
      await handleActionWithSessionCheck(fn);
    } finally {
      setActionLoading(null);
    }
  };


  const handleReauthSubmit = async (event) => {
    event.preventDefault();
    if (!reauthPassword.trim() || !/^\d{4,8}$/.test(reauthPassword.trim())) {
      setReauthError("Vui lòng nhập mã PIN số quản trị (4 - 8 chữ số)");
      return;
    }
    setReauthLoading(true);
    setReauthError(null);
    try {
      await startShortAdminSession(reauthPassword.trim());
      SonnerInfo("Xác minh lại mã PIN thành công. Phiên quản trị gia hạn 30 phút.");
      setReauthModalOpen(false);
      setIsGateUnlocked(true);
      if (pendingCallback) {
        await pendingCallback();
      }
    } catch (err) {
      setReauthError(err.message || "Xác minh mã PIN thất bại. Kiểm tra lại mã PIN của bạn.");
    } finally {
      setReauthPassword("");
      setReauthLoading(false);
      setPendingCallback(null);
    }
  };

  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    if (!changePinOld.trim() || !changePinNew.trim()) {
      setChangePinError("Vui lòng nhập đầy đủ mã PIN hiện tại và mã PIN mới.");
      return;
    }
    if (!/^\d{4,8}$/.test(changePinNew.trim())) {
      setChangePinError("Mã PIN mới phải là dãy số gồm từ 4 đến 8 chữ số.");
      return;
    }
    setChangePinLoading(true);
    setChangePinError(null);
    try {
      await changeAdminPin(changePinOld.trim(), changePinNew.trim());
      SonnerInfo("✨ Đổi mã PIN số Bảo Mật Quản Trị thành công!");
      setChangePinModalOpen(false);
      setChangePinOld("");
      setChangePinNew("");
    } catch (err) {
      setChangePinError(err.message || "Đổi mã PIN thất bại. Vui lòng kiểm tra lại mã PIN hiện tại.");
    } finally {
      setChangePinLoading(false);
    }
  };

  const handleResolveReport = async (id, actionTaken) => {
    const fn = async () => {
      await adminRequest(`/content/reports/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ actionTaken }),
      });
      SonnerInfo(`Đã xử lý vi phạm: ${actionTaken}`);
      fetchReports();
    };
    await handleActionWithSessionCheck(fn);
  };

  const handlePurgeBots = async () => {
    if (!window.confirm("⚡ Bạn có chắc muốn TIÊU DIỆT và KHÓA VĨNH VIỄN toàn bộ các tài khoản Bot rác, nick clone dùng tool hoặc máy chủ VPS bất thường không?")) {
      return;
    }
    const fn = async () => {
      setPurgingBots(true);
      try {
        const res = await adminRequest("/users/purge-bots", {
          method: "POST",
        });
        SonnerInfo(`🔥 Càn quét hoàn tất! Đã tiêu diệt và khóa vĩnh viễn ${res?.count || 0} tài khoản Bot rác & Clone bất thường.`);
        fetchUsers("", { silent: true });
      } finally {
        setPurgingBots(false);
      }
    };
    await handleActionWithSessionCheck(fn);
  };

  if (checkingAdmin || !isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  // CỔNG BẢO MẬT: YÊU CẦU XÁC MINH MẬT KHẨU KHI BƯỚC VÀO TRANG ADMIN
  if (!isGateUnlocked) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 pt-24 animate-fade-in">
        <div className="max-w-md w-full bg-gradient-to-b from-base-100 via-base-100 to-base-200/80 border-2 border-primary/40 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-32 h-32 bg-primary/10 rounded-full blur-xl -z-0" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center text-primary mb-5 shadow-inner">
              <Lock className="w-10 h-10 animate-bounce" />
            </div>

            <h1 className="text-2xl font-black tracking-tight text-primary mb-2 flex items-center justify-center gap-2">
              🛡️ Cổng Bảo Mật Quản Trị
            </h1>
            <p className="text-xs text-base-content/70 mb-2 leading-relaxed font-medium">
              Chào Quản trị viên <strong className="text-base-content font-bold">{currentEmail || "Huy Locket"}</strong> ({roleBadge(currentRole)}).
            </p>
            {!hasPin ? (
              <p className="text-[11px] text-info bg-info/10 p-3.5 rounded-2xl border border-info/30 mb-6 leading-relaxed text-left">
                ✨ <strong>Thiết Lập Mã PIN Lần Đầu:</strong> Bạn chưa có Mã PIN số bảo mật riêng cho khu vực Quản Trị. Vui lòng nhập dãy số (4 - 8 chữ số) để làm Mã PIN mở khóa nhanh và an toàn. Về sau bạn có thể tự động thay đổi trong hệ thống!
              </p>
            ) : (
              <p className="text-[11px] text-base-content/60 leading-relaxed mb-6 bg-base-200/80 p-3.5 rounded-2xl border border-base-300 text-left">
                🛡️ Để bảo vệ quyền lực tối thượng và tài nguyên người dùng, bạn cần xác minh bằng <strong>Mã PIN số bảo mật Quản trị</strong> riêng biệt. Phiên làm việc sẽ mở khóa an toàn trong <strong>30 phút</strong>.
              </p>
            )}

            {gateError && (
              <div className="alert alert-error text-xs py-2.5 mb-5 rounded-xl text-left shadow-sm">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{gateError}</span>
              </div>
            )}

            <form onSubmit={handleGateSubmit} className="w-full space-y-4">
              <div className="form-control w-full text-left">
                <label className="label text-[11px] font-extrabold tracking-wider text-base-content/70 uppercase">
                  {hasPin ? "MÃ PIN SỐ BẢO MẬT QUẢN TRỊ" : "THIẾT LẬP MÃ PIN SỐ QUẢN TRỊ (4 - 8 SỐ)"}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    placeholder={hasPin ? "Nhập mã PIN số của bạn..." : "Tạo mã PIN (ví dụ: 201068)..."}
                    className="input input-bordered w-full rounded-2xl pr-10 shadow-inner text-sm h-12 border-primary/30 focus:border-primary font-bold tracking-widest text-center text-lg"
                    value={gatePassword}
                    onChange={(e) => setGatePassword(e.target.value.replace(/[^0-9]/g, ""))}
                    disabled={gateLoading}
                    autoFocus
                  />
                  <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-content/40 w-5 h-5 pointer-events-none" />
                </div>
                <VirtualNumPad value={gatePassword} onChange={(val) => setGatePassword(val)} disabled={gateLoading} maxLength={8} />
              </div>

              <button
                type="submit"
                className={`btn btn-primary w-full rounded-2xl font-bold h-12 shadow-lg text-sm gap-2 ${gateLoading ? "loading" : ""}`}
                disabled={gateLoading || !gatePassword.trim()}
              >
                {!gateLoading && <CheckCircle size={18} />}
                {gateLoading ? "Đang xác minh..." : (hasPin ? "Mở Khóa Trung Tâm Quản Trị" : "Xác Nhận & Tạo Mã PIN Bảo Mật")}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate("/locket", { replace: true })}
              className="btn btn-ghost btn-xs text-base-content/60 gap-1 mt-6 rounded-lg hover:text-base-content"
              disabled={gateLoading}
            >
              <ArrowLeft size={14} /> Quay lại màn hình chính
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl animate-fade-in pt-20">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-primary tracking-tight">
            <Shield className="text-primary" size={28} /> Hệ thống Quản trị Huy Locket
          </h1>
          <p className="text-sm text-base-content/70 mt-1 flex items-center gap-2">
            Vai trò của bạn: {roleBadge(currentRole)} · {totalUsers} người dùng được ghi nhận qua server
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setChangePinOld("");
              setChangePinNew("");
              setChangePinError(null);
              setChangePinModalOpen(true);
            }}
            className="btn btn-sm btn-outline btn-primary gap-1.5 shadow-sm font-bold rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-content"
            title="Tự động thay đổi mã PIN Bảo Mật số cho Quản trị viên"
          >
            <Key size={15} /> Đổi Mã PIN Quản Trị
          </button>
          <button
            type="button"
            onClick={() => {
              clearShortAdminSessionToken();
              setIsGateUnlocked(false);
              SonnerInfo("Đã khóa trang Quản Trị. Vui lòng nhập mã PIN bảo mật khi truy cập lại.");
            }}
            className="btn btn-sm btn-outline btn-error gap-1.5 shadow-sm font-semibold rounded-xl"
            title="Khóa ngay phiên làm việc admin hiện tại"
          >
            <Lock size={15} /> Khóa màn hình Admin
          </button>
        </div>
      </div>

      {/* TABS HEADER */}
      <div className="tabs tabs-boxed mb-6 bg-base-200/80 p-1.5 rounded-2xl w-fit shadow-inner border border-base-300">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`tab gap-2 font-bold transition-all ${activeTab === "users" ? "tab-active bg-primary text-primary-content shadow-md rounded-xl" : ""}`}
        >
          <Users size={16} /> Người dùng & Phân quyền ({totalUsers})
        </button>
        {(currentRole === "super_admin" || currentRole === "admin") && (
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`tab gap-2 font-bold transition-all ${activeTab === "audit" ? "tab-active bg-primary text-primary-content shadow-md rounded-xl" : ""}`}
          >
            <FileText size={16} /> Nhật ký Quản trị (Audit Log)
          </button>
        )}
        {currentRole !== "support" && (
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`tab gap-2 font-bold transition-all ${activeTab === "reports" ? "tab-active bg-primary text-primary-content shadow-md rounded-xl" : ""}`}
          >
            <Shield size={16} /> Quản lý Nội dung vi phạm
          </button>
        )}
        <button
          type="button"
          onClick={() => { setActiveTab("advanced"); fetchAdvancedData(); }}
          className={`tab gap-2 font-bold transition-all ${activeTab === "advanced" ? "tab-active bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-md rounded-xl" : ""}`}
        >
          <Zap size={16} className="text-yellow-300 animate-pulse" /> 🚀 Quyền Lực Tối Thượng
        </button>
      </div>


      {/* TAB 1: USERS AND RBAC */}
      {activeTab === "users" && (
        <>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="alert alert-info text-xs sm:text-sm py-2 max-w-3xl shadow-sm rounded-2xl bg-info/10 border border-info/20 text-info-content font-medium">
              <Info size={16} className="shrink-0 text-info" />
              <span>Vị trí hiển thị kết hợp giữa <strong>Vị trí IP máy chủ</strong> và <strong>Tọa độ GPS thực tế</strong> của thiết bị (hệ thống tự động xin quyền truy cập vị trí khi người dùng vào web, nếu được cho phép sẽ ghi lại tọa độ chính xác). Lịch sử bắt đầu ghi từ khi bộ giám sát kích hoạt.</span>
            </div>
            <div className="relative w-full sm:w-80">
              <input type="text" placeholder="Tìm email, tên, username, uid..." className="input input-bordered input-sm w-full pl-9 rounded-full shadow-inner h-10 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
            </div>
          </div>

          {/* SECTION A: BAN QUẢN TRỊ HUY LOCKET */}
          <div className="mb-10">
            <h2 className="text-lg font-black flex items-center gap-2 mb-4 text-primary tracking-wide">
              👑 Ban Quản trị Huy Locket <span className="badge badge-primary badge-sm font-black text-xs px-2 py-2.5 shadow-sm">{adminTeam.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {adminTeam.map((admin) => {
                const latestLogin = admin.latestLoginData || admin;
                const locationElement = renderUserLocation(admin, latestLogin);
                const isSuperAdmin = admin.role === "super_admin" || admin.email?.toLowerCase() === "buiduchuy2010qn@gmail.com";
                const isSelf = admin.uid === currentUserUid;

                return (
                  <div
                    key={admin.uid}
                    className="bg-gradient-to-br from-primary/15 via-base-100 to-base-200/60 border-2 border-primary/40 rounded-3xl p-5 shadow-lg flex flex-col justify-between hover:shadow-xl hover:border-primary transition-all duration-300 relative overflow-hidden backdrop-blur-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className="avatar placeholder">
                            <div className="bg-gradient-to-tr from-primary to-secondary text-primary-content rounded-2xl w-14 h-14 flex items-center justify-center font-bold text-2xl shadow-md">
                              {isSuperAdmin ? "👑" : "🛡️"}
                            </div>
                          </div>
                          <div>
                            <div className="font-extrabold text-base text-base-content flex items-center gap-1.5 flex-wrap">
                              {userName(admin)}
                              {roleBadge(admin.role)}
                            </div>
                            <div className="text-xs font-mono text-base-content/70 mt-1 break-all">{admin.email || admin.username || admin.uid}</div>
                          </div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm btn-circle text-primary hover:bg-primary/10" onClick={() => openUser(admin)} title="Xem chi tiết & lịch sử">
                          <Info size={20} />
                        </button>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-base-200/80 text-xs space-y-2 text-base-content/80">
                        <div className="flex items-center justify-between">
                          <span className="text-base-content/60">Trạng thái:</span>
                          {isOnline(admin) ? <span className="text-success font-bold flex items-center gap-1.5"><Activity size={14} className="animate-pulse" /> Đang hoạt động ({admin.activeSessions} phiên)</span> : <span className="font-medium">{relativeActivity(admin.lastSeenAt)}</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-base-content/60">Vị trí (GPS & IP):</span>
                          <div className="font-semibold text-right flex items-center gap-1.5 justify-end">
                            {locationElement}
                            {isSelf && !admin.gps_coordinates && !latestLogin?.gps_coordinates && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const gps = await updateAndSyncGpsLocation(true);
                                    if (gps) {
                                      SonnerSuccess("🎉 Đã lấy tọa độ GPS thực tế!", `Tọa độ thiết bị: ${gps}. Đang đồng bộ về Bảng Quản trị...`);
                                      setTimeout(() => window.location.reload(), 1500);
                                    } else {
                                      SonnerWarning("Chưa cấp quyền GPS", "Hãy bấm biểu tượng bên trái thanh địa chỉ URL (quyền trang web) -> chọn Vị trí (Location) -> Cho phép, rồi quay lại bấm nút này!");
                                    }
                                  } catch (err) {
                                    SonnerWarning("Lỗi định vị", "Vui lòng bật quyền vị trí trên trình duyệt Chrome.");
                                  }
                                }}
                                className="btn btn-xs btn-outline btn-success font-extrabold px-2 h-6 text-[11px] rounded-md animate-pulse shadow-sm"
                                title="Bấm để lấy tọa độ GPS chính xác từ thiết bị, thay thế cho vị trí IP của cổng trạm nhà mạng"
                              >
                                📍 Lấy GPS thật
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-base-content/60">Nguồn / thiết bị:</span>
                          <span className="font-mono text-[11px] font-medium text-base-content/70">{sourceLabel(admin.webSource)} · {latestLogin?.browser || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Administrative buttons or Immutable Shield inside Admin card */}
                    <div className="mt-5 pt-3 flex items-center justify-end gap-2 border-t border-base-200/80">
                      {isSuperAdmin ? (
                        <span className="badge badge-primary font-black text-[11px] gap-1.5 py-3 px-3 shadow-sm select-none rounded-xl w-full justify-center">
                          🔒 QUYỀN TỐI THƯỢNG CỐ ĐỊNH (IMMUTABLE)
                        </span>
                      ) : isSelf ? (
                        <span className="badge badge-secondary font-bold text-[11px] gap-1.5 py-3 px-3 shadow-sm select-none rounded-xl w-full justify-center">
                          👤 TÀI KHOẢN CHÍNH BẠN (PROTECTED)
                        </span>
                      ) : (
                        <>
                          {currentRole === "super_admin" && (
                            <button
                              type="button"
                              onClick={() => setActionModal({ type: "role", user: admin, newRole: admin.role || "user", reason: "" })}
                              className="btn btn-xs btn-outline btn-secondary rounded-lg font-bold px-3 py-1 h-7"
                            >
                              Đổi vai trò
                            </button>
                          )}
                          {currentRole !== "support" && currentRole !== "moderator" && (
                            <button
                              type="button"
                              onClick={() => setActionModal({ type: "revoke", user: admin, reason: "" })}
                              className="btn btn-xs btn-outline btn-error rounded-lg font-bold px-3 py-1 h-7"
                            >
                              Thu hồi phiên
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION B: NGƯỜI DÙNG LOCKET WEB */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-lg font-black flex items-center gap-2 tracking-tight">
                👥 Người dùng Locket Web <span className="badge badge-neutral badge-sm font-bold text-xs px-2.5 py-2.5">{normalUsers.length}</span>
              </h2>
              <button
                type="button"
                onClick={handlePurgeBots}
                disabled={purgingBots}
                className="btn btn-sm bg-gradient-to-r from-red-600 to-amber-500 text-white hover:from-red-700 hover:to-amber-600 border-0 rounded-full font-extrabold px-4 shadow-md hover:shadow-red-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {purgingBots ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    <span>Đang càn quét...</span>
                  </>
                ) : (
                  <>
                    <Zap size={15} className="animate-pulse text-yellow-300" />
                    <span>⚡ Càn Quét Bot Rác</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="bg-base-200/70 text-base-content font-bold text-xs">
                      <th>Người dùng & Vai trò</th>
                      <th>Đăng nhập gần nhất</th>
                      <th>IP / Vị trí (GPS & IP)</th>
                      <th>Trình duyệt / Thiết bị</th>
                      <th>Tài khoản</th>
                      <th>Hoạt động gần nhất</th>
                      <th>Nguồn web</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && users.length === 0 ? (
                      <tr><td colSpan="8" className="text-center py-16"><span className="loading loading-spinner loading-lg text-primary" /></td></tr>
                    ) : error ? (
                      <tr><td colSpan="8" className="text-center py-12"><AlertTriangle size={32} className="mx-auto text-error mb-2" /><p className="text-error">{error.message}</p><button type="button" onClick={() => fetchUsers()} className="btn btn-sm btn-outline mt-4"><RefreshCw size={14} /> Thử lại</button></td></tr>
                    ) : normalUsers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-16 text-base-content/60">
                          <div className="max-w-md mx-auto space-y-2.5 py-4">
                            <div className="text-4xl">📭</div>
                            <p className="text-base font-extrabold text-base-content">Chưa có người dùng Locket Web nào</p>
                            <p className="text-xs text-base-content/60 leading-relaxed">Hệ thống Giám sát đang kích hoạt. Mới nhất khi người dùng đăng nhập, hồ sơ thật và lịch sử sẽ xuất hiện tại đây.</p>
                          </div>
                        </td>
                      </tr>
                    ) : normalUsers.map((user) => {
                      const latestLogin = user.latestLoginData || user;
                      const locationElement = renderUserLocation(user, latestLogin);
                      const isSuperAdmin = user.role === "super_admin" || user.email?.toLowerCase() === "buiduchuy2010qn@gmail.com";
                      const isSelf = user.uid === currentUserUid;

                      return (
                        <tr key={user.uid} className="hover">
                          <td>
                            <div className="font-bold text-sm flex items-center gap-2 text-base-content">
                              {userName(user)}
                              {roleBadge(user.role)}
                            </div>
                            <div className="text-xs text-base-content/60 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{user.email || user.uid}</span>
                              <span className="badge badge-sm bg-base-200 text-primary font-black font-mono border border-primary/20 shadow-xs" title={`Raw UID: ${user.uid}`}>{getFixedNumericUid(user.uid)}</span>
                            </div>
                          </td>
                          <td className="min-w-36">
                            {latestLogin ? (
                              <>
                                <div className="text-xs font-semibold">{formatDateTime(latestLogin.created_at)}</div>
                                <span className="badge badge-ghost badge-xs font-mono mt-1">{loginMethodLabel(latestLogin.login_method || user.loginMethod || user.provider)}</span>
                              </>
                            ) : <span className="text-xs text-base-content/50">Chưa ghi nhận</span>}
                          </td>
                          <td className="min-w-44">
                            <div className="font-mono font-bold text-xs text-primary">{latestLogin?.ip_address || UNKNOWN}</div>
                            <div className="mt-1.5 text-xs">{locationElement}</div>
                          </td>
                          <td className="min-w-48">
                            <div className="inline-flex items-center gap-1 text-xs font-semibold"><Monitor size={12} className="text-accent shrink-0" /> {latestLogin?.browser || UNKNOWN} {latestLogin?.browser_version !== UNKNOWN ? latestLogin?.browser_version : ""}</div>
                            <div className="text-[11px] text-base-content/60 mt-0.5">{latestLogin ? `${latestLogin.os || UNKNOWN} · ${latestLogin.device || UNKNOWN}` : UNKNOWN}</div>
                            <div className="text-[10px] text-base-content/50 font-mono mt-0.5">Build: {latestLogin?.commit_hash || latestLogin?.build_id || "—"}</div>
                          </td>
                          <td>{user.disabled ? <span className="badge badge-error font-bold badge-xs gap-1 py-2.5 px-2"><Lock size={12} /> Đã khóa</span> : <span className="badge badge-success font-bold badge-xs gap-1 py-2.5 px-2"><Unlock size={12} /> Hoạt động</span>}</td>
                          <td>
                            {isOnline(user)
                              ? <span className="badge badge-success font-bold badge-xs gap-1.5 py-2.5 px-2 text-success-content"><Activity size={12} className="animate-pulse" /> Đang hoạt động · {user.activeSessions} phiên</span>
                              : <span className="text-xs font-medium text-base-content/70">{user.lastLogoutAt && new Date(user.lastLogoutAt) >= new Date(user.lastSeenAt || 0) ? "Đã đăng xuất" : relativeActivity(user.lastSeenAt)}</span>}
                          </td>
                          <td><span className="badge badge-outline badge-xs font-mono font-bold py-2 px-2">{sourceLabel(latestLogin?.web_source || user.webSource)}</span></td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isSuperAdmin ? (
                                <span className="badge badge-primary font-black text-[10px] py-2 px-2 select-none">🔒 Cố định</span>
                              ) : isSelf ? (
                                <span className="badge badge-secondary font-bold text-[10px] py-2 px-2 select-none">👤 Chính bạn</span>
                              ) : (
                                <>
                                  {currentRole !== "support" && currentRole !== "moderator" && (
                                    <>
                                      <button
                                        type="button"
                                        className={`btn btn-xs rounded-lg font-bold h-7 px-2.5 ${user.disabled ? "btn-outline btn-success" : "btn-outline btn-warning"}`}
                                        onClick={() => setActionModal({ type: user.disabled ? "unlock" : "lock", user, reason: "" })}
                                        title={user.disabled ? "Mở khóa web" : "Khóa truy cập web"}
                                      >
                                        {user.disabled ? <Unlock size={13} /> : <Lock size={13} />}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-xs btn-outline btn-error rounded-lg font-bold h-7 px-2.5"
                                        onClick={() => setActionModal({ type: "revoke", user, reason: "" })}
                                        title="Thu hồi toàn bộ phiên làm việc web"
                                      >
                                        Thu hồi
                                      </button>
                                    </>
                                  )}
                                  {currentRole === "super_admin" && (
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline btn-secondary rounded-lg font-bold h-7 px-2.5"
                                      onClick={() => setActionModal({ type: "role", user, newRole: user.role || "user", reason: "" })}
                                      title="Gán quyền RBAC"
                                    >
                                      RBAC
                                    </button>
                                  )}
                                </>
                              )}
                              <button type="button" className="btn btn-sm btn-ghost btn-circle text-primary hover:bg-primary/10" onClick={() => openUser(user)} title="Xem trọn bộ lịch sử đăng nhập">
                                <Info size={19} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {!loading && !error && (
              <p className="mt-3 text-xs text-base-content/60 text-center font-medium">
                Đang hiển thị {users.length}/{totalUsers} người dùng Locket Web
              </p>
            )}

            {!loading && !error && pageToken && !search.trim() && (
              <div className="mt-5 flex justify-center">
                <button type="button" className="btn btn-outline btn-sm rounded-full px-8 font-bold shadow-sm" onClick={() => fetchUsers(pageToken)}>Tải thêm danh sách</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-5 sm:p-7 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-base-200">
            <div>
              <h2 className="text-lg font-black flex items-center gap-2 text-base-content tracking-tight">
                📜 Nhật ký Quản trị Huy Locket (Append-only Audit Log)
              </h2>
              <p className="text-xs text-base-content/70 mt-1">
                Lưu vết toàn bộ thao tác nhạy cảm của các quản trị viên. Dữ liệu vĩnh viễn không thể tẩy xóa bởi admin thường.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Lọc thao tác (LOCK, REVOKE...)"
                className="input input-bordered input-sm text-xs rounded-xl h-9"
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
              />
              <input
                type="text"
                placeholder="Lọc theo UID admin..."
                className="input input-bordered input-sm text-xs rounded-xl h-9"
                value={auditFilterAdmin}
                onChange={(e) => setAuditFilterAdmin(e.target.value)}
              />
              <button type="button" onClick={fetchAuditLogs} className="btn btn-sm btn-ghost btn-circle text-primary" title="Tải lại log">
                <RefreshCw size={17} className={auditLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {auditLoading ? (
            <div className="py-16 text-center"><span className="loading loading-spinner loading-lg text-primary" /></div>
          ) : auditError ? (
            <div className="alert alert-error text-sm rounded-2xl"><AlertTriangle size={16} /> <span>{auditError}</span></div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-16 text-base-content/60">
              <p className="font-bold text-base">Chưa có bản ghi Audit Log nào phù hợp</p>
              <p className="text-xs mt-1 text-base-content/50">Các thao tác khóa tài khoản, thu hồi phiên hay đổi quyền sẽ xuất hiện tự động tại đây.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200/70 text-xs font-bold text-base-content">
                    <th>Thời gian server</th>
                    <th>Quản trị viên</th>
                    <th>Hành động</th>
                    <th>UID đối tượng</th>
                    <th>Lý do & Chi tiết</th>
                    <th>IP / Nguồn</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover">
                      <td className="whitespace-nowrap font-mono text-xs font-medium">{formatDateTime(log.created_at)}</td>
                      <td>
                        <div className="font-mono text-xs font-black text-primary" title={`Raw Admin UID: ${log.admin_uid}`}>{getFixedNumericUid(log.admin_uid)}</div>
                        <div className="mt-1">{roleBadge(log.role)}</div>
                      </td>
                      <td><span className="badge badge-outline font-black text-xs py-2 px-2.5 shadow-xs">{log.action}</span></td>
                      <td className="font-mono text-xs font-bold text-base-content/90" title={`Raw Target UID: ${log.target_uid || "—"}`}>{log.target_uid && log.target_uid !== "—" ? getFixedNumericUid(log.target_uid) : "—"}</td>
                      <td className="text-xs font-medium max-w-md break-words">{log.details || "—"}</td>
                      <td className="text-xs">
                        <div className="font-mono font-semibold">{log.ip_address || UNKNOWN}</div>
                        <div className="text-[10px] font-bold text-base-content/60 mt-0.5">{sourceLabel(log.web_source)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REPORTED CONTENT */}
      {activeTab === "reports" && (
        <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-5 sm:p-7 animate-fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-base-200">
            <div>
              <h2 className="text-lg font-black flex items-center gap-2 tracking-tight">
                🛡️ Quản lý Nội dung bị báo cáo
              </h2>
              <p className="text-xs text-base-content/70 mt-1">
                Dành cho Admin và Moderator xử lý vi phạm tiêu chuẩn cộng đồng.
              </p>
            </div>
            <button type="button" onClick={fetchReports} className="btn btn-sm btn-ghost btn-circle text-primary" title="Tải lại">
              <RefreshCw size={17} className={reportsLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {reportsLoading ? (
            <div className="py-16 text-center"><span className="loading loading-spinner loading-lg text-primary" /></div>
          ) : reportsError ? (
            <div className="alert alert-error text-sm rounded-2xl"><AlertTriangle size={16} /> <span>{reportsError}</span></div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-base-content/60">
              <div className="text-5xl mb-3">🎉</div>
              <p className="font-extrabold text-base text-base-content">Không có nội dung vi phạm nào</p>
              <p className="text-xs text-base-content/60 mt-1">Môi trường Locket đang an toàn và sạch sẽ.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200/70 text-xs font-bold text-base-content">
                    <th>ID Bài / Nội dung</th>
                    <th>Người báo cáo</th>
                    <th>Tác giả</th>
                    <th>Lý do vi phạm</th>
                    <th>Trạng thái</th>
                    <th className="text-right">Xử lý vi phạm</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="hover">
                      <td className="font-mono text-xs font-bold text-primary">{report.content_id}</td>
                      <td className="font-mono text-xs">{report.reporter_uid || "Ẩn danh"}</td>
                      <td className="font-mono text-xs">{report.author_uid || "—"}</td>
                      <td className="text-xs font-bold text-error">{report.reason || "Vi phạm tiêu chuẩn"}</td>
                      <td><span className="badge badge-warning font-bold badge-xs py-2 px-2">Đang chờ</span></td>
                      <td className="text-right space-x-1.5">
                        <button type="button" onClick={() => handleResolveReport(report.id, "hidden")} className="btn btn-xs btn-outline btn-warning font-bold rounded-lg h-7 px-3">Ẩn bài</button>
                        <button type="button" onClick={() => handleResolveReport(report.id, "deleted")} className="btn btn-xs btn-outline btn-error font-bold rounded-lg h-7 px-3">Xóa mềm</button>
                        <button type="button" onClick={() => handleResolveReport(report.id, "dismissed")} className="btn btn-xs btn-ghost font-medium rounded-lg h-7 px-3">Bỏ qua</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ADVANCED SUPER ADMIN POWER SUITE */}
      {activeTab === "advanced" && (
        <div className="space-y-8 animate-fade-in">
          {/* Section 1: Dual-Cloud Health Dashboard: Vercel & Railway */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-500/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2 text-indigo-300">
                  <Activity size={22} className="text-emerald-400 animate-pulse shrink-0" />
                  Cảm Biến Giám Sát Hạ Tầng Vercel & Railway (Dual-Cloud Shield V3.0)
                </h2>
                <p className="text-xs text-indigo-200/70 mt-1">Hệ thống đo tải tài nguyên thực tế (Real Telemetry): Giao diện Edge (Vercel CDN), Máy chủ trung tâm (Railway API) & CSDL (Neon Cloud).</p>
              </div>
              <button type="button" onClick={fetchAdvancedData} className="btn btn-sm sm:btn-md bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold border-0 shadow-md transition-all duration-300 shrink-0">
                🔄 Làm mới Cảm biến
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              {/* 1. Vercel Frontend Edge Shield & Client Telemetry */}
              <div className="bg-gradient-to-b from-slate-800/90 to-slate-950 border-2 border-purple-500/40 hover:border-purple-400/80 transition-all duration-300 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-500/20">
                    <span className="font-black text-sm text-purple-300 flex items-center gap-2">
                      🌐 TRẠM GIAO DIỆN VERCEL & EDGE CDN
                    </span>
                    <span className="badge badge-success badge-sm font-black text-[10px] animate-pulse py-2 px-2 shadow-sm">EDGE ACTIVE</span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                      <span className="text-purple-300 font-bold block mb-1 text-[11px]">Độ trễ phản hồi máy chủ (Real RTT Ping)</span>
                      <span className="text-emerald-400 font-black text-sm font-mono tracking-tight flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        {clientTelemetry?.pingMs || "Đang đo..."} <span className="text-[11px] text-white/70 font-normal">({clientTelemetry?.connectionType || "Online"})</span>
                      </span>
                    </div>
                    <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                      <span className="text-purple-300 font-bold block mb-1 text-[11px]">Bảo mật Tường lửa WAF & Giao thức Edge</span>
                      <span className="text-white font-black text-xs font-mono block">
                        🛡️ Chống DDoS · {clientTelemetry?.protocol || "HTTPS (TLS 1.3)"}
                      </span>
                    </div>
                    <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                      <span className="text-purple-300 font-bold block mb-1 text-[11px]">Tối ưu hóa tĩnh (Workbox PWA & Cache)</span>
                      <span className="text-amber-300 font-bold text-xs font-mono block">
                        ⚡ {clientTelemetry?.cachedItemsCount || "0"} Assets trong máy · Lưu trữ: {clientTelemetry?.localStorageBytes || "0"} KB
                      </span>
                    </div>
                    <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                      <span className="text-purple-300 font-bold block mb-1 text-[11px]">Thiết bị Admin & Trình duyệt thực</span>
                      <span className="text-cyan-300 font-bold text-[11px] font-mono block truncate">
                        💻 {clientTelemetry?.cpuThreads || "8 Lõi"} · {clientTelemetry?.deviceRAM || "RAM"} · {clientTelemetry?.userAgentBrand || "Web"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Railway Backend API Server */}
              <div className="bg-gradient-to-b from-slate-900/90 to-indigo-950 border-2 border-indigo-500/40 hover:border-indigo-400/80 transition-all duration-300 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-indigo-500/20">
                    <span className="font-black text-sm text-indigo-300 flex items-center gap-2">
                      ⚡ TRẠM XỬ LÝ RAILWAY (NODE ENGINE)
                    </span>
                    <span className="badge badge-primary badge-sm font-black text-[10px] animate-pulse py-2 px-2 shadow-sm">API SHIELD</span>
                  </div>
                  {serverHealth ? (
                    <div className="space-y-2.5 text-xs">
                      <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <span className="text-indigo-300 font-bold block mb-1 text-[11px]">Trạng thái & Tiến trình (PID)</span>
                        <span className="text-emerald-400 font-black text-xs block truncate">
                          🟢 {serverHealth.status} {serverHealth.pid ? `(PID #${serverHealth.pid})` : ""}
                        </span>
                      </div>
                      <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <span className="text-indigo-300 font-bold block mb-1 text-[11px]">Thời gian liên tiếp hoạt động (Uptime)</span>
                        <span className="text-white font-black text-sm font-mono block">
                          ⏳ API: {Math.floor(serverHealth.uptimeSeconds / 3600)}h {Math.floor((serverHealth.uptimeSeconds % 3600) / 60)}p
                          {serverHealth.osUptimeSeconds ? ` | Server OS: ${Math.floor(serverHealth.osUptimeSeconds / 3600)}h ${Math.floor((serverHealth.osUptimeSeconds % 3600) / 60)}p` : ""}
                        </span>
                      </div>
                      <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <span className="text-indigo-300 font-bold block mb-1 text-[11px]">Bộ nhớ RAM Máy chủ (App RSS / V8 Heap)</span>
                        <span className="text-amber-300 font-black text-sm font-mono block">
                          🧠 {serverHealth.memoryRssMb} MB (RSS) / {serverHealth.memoryHeapUsedMb} MB (Heap)
                          {serverHealth.totalOsRamMb ? <span className="text-[11px] text-white/60 block mt-0.5 font-normal">Tổng RAM hệ thống: {serverHealth.totalOsRamMb} MB</span> : null}
                        </span>
                      </div>
                      <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <span className="text-indigo-300 font-bold block mb-1 text-[11px]">Phần cứng CPU & Hệ điều hành</span>
                        <span className="text-slate-300 font-bold text-xs font-mono block truncate" title={serverHealth.cpuModel}>
                          🖥️ {serverHealth.cpuModel || "Cloud vCPU"} ({serverHealth.cpuCores || 1} Cores)
                          <span className="block text-[11px] text-indigo-300/80 mt-0.5">{serverHealth.platform} · {serverHealth.nodeVersion}</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-indigo-300 flex flex-col items-center gap-3">
                      <span className="loading loading-bars loading-md text-primary"></span>
                      <span>Đang đo ngầm tài nguyên thực từ máy chủ Railway...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Neon PostgreSQL Cloud DB Telemetry */}
              <div className="bg-gradient-to-b from-slate-900/90 to-emerald-950/80 border-2 border-emerald-500/40 hover:border-emerald-400/80 transition-all duration-300 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-500/20">
                    <span className="font-black text-sm text-emerald-300 flex items-center gap-2">
                      🗄️ TRẠM CSDL NEON (POSTGRES CLOUD)
                    </span>
                    <span className="badge badge-accent badge-sm font-black text-[10px] animate-pulse py-2 px-2 shadow-sm text-slate-900">DB ONLINE</span>
                  </div>
                  {serverHealth && serverHealth.db ? (
                    <div className="space-y-2.5 text-xs">
                      <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <span className="text-emerald-300 font-bold block mb-1 text-[11px]">Engine CSDL & Tốc độ truy xuất (DB Latency)</span>
                        <span className="text-emerald-400 font-black text-xs block truncate">
                          ⚡ {serverHealth.db.latencyMs ? `${serverHealth.db.latencyMs}ms (Truy xuất trực tiếp)` : "Siêu nhạy"} · {serverHealth.db.status}
                        </span>
                      </div>
                      <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <span className="text-emerald-300 font-bold block mb-1 text-[11px]">Dung lượng Thực tế & Quy mô CSDL</span>
                        <span className="text-white font-black text-sm font-mono block">
                          💾 {serverHealth.db.size} <span className="text-xs text-white/70 font-normal">(Gồm {serverHealth.db.tables} Bảng dữ liệu thực)</span>
                        </span>
                      </div>
                      <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <span className="text-emerald-300 font-bold block mb-1 text-[11px]">Bể kết nối SQL (Active Connection Pool)</span>
                        <span className="text-amber-300 font-black text-sm font-mono block">
                          🔌 {serverHealth.db.connections?.active || 1} / {serverHealth.db.connections?.total || 1} kết nối đang kích hoạt
                        </span>
                      </div>
                      <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <span className="text-emerald-300 font-bold block mb-1 text-[11px]">Thống kê Bản ghi thực tế trong Hệ thống</span>
                        <div className="grid grid-cols-2 gap-1.5 mt-1 text-[11px] font-mono">
                          <div className="bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded-md border border-emerald-500/20">
                            👥 {serverHealth.db.records?.users || 0} Tài khoản
                          </div>
                          <div className="bg-cyan-500/10 text-cyan-300 px-2 py-1 rounded-md border border-cyan-500/20">
                            🔐 {serverHealth.db.records?.sessions || 0} Phiên login
                          </div>
                          <div className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded-md border border-purple-500/20">
                            🛡️ {serverHealth.db.records?.audit || 0} Nhật ký
                          </div>
                          <div className="bg-rose-500/10 text-rose-300 px-2 py-1 rounded-md border border-rose-500/20">
                            🚫 {serverHealth.db.records?.blacklistedIps || 0} IP Bị Cấm
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-emerald-300 flex flex-col items-center gap-3">
                      <span className="loading loading-spinner loading-md text-accent"></span>
                      <span>Đang trích xuất dữ liệu từ Neon Postgres...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Global / Targeted Broadcast Banner */}
          <div className="bg-base-100 rounded-3xl p-6 sm:p-8 shadow-sm border border-base-200">
            <h3 className="text-lg font-black flex items-center gap-2 mb-2 text-primary">
              📢 Phát Loa Thông Báo (Global & Targeted Broadcast)
            </h3>
            <p className="text-xs text-base-content/70 mb-5">
              Chọn phát loa tới toàn bộ người dùng hoặc riêng cho một tài khoản nhất định. Banner sẽ xuất hiện nổi bật trên giao diện người được nhận ngay lập tức!
            </p>

            <div className="mb-4">
              <label className="label text-xs font-bold uppercase text-base-content/80 pb-1">
                🎯 Chọn Đối Tượng Nhận Thông Báo:
              </label>
              <select
                value={broadcastTarget}
                onChange={(e) => setBroadcastTarget(e.target.value)}
                className="select select-bordered w-full rounded-xl font-bold text-sm bg-base-200/50"
              >
                <option value="ALL">🌐 Toàn bộ hệ thống (Tất cả người dùng trên Server)</option>
                {users.map((u) => {
                  const label = u.displayName ? `${u.displayName} (${u.email || u.uid})` : (u.email || u.uid);
                  return (
                    <option key={u.uid || u.email} value={u.email || u.uid}>
                      👤 Cá nhân: {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Nhập nội dung thông báo (ví dụ: Bảo trì lúc 23h50, vui lòng lưu trữ bài đăng...)"
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                className="input input-bordered flex-1 font-medium rounded-xl h-11"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!broadcastMsg.trim()) {
                    SonnerWarning("Vui lòng nhập nội dung thông báo trước khi phát sóng!");
                    return;
                  }
                  const action = async () => {
                    await adminRequest("/broadcast", {
                      method: "POST",
                      body: JSON.stringify({ message: broadcastMsg, active: true, targetUser: broadcastTarget }),
                    });
                    setBroadcastMsg("");
                    setBroadcastActive(true);
                    window.dispatchEvent(new Event("locket_broadcast_updated"));
                    const targetText = broadcastTarget === "ALL" ? "Toàn Server" : `riêng cho ${broadcastTarget}`;
                    SonnerSuccess(`🎉 Đã ĐĂNG và PHÁT SÓNG thông báo tới: ${targetText}!`);
                    fetchAdvancedData();
                  };
                  handleActionWithSessionCheck(action);
                }}
                className="btn btn-primary font-black px-6 rounded-xl h-11"
              >
                🟢 Đăng & Phát Sóng Ngay
              </button>
            </div>

            {/* Danh Sách Các Thông Báo Đã Đăng */}
            <div className="mt-8 pt-6 border-t border-base-200">
              <h4 className="text-sm font-black uppercase text-base-content/80 flex items-center gap-2 mb-4">
                📋 Quản Lý Danh Sách Thông Báo Đã Đăng (Broadcast History)
              </h4>
              <div className="overflow-x-auto border border-base-200 rounded-2xl bg-base-100/50 max-h-80 overflow-y-auto">
                <table className="table w-full text-sm font-medium">
                  <thead className="bg-base-200/60 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="py-3">Trạng Thái</th>
                      <th>Nội Dung</th>
                      <th>Đối Tượng</th>
                      <th>Thời Gian Đăng</th>
                      <th className="text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200/50">
                    {broadcastList.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-8 text-base-content/50 font-medium">
                          Chưa có thông báo nào được đăng trong cơ sở dữ liệu.
                        </td>
                      </tr>
                    ) : (
                      broadcastList.map((bItem) => {
                        const isAll = bItem.targetUser === "ALL" || bItem.targetUser === "*";
                        return (
                          <tr key={bItem.id || bItem.updatedAt} className="hover:bg-base-200/30 transition-colors">
                            <td className="py-3 font-bold">
                              {bItem.active ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-success/15 text-success border border-success/30 animate-pulse">
                                  <span className="w-2 h-2 rounded-full bg-success"></span> Đang Phát
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-base-300/60 text-base-content/60">
                                  ⚪ Đã Tắt
                                </span>
                              )}
                            </td>
                            <td className="font-bold max-w-xs truncate" title={bItem.message}>
                              {bItem.message}
                            </td>
                            <td>
                              <span className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
                                isAll ? "bg-info/10 text-info border border-info/20" : "bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20"
                              }`}>
                                {isAll ? "🌐 Toàn Server" : `👤 ${bItem.targetUser}`}
                              </span>
                            </td>
                            <td className="text-xs text-base-content/70 font-mono">
                              {bItem.updatedAt ? new Date(bItem.updatedAt).toLocaleString("vi-VN") : "N/A"}
                            </td>
                            <td className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const action = async () => {
                                      await adminRequest("/broadcast", {
                                        method: "POST",
                                        body: JSON.stringify({ action: "toggle", id: bItem.id, active: !bItem.active }),
                                      });
                                      SonnerInfo(bItem.active ? "Đã tắt loa thông báo!" : "Đã bật lại loa thông báo!");
                                      window.dispatchEvent(new Event("locket_broadcast_updated"));
                                      fetchAdvancedData();
                                    };
                                    handleActionWithSessionCheck(action);
                                  }}
                                  className={`btn btn-xs font-bold rounded-lg ${
                                    bItem.active ? "btn-warning" : "btn-success text-white"
                                  }`}
                                >
                                  {bItem.active ? "🚫 Tắt Loa" : "🟢 Phát Lại"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const action = async () => {
                                      await adminRequest(`/broadcast/${bItem.id}`, { method: "DELETE" });
                                      SonnerInfo("Đã xóa thông báo khỏi danh sách!");
                                      window.dispatchEvent(new Event("locket_broadcast_updated"));
                                      fetchAdvancedData();
                                    };
                                    handleActionWithSessionCheck(action);
                                  }}
                                  className="btn btn-xs btn-error text-white font-bold rounded-lg flex items-center gap-1"
                                  title="Xóa thông báo"
                                >
                                  <Trash2 className="w-3 h-3" /> Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Permanent IP Blacklist */}
          <div className="bg-base-100 rounded-3xl p-6 sm:p-8 shadow-sm border border-base-200">
            <h3 className="text-lg font-black flex items-center gap-2 mb-2 text-error">
              🚫 Cấm Cửa Địa Chỉ IP Vĩnh Viễn (Permanent IP Blacklist)
            </h3>
            <p className="text-xs text-base-content/70 mb-5">Những địa chỉ IP trong danh sách này sẽ bị Tường Lửa Thép Huy Locket từ chối kết nối trước khi chạm vào máy chủ, không thể dùng bất kỳ tài khoản nào để truy cập.</p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                type="text"
                placeholder="Nhập địa chỉ IP cần phong tỏa (VD: 54.196.219.221)..."
                value={banIpInput}
                onChange={(e) => setBanIpInput(e.target.value)}
                className="input input-bordered w-full sm:w-72 font-mono text-sm rounded-xl h-11"
              />
              <input
                type="text"
                placeholder="Lý do cấm (VD: Dội bot VPS / Phát tán rác)..."
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                className="input input-bordered flex-1 text-sm rounded-xl h-11"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!banIpInput.trim()) return SonnerInfo("Vui lòng nhập số IP hợp lệ");
                  const action = async () => {
                    await adminRequest("/ip-blacklist", {
                      method: "POST",
                      body: JSON.stringify({ ip_address: banIpInput.trim(), reason: banReasonInput.trim() || "Cấm bởi Quản Trị Viên" }),
                    });
                    SonnerInfo(`🛑 Đã cấm vĩnh viễn IP: ${banIpInput.trim()}`);
                    setBanIpInput(""); setBanReasonInput("");
                    fetchAdvancedData();
                  };
                  handleActionWithSessionCheck(action);
                }}
                className="btn btn-error font-black text-white px-6 rounded-xl h-11"
              >
                🔒 Phong Tỏa IP
              </button>
            </div>

            <div className="overflow-x-auto border border-base-200 rounded-2xl">
              <table className="table table-sm table-zebra w-full">
                <thead className="bg-base-200/60 font-bold">
                  <tr>
                    <th>Địa chỉ IP</th>
                    <th>Lý do Cấm Cửa</th>
                    <th>Người thao tác</th>
                    <th>Thời gian phong tỏa</th>
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {blacklistedIps.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-8 text-base-content/50 font-medium">Chưa có IP nào bị phong tỏa trong cơ sở dữ liệu.</td></tr>
                  ) : blacklistedIps.map((b) => (
                    <tr key={b.ip_address} className="hover">
                      <td className="font-mono font-bold text-error text-sm">{b.ip_address}</td>
                      <td className="text-xs font-semibold">{b.reason || "—"}</td>
                      <td className="font-mono text-xs text-primary">{b.blocked_by || "SUPER_ADMIN"}</td>
                      <td className="font-mono text-xs text-base-content/70">{formatDateTime(b.created_at)}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            const action = async () => {
                              await adminRequest(`/ip-blacklist/${encodeURIComponent(b.ip_address)}`, { method: "DELETE" });
                              SonnerInfo(`Đã mở cửa IP: ${b.ip_address}`);
                              fetchAdvancedData();
                            };
                            handleActionWithSessionCheck(action);
                          }}
                          className="btn btn-xs btn-outline btn-success font-bold rounded-lg h-7 px-3"
                        >
                          Mở khóa IP
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT USER & LỊCH SỬ ĐĂNG NHẬP */}
      {selectedUser && (

        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setSelectedUser(null)}>
          <div className="modal-box max-w-5xl rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-primary/20 bg-base-100" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-5 top-5 text-base-content/60 hover:bg-base-200" onClick={() => setSelectedUser(null)}>✕</button>
            <h3 className="font-black text-xl mb-1.5 flex items-center gap-2.5 text-base-content">
              {userName(selectedUser)}
              {roleBadge(selectedUser.role)}
            </h3>
            <p className="text-sm font-medium text-base-content/70">{selectedUser.email || selectedUser.username || "Không có email/username"}</p>
            <p className="text-xs text-base-content/40 mb-6 font-mono">UID: {selectedUser.uid}</p>

            {selectedUser.role === "super_admin" || selectedUser.email?.toLowerCase() === "buiduchuy2010qn@gmail.com" ? (
              <div className="alert alert-info bg-primary/15 border-2 border-primary/40 text-primary mb-6 text-sm rounded-2xl font-semibold shadow-inner flex items-center gap-3">
                <Shield size={24} className="shrink-0 animate-pulse text-primary" />
                <span>👑 <strong>Quyền lực Tối thượng Cố định (Immutable Super Admin)</strong>: Tài khoản này được bảo vệ ở cấp độ cao nhất. Không bất kỳ ai (kể cả chính tài khoản này) có thể tự hạ vai trò, khóa truy cập hay thu hồi phiên làm việc.</span>
              </div>
            ) : selectedUser.uid === currentUserUid ? (
              <div className="alert alert-warning bg-secondary/15 border-2 border-secondary/40 text-secondary mb-6 text-sm rounded-2xl font-semibold shadow-inner">
                <span>👤 <strong>Tài khoản chính bạn (Self Protected)</strong>: Để chống tự khóa hỏng quyền truy cập điều hành, bạn không thể tự thu hồi hay khóa tài khoản của chính mình từ giao diện này.</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5 mb-6 bg-base-200/50 p-3 rounded-2xl border border-base-200">
                {currentRole !== "support" && currentRole !== "moderator" && (
                  <>
                    <button type="button" className={`btn btn-sm rounded-xl font-bold px-4 ${selectedUser.disabled ? "btn-success shadow-sm" : "btn-warning shadow-sm"}`} onClick={() => setActionModal({ type: selectedUser.disabled ? "unlock" : "lock", user: selectedUser, reason: "" })}>
                      {selectedUser.disabled ? <Unlock size={15} /> : <Lock size={15} />}
                      {selectedUser.disabled ? "Mở khóa truy cập web" : "Khóa truy cập web"}
                    </button>
                    <button type="button" className="btn btn-sm btn-outline btn-error rounded-xl font-bold px-4" onClick={() => setActionModal({ type: "revoke", user: selectedUser, reason: "" })}>
                      Thu hồi toàn bộ phiên web
                    </button>
                  </>
                )}
                {currentRole === "super_admin" && (
                  <button type="button" className="btn btn-sm btn-outline btn-secondary rounded-xl font-bold px-4" onClick={() => setActionModal({ type: "role", user: selectedUser, newRole: selectedUser.role || "user", reason: "" })}>
                    Gán vai trò RBAC
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-7 text-sm">
              <div className="bg-base-200/70 rounded-2xl p-4 border border-base-300/60 flex items-center gap-2.5"><Clock size={18} className="text-primary shrink-0" /> <span className="text-xs text-base-content/70">Đăng nhập: <strong className="text-base-content block text-sm mt-0.5">{formatDateTime(selectedUser.lastSignInTime)}</strong></span></div>
              <div className="bg-base-200/70 rounded-2xl p-4 border border-base-300/60 flex items-center gap-2.5"><Activity size={18} className="text-success shrink-0" /> <span className="text-xs text-base-content/70">Trang thái: <strong className="text-base-content block text-sm mt-0.5">{isOnline(selectedUser) ? `Đang hoạt động · ${selectedUser.activeSessions} phiên` : relativeActivity(selectedUser.lastSeenAt)}</strong></span></div>
              <div className="bg-base-200/70 rounded-2xl p-4 border border-base-300/60 flex items-center gap-2.5"><Monitor size={18} className="text-secondary shrink-0" /> <span className="text-xs text-base-content/70">Nguồn web: <strong className="text-base-content font-mono block text-sm mt-0.5">{sourceLabel(selectedUser.webSource)}</strong></span></div>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3 border-b border-base-200 pb-3">
              <h4 className="font-extrabold text-base flex items-center gap-2"><Clock size={18} className="text-primary" /> Lịch sử đăng nhập & Phiên web chi tiết</h4>
              {(currentRole === "super_admin" || currentRole === "admin") && (
                <button
                  type="button"
                  className={`btn btn-xs btn-error rounded-xl font-bold px-3 h-8 gap-1.5 ${clearHistoryConfirm ? "animate-pulse btn-active shadow-md" : "btn-outline"}`}
                  onClick={async () => {
                    if (!clearHistoryConfirm) {
                      setClearHistoryConfirm(true);
                      return;
                    }
                    const fn = async () => {
                      const data = await adminRequest(`/users/${encodeURIComponent(selectedUser.uid)}/login-history`, { method: "DELETE" });
                      setHistory([]);
                      setHistoryState("empty");
                      setClearHistoryConfirm(false);
                      SonnerInfo(`Đã xóa ${data.deleted || 0} sự kiện đăng nhập`);
                    };
                    await handleActionWithSessionCheck(fn);
                  }}
                  disabled={historyState === "loading" || history.length === 0}
                >
                  <Trash2 size={14} />
                  {clearHistoryConfirm ? "Xác nhận xóa lịch sử ngay!" : "Xóa lịch sử"}
                </button>
              )}
            </div>

            {historyState === "loading" ? (
              <div className="py-12 text-center"><span className="loading loading-spinner loading-md text-primary" /></div>
            ) : historyState === "error" ? (
              <div className="alert alert-error text-sm rounded-2xl"><AlertTriangle size={16} /><span>{historyError}</span></div>
            ) : historyState === "empty" ? (
              <div className="alert text-sm bg-base-200/50 border-base-200 rounded-2xl font-medium"><Info size={16} className="text-primary" /><span>Chưa có lịch sử đăng nhập được ghi nhận từ khi bộ máy giám sát kích hoạt.</span></div>
            ) : (
              <div className="overflow-x-auto max-h-[420px] rounded-2xl border border-base-300 shadow-inner bg-base-100">
                <table className="table table-sm w-full">
                  <thead><tr className="bg-base-200 text-xs font-bold sticky top-0 z-10"><th>Thời gian</th><th>IP máy chủ</th><th>Vị trí (GPS / IP)</th><th>Trình duyệt / thiết bị</th><th>Phương thức</th><th>Build / Commit</th><th>Nguồn</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {history.map((entry) => {
                      const entryOnline = !entry.ended_at && Date.now() - new Date(entry.last_seen_at).getTime() <= onlineWindowSeconds * 1000;
                      return (
                        <tr key={entry.event_id || entry.session_id} className="hover">
                          <td className="whitespace-nowrap text-xs font-medium">{formatDateTime(entry.created_at)}</td>
                          <td className="font-mono text-xs font-bold text-primary">{entry.ip_address || UNKNOWN}</td>
                          <td><span className="inline-flex items-center font-semibold gap-1 text-xs"><MapPin size={11} className="text-secondary shrink-0" /> {entry.gps_coordinates ? "📍 GPS chính xác: " + entry.gps_coordinates : "🌐 Vị trí IP (gần đúng): " + ([entry.city, entry.region, entry.country].filter((v) => v && v !== UNKNOWN).join(", ") || UNKNOWN) + " [Chưa bật GPS]"}</span></td>
                          <td><span className="font-bold text-xs">{entry.browser || UNKNOWN} {entry.browser_version && entry.browser_version !== UNKNOWN ? entry.browser_version : ""}</span><br /><span className="text-[11px] text-base-content/60">{entry.os || UNKNOWN} · {entry.device || UNKNOWN}</span></td>
                          <td><span className="badge badge-ghost font-mono badge-xs py-2 px-2">{loginMethodLabel(entry.login_method)}</span></td>
                          <td className="font-mono text-xs">{entry.web_version || "—"}<br /><span className="text-[10px] text-base-content/50">{entry.commit_hash || entry.build_id || "—"}</span></td>
                          <td><span className="badge badge-outline badge-xs font-mono font-bold py-2 px-2">{sourceLabel(entry.web_source)}</span></td>
                          <td>{entry.ended_at ? <span className="badge badge-ghost badge-xs font-medium py-2 px-2">Đã kết thúc</span> : entryOnline ? <span className="badge badge-success font-bold badge-xs text-success-content py-2 px-2 shadow-sm">Đang hoạt động</span> : <span className="badge badge-warning font-bold badge-xs py-2 px-2">Mất heartbeat</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL BẮT BUỘC NHẬP LÝ DO CHO THAO TÁC QUẢN TRỊ NHẠY CẢM */}
      {actionModal && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setActionModal(null)}>
          <div className="modal-box max-w-lg rounded-3xl p-6 border border-base-300 shadow-2xl bg-base-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg flex items-center gap-2 text-error mb-2">
              <AlertTriangle className="text-error" size={22} /> Xác nhận Thao tác Quản trị
            </h3>
            <p className="text-sm text-base-content/80 mb-5 font-medium leading-relaxed">
              Bạn đang thực hiện thao tác <strong className="uppercase text-primary font-bold">{actionModal.type}</strong> đối với tài khoản <strong>{userName(actionModal.user)}</strong>. Hành động này sẽ được ghi nhận vào nhật ký Audit Log vĩnh viễn.
            </p>

            {actionModal.type === "role" && (
              <div className="form-control mb-5">
                <label className="label font-extrabold text-xs tracking-wide uppercase text-base-content/70">CHỌN VAI TRÒ RBAC:</label>
                <select
                  className="select select-bordered w-full rounded-2xl font-bold text-sm h-12 border-secondary/40 focus:border-secondary"
                  value={actionModal.newRole}
                  onChange={(e) => setActionModal({ ...actionModal, newRole: e.target.value })}
                >
                  <option value="super_admin">👑 Super Admin - Toàn quyền quản trị tối cao</option>
                  <option value="admin">🛡️ Admin - Quản lý user & thu hồi phiên</option>
                  <option value="moderator">⚖️ Moderator - Chỉ xử lý nội dung vi phạm</option>
                  <option value="support">🎧 Support - Chỉ xem dữ liệu hỗ trợ cơ bản</option>
                  <option value="user">👤 User - Người dùng Locket Web thông thường</option>
                </select>
              </div>
            )}

            <div className="form-control mb-7">
              <label className="label font-extrabold text-xs tracking-wide uppercase text-base-content/70">
                <span>LÝ DO BẮT BUỘC (LƯU VÀO AUDIT LOG):</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-28 rounded-2xl text-sm p-3.5 border-base-300 focus:border-primary shadow-inner font-medium"
                placeholder="Ví dụ: Phát hiện nghi vấn xâm phạm, Thay đổi nhiệm vụ nhân sự, Theo yêu cầu Super Admin..."
                value={actionModal.reason}
                onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                autoFocus
              />
            </div>

            <div className="modal-action flex items-center justify-end gap-2.5 pt-2 border-t border-base-200">
              <button type="button" className="btn btn-sm btn-ghost rounded-xl px-5 font-bold" onClick={() => setActionModal(null)}>Hủy bỏ</button>
              <button
                type="button"
                className={`btn btn-sm btn-primary rounded-xl px-7 font-extrabold h-10 shadow-md ${Boolean(actionLoading) ? "loading" : ""}`}
                onClick={executeModalAction}
                disabled={Boolean(actionLoading)}
              >
                Xác nhận & Thực thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC MINH LẠI MÃ PIN KHI ĐÃ HẾT HẠN PHIÊN NHẠY CẢM */}
      {reauthModalOpen && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setReauthModalOpen(false)}>
          <div className="modal-box max-w-md rounded-3xl p-6 border-2 border-primary/40 shadow-2xl bg-base-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg flex items-center gap-2 text-primary mb-2">
              🔐 Xác Minh Lại Mã PIN Quản Trị
            </h3>
            <p className="text-xs text-base-content/70 leading-relaxed mb-4 font-medium">
              Phiên thao tác quản trị 30 phút của bạn đã hết hạn. Để tiếp tục thực hiện lệnh nhạy cảm cho <strong>{currentEmail || "Tài khoản của bạn"}</strong>, vui lòng xác minh lại bằng Mã PIN số bảo mật.
            </p>

            {reauthError && (
              <div className="alert alert-error text-xs py-2 mb-4 rounded-xl font-medium">
                <AlertTriangle size={16} className="shrink-0" /> <span>{reauthError}</span>
              </div>
            )}

            <form onSubmit={handleReauthSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label text-[11px] font-extrabold text-base-content/70 tracking-wider uppercase">MÃ PIN SỐ BẢO MẬT (4 - 8 SỐ)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  placeholder="Nhập mã PIN của bạn..."
                  className="input input-bordered w-full rounded-2xl pr-10 shadow-inner text-sm h-11 font-bold tracking-widest text-center text-lg border-primary/30 focus:border-primary"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={reauthLoading}
                  autoFocus
                />
              </div>

              <div className="modal-action flex items-center justify-end gap-2 pt-3 border-t border-base-200">
                <button type="button" className="btn btn-sm btn-ghost rounded-xl px-4 font-bold" onClick={() => { setReauthModalOpen(false); setPendingCallback(null); }} disabled={reauthLoading}>Hủy bỏ</button>
                <button type="submit" className="btn btn-sm btn-primary rounded-xl px-6 font-extrabold h-10 shadow-md" disabled={reauthLoading || !reauthPassword.trim()}>
                  {reauthLoading ? <span className="loading loading-spinner loading-xs" /> : "Xác minh & Tiếp tục thao tác"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI MÃ PIN QUẢN TRỊ VIÊN */}
      {changePinModalOpen && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setChangePinModalOpen(false)}>
          <div className="modal-box max-w-md rounded-3xl p-6 border-2 border-primary/40 shadow-2xl bg-base-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg flex items-center gap-2 text-primary mb-2">
              🔑 Đổi Mã PIN Số Bảo Mật Quản Trị
            </h3>
            <p className="text-xs text-base-content/70 leading-relaxed mb-4 font-medium">
              Bạn có thể tự do thay đổi Mã PIN số bảo mật dành riêng cho khu vực quản trị viên tại đây.
            </p>

            {changePinError && (
              <div className="alert alert-error text-xs py-2 mb-4 rounded-xl font-medium">
                <AlertTriangle size={16} className="shrink-0" /> <span>{changePinError}</span>
              </div>
            )}

            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label text-[11px] font-extrabold text-base-content/70 tracking-wider uppercase">MÃ PIN HIỆN TẠI (CŨ)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  placeholder="Nhập mã PIN hiện tại..."
                  className="input input-bordered w-full rounded-2xl shadow-inner text-sm h-11 font-bold tracking-widest text-center text-lg border-base-300 focus:border-primary"
                  value={changePinOld}
                  onChange={(e) => setChangePinOld(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={changePinLoading}
                  autoFocus
                />
              </div>

              <div className="form-control">
                <label className="label text-[11px] font-extrabold text-base-content/70 tracking-wider uppercase">MÃ PIN SỐ MỚI (4 - 8 CHỮ SỐ)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  placeholder="Nhập mã PIN số mới..."
                  className="input input-bordered w-full rounded-2xl shadow-inner text-sm h-11 font-bold tracking-widest text-center text-lg border-primary/40 focus:border-primary text-primary"
                  value={changePinNew}
                  onChange={(e) => setChangePinNew(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={changePinLoading}
                />
              </div>

              <div className="modal-action flex items-center justify-end gap-2 pt-3 border-t border-base-200">
                <button type="button" className="btn btn-sm btn-ghost rounded-xl px-4 font-bold" onClick={() => setChangePinModalOpen(false)} disabled={changePinLoading}>Hủy bỏ</button>
                <button type="submit" className="btn btn-sm btn-primary rounded-xl px-6 font-extrabold h-10 shadow-md" disabled={changePinLoading || !changePinOld.trim() || !changePinNew.trim()}>
                  {changePinLoading ? <span className="loading loading-spinner loading-xs" /> : "Lưu Mã PIN Mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ VÀ HỖ TRỢ KHÔI PHỤC MẬT KHẨU */}
      {passwordStatusModal && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setPasswordStatusModal(null)}>
          <div className="modal-box max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border-2 border-info/30 bg-base-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <h3 className="font-black text-lg text-info flex items-center gap-2">🔑 Kiểm tra & Hỗ trợ Mật Khẩu</h3>
              <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setPasswordStatusModal(null)}>✕</button>
            </div>
            <div className="py-4 space-y-4 text-sm">
              <div>
                <span className="text-xs text-base-content/60 font-bold uppercase block">Hồ sơ người dùng</span>
                <p className="font-bold text-base-content text-base mt-0.5">{passwordStatusModal.displayName}</p>
                <p className="text-xs font-mono text-primary mt-0.5">{passwordStatusModal.email}</p>
              </div>
              <div className="bg-base-200/70 p-3.5 rounded-2xl border border-base-300">
                <span className="text-xs text-secondary font-bold block mb-1">🛡️ Trạng Thái & Quyền Trợ Giúp:</span>
                <p className="text-xs text-base-content/80 leading-relaxed font-medium">{passwordStatusModal.policy}</p>
              </div>
              {passwordStatusModal.canResetViaFirebase ? (
                <div className="alert alert-success/20 border border-success/30 rounded-2xl py-3 text-xs font-semibold text-success-content flex items-center gap-2">
                  <span>✅ Email chính chủ hợp lệ. Bất cứ khi nào người dùng quên mật khẩu, họ có thể dùng nút Khôi Phục ở Màn Đăng Nhập hoặc liên hệ Admin gởi cổng bảo mật.</span>
                </div>
              ) : (
                <div className="alert alert-error/20 border border-error/30 rounded-2xl py-3 text-xs font-semibold text-error flex items-center gap-2">
                  <span>⚠️ Tài khoản này chưa gắn Email chuẩn. Yêu cầu liên hệ trực tiếp Admin Huy để cập nhật email trước khi reset.</span>
                </div>
              )}
            </div>
            <div className="modal-action">
              <button type="button" onClick={() => setPasswordStatusModal(null)} className="btn btn-primary rounded-xl font-bold px-6 w-full">Đã rõ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

