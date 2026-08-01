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
} from "lucide-react";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import {
  adminRequest,
  clearShortAdminSessionToken,
  getAdminRoleInfo,
  hasAdminSession,
  hasShortAdminSession,
  startShortAdminSession,
} from "@/services/AdminAuthService";
import { loginWithEmail } from "@/services/LocketDioServices/AuthServices";

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

function sourceLabel(source) {
  if (source === "vercel") return "Vercel";
  if (source === "railway") return "Railway";
  if (source === "local") return "Local";
  return UNKNOWN;
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
    return "Phiên làm việc nhạy cảm đã hết hạn hoặc cần xác minh mật khẩu.";
  }
  return `Không thể tải dữ liệu. ${error?.message || "Lỗi không xác định"}`;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentRole, setCurrentRole] = useState("user");
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentUserUid, setCurrentUserUid] = useState("");
  const [checkingAdmin, setCheckingAdmin] = useState(hasAdminSession());
  const [activeTab, setActiveTab] = useState("users"); // "users" | "audit" | "reports"

  // Cổng bảo mật Quản trị viên (Password Gate) right on entering Admin Page
  const [isGateUnlocked, setIsGateUnlocked] = useState(hasShortAdminSession());
  const [gatePassword, setGatePassword] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState(null);

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
    if (!gatePassword.trim()) {
      setGateError("Vui lòng nhập mật khẩu tài khoản Locket để mở khóa.");
      return;
    }
    setGateLoading(true);
    setGateError(null);
    try {
      const emailToAuth = currentEmail || localStorage.getItem("email") || "";
      if (!emailToAuth) {
        throw new Error("Không xác định được email đang đăng nhập để xác minh");
      }
      const authData = await loginWithEmail({ email: emailToAuth, password: gatePassword, captchaToken: "" });
      if (authData?.idToken || authData?.token) {
        const token = authData.idToken || authData.token;
        try {
          if (localStorage.getItem("idToken")) localStorage.setItem("idToken", token);
          if (sessionStorage.getItem("idToken")) sessionStorage.setItem("idToken", token);
        } catch { /* ignore */ }
      }
      await startShortAdminSession();
      SonnerInfo("Xác minh thành công! Cổng bảo mật Admin đã mở cho 30 phút tới.");
      setIsGateUnlocked(true);
      fetchUsers();
    } catch (err) {
      setGateError(err.message || "Xác minh mật khẩu thất bại. Kiểm tra lại mật khẩu Locket.");
    } finally {
      setGatePassword(""); // Wipe out password from RAM immediately
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
        setReauthError("Phiên thao tác nhạy cảm đã hết hạn sau 30 phút. Vui lòng xác minh lại mật khẩu.");
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
    if (!reauthPassword.trim()) {
      setReauthError("Vui lòng nhập mật khẩu tài khoản Locket");
      return;
    }
    setReauthLoading(true);
    setReauthError(null);
    try {
      const emailToAuth = currentEmail || localStorage.getItem("email") || "";
      if (!emailToAuth) {
        throw new Error("Không xác định được email đang đăng nhập để xác minh lại");
      }
      const authData = await loginWithEmail({ email: emailToAuth, password: reauthPassword, captchaToken: "" });
      if (authData?.idToken || authData?.token) {
        const token = authData.idToken || authData.token;
        try {
          if (localStorage.getItem("idToken")) localStorage.setItem("idToken", token);
          if (sessionStorage.getItem("idToken")) sessionStorage.setItem("idToken", token);
        } catch { /* ignore */ }
      }
      await startShortAdminSession();
      SonnerInfo("Xác minh lại thành công. Phiên quản trị gia hạn 30 phút.");
      setReauthModalOpen(false);
      setIsGateUnlocked(true);
      if (pendingCallback) {
        await pendingCallback();
      }
    } catch (err) {
      setReauthError(err.message || "Xác minh mật khẩu thất bại. Kiểm tra lại mật khẩu.");
    } finally {
      setReauthPassword("");
      setReauthLoading(false);
      setPendingCallback(null);
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
            <p className="text-[11px] text-base-content/60 leading-relaxed mb-6 bg-base-200/80 p-3 rounded-xl border border-base-300">
              Để bảo vệ quyền lực tối thượng và tài nguyên người dùng, bạn cần xác minh lại <strong>Mật Khẩu Locket</strong> trước khi truy cập. Phiên làm việc sẽ mở khóa an toàn trong <strong>30 phút</strong>.
            </p>

            {gateError && (
              <div className="alert alert-error text-xs py-2.5 mb-5 rounded-xl text-left shadow-sm">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{gateError}</span>
              </div>
            )}

            <form onSubmit={handleGateSubmit} className="w-full space-y-4">
              <div className="form-control w-full text-left">
                <label className="label text-[11px] font-extrabold tracking-wider text-base-content/70 uppercase">
                  MẬT KHẨU TÀI KHOẢN LOCKET
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu Locket hiện tại..."
                    className="input input-bordered w-full rounded-2xl pr-10 shadow-inner text-sm h-12 border-primary/30 focus:border-primary font-medium"
                    value={gatePassword}
                    onChange={(e) => setGatePassword(e.target.value)}
                    disabled={gateLoading}
                    autoFocus
                  />
                  <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-content/40 w-5 h-5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                className={`btn btn-primary w-full rounded-2xl font-bold h-12 shadow-lg text-sm gap-2 ${gateLoading ? "loading" : ""}`}
                disabled={gateLoading || !gatePassword.trim()}
              >
                {!gateLoading && <CheckCircle size={18} />}
                {gateLoading ? "Đang xác minh bảo mật..." : "Mở Khóa Trung Tâm Quản Trị"}
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
              clearShortAdminSessionToken();
              setIsGateUnlocked(false);
              SonnerInfo("Đã khóa trang Quản Trị. Vui lòng nhập mật khẩu khi truy cập lại.");
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
                const latestLogin = admin.latestLoginData;
                const ipLoc = latestLogin ? [latestLogin.city, latestLogin.region, latestLogin.country].filter((v) => v && v !== UNKNOWN).join(", ") : "";
                const gpsLoc = latestLogin?.gps_coordinates || admin.gps_coordinates;
                const location = gpsLoc ? `📍 GPS: ${gpsLoc}${ipLoc ? ` (${ipLoc})` : ""}` : (ipLoc || UNKNOWN);
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
                          <span className="font-semibold inline-flex items-center gap-1 max-w-[190px] truncate text-primary"><MapPin size={13} className="shrink-0" /> {location}</span>
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
                      const latestLogin = user.latestLoginData;
                      const ipLoc = latestLogin ? [latestLogin.city, latestLogin.region, latestLogin.country].filter((v) => v && v !== UNKNOWN).join(", ") : "";
                      const gpsLoc = latestLogin?.gps_coordinates || user.gps_coordinates;
                      const location = gpsLoc ? `📍 GPS: ${gpsLoc}${ipLoc ? ` (${ipLoc})` : ""}` : (ipLoc || UNKNOWN);
                      const isSuperAdmin = user.role === "super_admin" || user.email?.toLowerCase() === "buiduchuy2010qn@gmail.com";
                      const isSelf = user.uid === currentUserUid;

                      return (
                        <tr key={user.uid} className="hover">
                          <td>
                            <div className="font-bold text-sm flex items-center gap-2 text-base-content">
                              {userName(user)}
                              {roleBadge(user.role)}
                            </div>
                            <div className="text-xs text-base-content/60 font-mono mt-0.5">{user.email || user.uid}</div>
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
                            <div className="inline-flex items-center gap-1 mt-1 text-xs text-base-content/70"><MapPin size={11} className="text-secondary shrink-0" /> {location}</div>
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
                        <div className="font-mono text-xs font-bold text-primary">{log.admin_uid}</div>
                        <div className="mt-1">{roleBadge(log.role)}</div>
                      </td>
                      <td><span className="badge badge-outline font-black text-xs py-2 px-2.5 shadow-xs">{log.action}</span></td>
                      <td className="font-mono text-xs text-base-content/80">{log.target_uid || "—"}</td>
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
                          <td><span className="inline-flex items-center font-semibold gap-1 text-xs"><MapPin size={11} className="text-secondary shrink-0" /> {entry.gps_coordinates ? `📍 GPS: ${entry.gps_coordinates}` : ([entry.city, entry.region, entry.country].filter((v) => v && v !== UNKNOWN).join(", ") || UNKNOWN)}</span></td>
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

      {/* MODAL XÁC MINH LẠI MẬT KHẨU LOCKET KHI ĐÃ HẾT HẠN PHIÊN NHẠY CẢM */}
      {reauthModalOpen && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setReauthModalOpen(false)}>
          <div className="modal-box max-w-md rounded-3xl p-6 border-2 border-primary/40 shadow-2xl bg-base-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg flex items-center gap-2 text-primary mb-2">
              🔐 Xác Minh Lại Mật Khẩu Locket
            </h3>
            <p className="text-xs text-base-content/70 leading-relaxed mb-4 font-medium">
              Phiên thao tác quản trị 30 phút của bạn đã hết hạn. Để tiếp tục thực hiện lệnh nhạy cảm cho <strong>{currentEmail || "Tài khoản của bạn"}</strong>, vui lòng xác minh lại mật khẩu. Mật khẩu không bao giờ được lưu lại trên máy chủ hoặc trình duyệt.
            </p>

            {reauthError && (
              <div className="alert alert-error text-xs py-2 mb-4 rounded-xl font-medium">
                <AlertTriangle size={16} className="shrink-0" /> <span>{reauthError}</span>
              </div>
            )}

            <form onSubmit={handleReauthSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label text-[11px] font-extrabold text-base-content/70 tracking-wider uppercase">MẬT KHẨU TÀI KHOẢN LOCKET</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu Locket của bạn..."
                  className="input input-bordered w-full rounded-2xl pr-10 shadow-inner text-sm h-11 font-medium border-primary/30 focus:border-primary"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
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
    </div>
  );
}
