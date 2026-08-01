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
} from "lucide-react";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import {
  adminRequest,
  getAdminRoleInfo,
  hasAdminSession,
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
    return <span className="badge badge-primary font-bold gap-1 shadow-sm text-xs">👑 SUPER ADMIN</span>;
  }
  if (r === "admin") {
    return <span className="badge badge-secondary font-bold gap-1 shadow-sm text-xs">🛡️ ADMIN</span>;
  }
  if (r === "moderator") {
    return <span className="badge badge-accent font-semibold gap-1 text-xs">⚖️ MODERATOR</span>;
  }
  if (r === "support") {
    return <span className="badge badge-info text-xs gap-1">🎧 SUPPORT</span>;
  }
  return <span className="badge badge-ghost badge-xs">User</span>;
}

function errorMessage(error) {
  if (error?.code === "DATABASE_NOT_CONFIGURED") {
    return "Database theo dõi người dùng chưa được cấu hình trên Railway API.";
  }
  if (error?.status === 403 || error?.code === "ADMIN_PERMISSION_REQUIRED") {
    return "Tài khoản này không có quyền xem dữ liệu quản trị.";
  }
  if (error?.status === 401 || error?.code === "ADMIN_SESSION_EXPIRED") {
    return "Phiên làm việc nhạy cảm đã hết hạn hoặc cần đăng nhập.";
  }
  return `Không thể tải dữ liệu. ${error?.message || "Lỗi không xác định"}`;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentRole, setCurrentRole] = useState("user");
  const [currentEmail, setCurrentEmail] = useState("");
  const [checkingAdmin, setCheckingAdmin] = useState(hasAdminSession());
  const [activeTab, setActiveTab] = useState("users"); // "users" | "audit" | "reports"

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
        setCurrentEmail(info.email || localStorage.getItem("email") || "");
        if (info.isAdmin) fetchUsers();
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
    if (!isAdmin || activeTab !== "users") return undefined;
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
  }, [fetchUsers, isAdmin, activeTab]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "audit" && (currentRole === "super_admin" || currentRole === "admin")) {
      fetchAuditLogs();
    }
    if (activeTab === "reports" && currentRole !== "support") {
      fetchReports();
    }
  }, [activeTab, isAdmin, currentRole, fetchAuditLogs, fetchReports]);

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
      if (u.role !== "user" || u.isAdmin) admins.push(u);
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
      setHistoryError(errorMessage(requestError));
      setHistoryState("error");
    }
  };

  const handleActionWithSessionCheck = async (actionFn) => {
    try {
      await actionFn();
    } catch (err) {
      if (err?.code === "ADMIN_SESSION_EXPIRED" || err?.code === "FRESH_AUTH_REQUIRED" || err?.status === 401) {
        setPendingCallback(() => actionFn);
        setReauthError("Phiên thao tác nhạy cảm đã hết hạn. Vui lòng xác minh lại mật khẩu Locket.");
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
      // Verify password via official login endpoint without storing password
      const authData = await loginWithEmail({ email: emailToAuth, password: reauthPassword, captchaToken: "" });
      if (authData?.idToken || authData?.token) {
        const token = authData.idToken || authData.token;
        try {
          if (localStorage.getItem("idToken")) localStorage.setItem("idToken", token);
          if (sessionStorage.getItem("idToken")) sessionStorage.setItem("idToken", token);
        } catch { /* ignore */ }
      }
      await startShortAdminSession();
      SonnerInfo("Xác minh lại thành công. Phiên quản trị mở ra trong 30 phút.");
      setReauthModalOpen(false);
      if (pendingCallback) {
        await pendingCallback();
      }
    } catch (err) {
      setReauthError(err.message || "Xác minh mật khẩu thất bại. Kiểm tra lại mật khẩu.");
    } finally {
      setReauthPassword(""); // Always wipe out password immediately from memory
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

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl animate-fade-in pt-20">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
            <Shield className="text-primary" size={28} /> Hệ thống Quản trị Huy Locket
          </h1>
          <p className="text-sm text-base-content/70 mt-1 flex items-center gap-2">
            Vai trò của bạn: {roleBadge(currentRole)} · {totalUsers} người dùng được ghi nhận qua server
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReauthModalOpen(true)}
            className="btn btn-sm btn-outline btn-primary gap-1 shadow-sm"
            title="Xác minh lại mật khẩu Locket để lấy phiên quản trị ngắn hạn 30 phút"
          >
            <Key size={15} /> Xác minh mật khẩu
          </button>
        </div>
      </div>

      {/* TABS HEADER */}
      <div className="tabs tabs-boxed mb-6 bg-base-200/60 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`tab gap-2 font-semibold ${activeTab === "users" ? "tab-active bg-primary text-primary-content shadow" : ""}`}
        >
          <Users size={16} /> Người dùng & Phân quyền ({totalUsers})
        </button>
        {(currentRole === "super_admin" || currentRole === "admin") && (
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`tab gap-2 font-semibold ${activeTab === "audit" ? "tab-active bg-primary text-primary-content shadow" : ""}`}
          >
            <FileText size={16} /> Nhật ký Quản trị (Audit Log)
          </button>
        )}
        {currentRole !== "support" && (
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`tab gap-2 font-semibold ${activeTab === "reports" ? "tab-active bg-primary text-primary-content shadow" : ""}`}
          >
            <Shield size={16} /> Quản lý Nội dung vi phạm
          </button>
        )}
      </div>

      {/* TAB 1: USERS AND RBAC */}
      {activeTab === "users" && (
        <>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="alert alert-info text-xs sm:text-sm py-2 max-w-3xl shadow-sm">
              <Info size={16} className="shrink-0" />
              <span>Vị trí hiển thị là <strong>Vị trí ước tính theo IP</strong> thực tế của máy chủ (Vercel/Railway), không sử dụng tọa độ GPS nhạy cảm. Lịch sử bắt đầu ghi từ khi bộ giám sát kích hoạt.</span>
            </div>
            <div className="relative w-full sm:w-80">
              <input type="text" placeholder="Tìm email, tên, username, uid..." className="input input-bordered input-sm w-full pl-9 rounded-full shadow-inner" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
            </div>
          </div>

          {/* SECTION A: BAN QUẢN TRỊ HUY LOCKET */}
          <div className="mb-8">
            <h2 className="text-lg font-extrabold flex items-center gap-2 mb-3 text-primary tracking-wide">
              👑 Ban Quản trị Huy Locket <span className="badge badge-primary badge-sm font-semibold">{adminTeam.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminTeam.map((admin) => {
                const latestLogin = admin.latestLoginData;
                const location = latestLogin
                  ? [latestLogin.city, latestLogin.region, latestLogin.country].filter((v) => v && v !== UNKNOWN).join(", ") || UNKNOWN
                  : UNKNOWN;
                return (
                  <div
                    key={admin.uid}
                    className="bg-gradient-to-br from-primary/15 via-base-100 to-base-200/50 border-2 border-primary/30 rounded-2xl p-4 shadow-md flex flex-col justify-between hover:border-primary transition-all duration-200"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="avatar placeholder">
                            <div className="bg-primary/20 text-primary rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg shadow-inner">
                              {admin.role === "super_admin" ? "👑" : "🛡️"}
                            </div>
                          </div>
                          <div>
                            <div className="font-bold text-base text-base-content flex items-center gap-1.5 flex-wrap">
                              {userName(admin)}
                              {roleBadge(admin.role)}
                            </div>
                            <div className="text-xs text-base-content/70 mt-0.5 break-all">{admin.email || admin.username || admin.uid}</div>
                          </div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm btn-circle text-primary hover:bg-primary/10" onClick={() => openUser(admin)} title="Xem chi tiết & lịch sử">
                          <Info size={18} />
                        </button>
                      </div>

                      <div className="mt-4 pt-3 border-t border-base-200 text-xs space-y-1.5 text-base-content/80">
                        <div className="flex items-center justify-between">
                          <span className="text-base-content/60">Trạng thái:</span>
                          {isOnline(admin) ? <span className="text-success font-semibold flex items-center gap-1"><Activity size={13} /> Đang hoạt động ({admin.activeSessions} phiên)</span> : <span>{relativeActivity(admin.lastSeenAt)}</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-base-content/60">Vị trí ước tính IP:</span>
                          <span className="font-medium inline-flex items-center gap-1 max-w-[180px] truncate"><MapPin size={12} className="shrink-0" /> {location}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-base-content/60">Nguồn / thiết bị:</span>
                          <span className="font-mono text-[11px]">{sourceLabel(admin.webSource)} · {latestLogin?.browser || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Administrative buttons inside Admin card */}
                    <div className="mt-4 pt-2 flex items-center justify-end gap-2 border-t border-base-200/50">
                      {currentRole === "super_admin" && admin.uid !== selectedUser?.uid && (
                        <button
                          type="button"
                          onClick={() => setActionModal({ type: "role", user: admin, newRole: admin.role || "user", reason: "" })}
                          className="btn btn-xs btn-outline btn-secondary"
                        >
                          Đổi vai trò
                        </button>
                      )}
                      {currentRole !== "support" && currentRole !== "moderator" && admin.role !== "super_admin" && (
                        <button
                          type="button"
                          onClick={() => setActionModal({ type: "revoke", user: admin, reason: "" })}
                          className="btn btn-xs btn-outline btn-error"
                        >
                          Thu hồi phiên
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION B: NGƯỜI DÙNG LOCKET WEB */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                👥 Người dùng Locket Web <span className="badge badge-neutral badge-sm">{normalUsers.length}</span>
              </h2>
            </div>
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="bg-base-200/50 text-base-content/80 font-semibold">
                      <th>Người dùng & Vai trò</th>
                      <th>Đăng nhập gần nhất</th>
                      <th>IP / Vị trí ước tính</th>
                      <th>Trình duyệt / Thiết bị</th>
                      <th>Tài khoản</th>
                      <th>Hoạt động gần nhất</th>
                      <th>Nguồn web</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && users.length === 0 ? (
                      <tr><td colSpan="8" className="text-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></td></tr>
                    ) : error ? (
                      <tr><td colSpan="8" className="text-center py-12"><AlertTriangle size={32} className="mx-auto text-error mb-2" /><p className="text-error">{error.message}</p><button type="button" onClick={() => fetchUsers()} className="btn btn-sm btn-outline mt-4"><RefreshCw size={14} /> Thử lại</button></td></tr>
                    ) : normalUsers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-12 text-base-content/60">
                          <div className="max-w-md mx-auto space-y-2 py-4">
                            <div className="text-3xl">📭</div>
                            <p className="text-base font-bold text-base-content">Chưa có người dùng Locket Web nào</p>
                            <p className="text-xs text-base-content/60 leading-relaxed">Hệ thống Giám sát đang kích hoạt. Mới nhất khi người dùng đăng nhập, hồ sơ thật và lịch sử sẽ xuất hiện tại đây.</p>
                          </div>
                        </td>
                      </tr>
                    ) : normalUsers.map((user) => {
                      const latestLogin = user.latestLoginData;
                      const location = latestLogin
                        ? [latestLogin.city, latestLogin.region, latestLogin.country].filter((v) => v && v !== UNKNOWN).join(", ") || UNKNOWN
                        : UNKNOWN;
                      return (
                        <tr key={user.uid} className="hover">
                          <td>
                            <div className="font-semibold flex items-center gap-2">
                              {userName(user)}
                              {roleBadge(user.role)}
                            </div>
                            <div className="text-xs text-base-content/60 font-mono">{user.email || user.uid}</div>
                          </td>
                          <td className="min-w-36">
                            {latestLogin ? (
                              <>
                                <div className="text-sm">{formatDateTime(latestLogin.created_at)}</div>
                                <span className="badge badge-ghost badge-xs mt-1">{loginMethodLabel(latestLogin.login_method || user.loginMethod || user.provider)}</span>
                              </>
                            ) : <span className="text-xs text-base-content/50">Chưa ghi nhận</span>}
                          </td>
                          <td className="min-w-44">
                            <div className="font-mono text-xs">{latestLogin?.ip_address || UNKNOWN}</div>
                            <div className="inline-flex items-center gap-1 mt-1 text-xs text-base-content/70"><MapPin size={11} /> {location}</div>
                          </td>
                          <td className="min-w-48">
                            <div className="inline-flex items-center gap-1 text-xs font-medium"><Monitor size={12} /> {latestLogin?.browser || UNKNOWN} {latestLogin?.browser_version !== UNKNOWN ? latestLogin?.browser_version : ""}</div>
                            <div className="text-[11px] text-base-content/60">{latestLogin ? `${latestLogin.os || UNKNOWN} · ${latestLogin.device || UNKNOWN}` : UNKNOWN}</div>
                            <div className="text-[10px] text-base-content/50 font-mono mt-0.5">Build: {latestLogin?.commit_hash || latestLogin?.build_id || "—"}</div>
                          </td>
                          <td>{user.disabled ? <span className="badge badge-error badge-sm gap-1"><Lock size={12} /> Đã khóa</span> : <span className="badge badge-success badge-sm gap-1"><Unlock size={12} /> Hoạt động</span>}</td>
                          <td>
                            {isOnline(user)
                              ? <span className="badge badge-success badge-sm gap-1 font-medium"><Activity size={12} /> Đang hoạt động · {user.activeSessions} phiên</span>
                              : <span className="text-xs text-base-content/70">{user.lastLogoutAt && new Date(user.lastLogoutAt) >= new Date(user.lastSeenAt || 0) ? "Đã đăng xuất" : relativeActivity(user.lastSeenAt)}</span>}
                          </td>
                          <td><span className="badge badge-outline badge-sm font-mono text-xs">{sourceLabel(latestLogin?.web_source || user.webSource)}</span></td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {currentRole !== "support" && currentRole !== "moderator" && (
                                <>
                                  <button
                                    type="button"
                                    className={`btn btn-xs ${user.disabled ? "btn-outline btn-success" : "btn-outline btn-warning"}`}
                                    onClick={() => setActionModal({ type: user.disabled ? "unlock" : "lock", user, reason: "" })}
                                    title={user.disabled ? "Mở khóa web" : "Khóa truy cập web"}
                                  >
                                    {user.disabled ? <Unlock size={12} /> : <Lock size={12} />}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline btn-error"
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
                                  className="btn btn-xs btn-outline btn-secondary"
                                  onClick={() => setActionModal({ type: "role", user, newRole: user.role || "user", reason: "" })}
                                  title="Gán quyền RBAC"
                                >
                                  RBAC
                                </button>
                              )}
                              <button type="button" className="btn btn-xs btn-ghost btn-circle" onClick={() => openUser(user)} title="Xem trọn bộ lịch sử đăng nhập">
                                <Info size={18} className="text-primary" />
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
              <p className="mt-3 text-xs text-base-content/60 text-center">
                Đang hiển thị {users.length}/{totalUsers} người dùng Locket Web
              </p>
            )}

            {!loading && !error && pageToken && !search.trim() && (
              <div className="mt-4 flex justify-center">
                <button type="button" className="btn btn-outline btn-sm rounded-full px-6" onClick={() => fetchUsers(pageToken)}>Tải thêm</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4 sm:p-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-base-200">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-base-content">
                📜 Nhật ký Quản trị Huy Locket (Append-only Audit Log)
              </h2>
              <p className="text-xs text-base-content/60 mt-1">
                Lưu vết toàn bộ thao tác nhạy cảm của các quản trị viên. Dữ liệu vĩnh viễn không thể tẩy xóa bởi admin thường.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Lưu vết thao tác (LOCK, REVOKE...)"
                className="input input-bordered input-sm text-xs rounded-lg"
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
              />
              <input
                type="text"
                placeholder="UID người thực hiện..."
                className="input input-bordered input-sm text-xs rounded-lg"
                value={auditFilterAdmin}
                onChange={(e) => setAuditFilterAdmin(e.target.value)}
              />
              <button type="button" onClick={fetchAuditLogs} className="btn btn-sm btn-ghost btn-circle" title="Tải lại log">
                <RefreshCw size={16} className={auditLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {auditLoading ? (
            <div className="py-16 text-center"><span className="loading loading-spinner loading-lg text-primary" /></div>
          ) : auditError ? (
            <div className="alert alert-error text-sm"><AlertTriangle size={16} /> <span>{auditError}</span></div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-16 text-base-content/60">
              <p className="font-semibold">Chưa có bản ghi Audit Log nào phù hợp</p>
              <p className="text-xs mt-1">Các thao tác khóa tài khoản, thu hồi phiên hay đổi quyền sẽ xuất hiện tự động tại đây.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200/50">
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
                      <td className="whitespace-nowrap font-mono text-xs">{formatDateTime(log.created_at)}</td>
                      <td>
                        <div className="font-mono text-xs font-semibold text-primary">{log.admin_uid}</div>
                        <div>{roleBadge(log.role)}</div>
                      </td>
                      <td><span className="badge badge-outline font-bold text-xs">{log.action}</span></td>
                      <td className="font-mono text-xs text-base-content/80">{log.target_uid || "—"}</td>
                      <td className="text-xs font-medium max-w-md break-words">{log.details || "—"}</td>
                      <td className="text-xs">
                        <div className="font-mono">{log.ip_address || UNKNOWN}</div>
                        <div className="text-[10px] text-base-content/60">{sourceLabel(log.web_source)}</div>
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
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4 sm:p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-base-200">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                🛡️ Quản lý Nội dung bị báo cáo
              </h2>
              <p className="text-xs text-base-content/60 mt-1">
                Dành cho Admin và Moderator xử lý vi phạm tiêu chuẩn cộng đồng.
              </p>
            </div>
            <button type="button" onClick={fetchReports} className="btn btn-sm btn-ghost btn-circle" title="Tải lại">
              <RefreshCw size={16} className={reportsLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {reportsLoading ? (
            <div className="py-16 text-center"><span className="loading loading-spinner loading-lg text-primary" /></div>
          ) : reportsError ? (
            <div className="alert alert-error text-sm"><AlertTriangle size={16} /> <span>{reportsError}</span></div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-base-content/60">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-semibold text-base">Không có nội dung vi phạm nào</p>
              <p className="text-xs text-base-content/50 mt-1">Môi trường Locket đang an an toàn và sạch sẽ.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200/50">
                    <th>ID Bài/Nội dung</th>
                    <th>Người báo cáo</th>
                    <th>Tác giả</th>
                    <th>Lý do vi phạm</th>
                    <th>Trạng thái</th>
                    <th className="text-right">Xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="hover">
                      <td className="font-mono text-xs font-semibold">{report.content_id}</td>
                      <td className="font-mono text-xs">{report.reporter_uid || "Ẩn danh"}</td>
                      <td className="font-mono text-xs">{report.author_uid || "—"}</td>
                      <td className="text-xs font-medium text-error">{report.reason || "Vi phạm tiêu chuẩn"}</td>
                      <td><span className="badge badge-warning badge-xs">Đang chờ</span></td>
                      <td className="text-right space-x-2">
                        <button type="button" onClick={() => handleResolveReport(report.id, "hidden")} className="btn btn-xs btn-outline btn-warning">Ẩn bài</button>
                        <button type="button" onClick={() => handleResolveReport(report.id, "deleted")} className="btn btn-xs btn-outline btn-error">Xóa mềm</button>
                        <button type="button" onClick={() => handleResolveReport(report.id, "dismissed")} className="btn btn-xs btn-ghost">Bỏ qua</button>
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
          <div className="modal-box max-w-5xl rounded-3xl p-6 shadow-2xl border border-base-200" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 text-base-content/60" onClick={() => setSelectedUser(null)}>✕</button>
            <h3 className="font-extrabold text-xl mb-1 flex items-center gap-2">
              {userName(selectedUser)}
              {roleBadge(selectedUser.role)}
            </h3>
            <p className="text-sm text-base-content/60">{selectedUser.email || selectedUser.username || "Không có email/username"}</p>
            <p className="text-xs text-base-content/40 mb-5 font-mono">UID: {selectedUser.uid}</p>

            {selectedUser.role === "super_admin" ? (
              <div className="alert alert-info bg-primary/10 border-primary/20 text-primary mb-5 text-sm rounded-xl">
                <span>👑 Tài khoản Super Admin được bảo vệ tuyệt đối, không thể khóa hay thu hồi.</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {currentRole !== "support" && currentRole !== "moderator" && (
                  <>
                    <button type="button" className={`btn btn-sm rounded-lg ${selectedUser.disabled ? "btn-success" : "btn-warning"}`} onClick={() => setActionModal({ type: selectedUser.disabled ? "unlock" : "lock", user: selectedUser, reason: "" })}>
                      {selectedUser.disabled ? <Unlock size={14} /> : <Lock size={14} />}
                      {selectedUser.disabled ? "Mở khóa truy cập" : "Khóa truy cập web"}
                    </button>
                    <button type="button" className="btn btn-sm btn-outline btn-error rounded-lg" onClick={() => setActionModal({ type: "revoke", user: selectedUser, reason: "" })}>
                      Thu hồi toàn bộ phiên web
                    </button>
                  </>
                )}
                {currentRole === "super_admin" && (
                  <button type="button" className="btn btn-sm btn-outline btn-secondary rounded-lg" onClick={() => setActionModal({ type: "role", user: selectedUser, newRole: selectedUser.role || "user", reason: "" })}>
                    Gán vai trò RBAC
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 text-sm">
              <div className="bg-base-200/50 rounded-xl p-3.5 border border-base-200"><Clock size={15} className="inline mr-1 text-primary" /> Đăng nhập: <span className="font-medium">{formatDateTime(selectedUser.lastSignInTime)}</span></div>
              <div className="bg-base-200/50 rounded-xl p-3.5 border border-base-200"><Activity size={15} className="inline mr-1 text-success" /> <span className="font-medium">{isOnline(selectedUser) ? `Đang hoạt động · ${selectedUser.activeSessions} phiên` : relativeActivity(selectedUser.lastSeenAt)}</span></div>
              <div className="bg-base-200/50 rounded-xl p-3.5 border border-base-200"><Monitor size={15} className="inline mr-1 text-secondary" /> Nguồn web: <span className="font-mono">{sourceLabel(selectedUser.webSource)}</span></div>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3 border-b border-base-200 pb-2">
              <h4 className="font-bold text-base flex items-center gap-2"><Clock size={18} className="text-primary" /> Lịch sử đăng nhập và Phiên web</h4>
              {(currentRole === "super_admin" || currentRole === "admin") && (
                <button
                  type="button"
                  className={`btn btn-xs btn-error btn-outline ${clearHistoryConfirm ? "animate-pulse font-bold" : ""}`}
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
                  <Trash2 size={13} />
                  {clearHistoryConfirm ? "Xác nhận xóa ngay" : "Xóa lịch sử"}
                </button>
              )}
            </div>

            {historyState === "loading" ? (
              <div className="py-10 text-center"><span className="loading loading-spinner loading-md text-primary" /></div>
            ) : historyState === "error" ? (
              <div className="alert alert-error text-sm"><AlertTriangle size={16} /><span>{historyError}</span></div>
            ) : historyState === "empty" ? (
              <div className="alert text-sm bg-base-200/50 border-base-200"><Info size={16} /><span>Chưa có lịch sử đăng nhập được ghi nhận từ khi bộ máy giám sát kích hoạt.</span></div>
            ) : (
              <div className="overflow-x-auto max-h-96 rounded-xl border border-base-200">
                <table className="table table-sm w-full">
                  <thead><tr className="bg-base-200/50"><th>Thời gian</th><th>IP máy chủ</th><th>Vị trí ước tính</th><th>Trình duyệt / thiết bị</th><th>Phương thức</th><th>Build / Commit</th><th>Nguồn</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {history.map((entry) => {
                      const entryOnline = !entry.ended_at && Date.now() - new Date(entry.last_seen_at).getTime() <= onlineWindowSeconds * 1000;
                      return (
                        <tr key={entry.event_id || entry.session_id} className="hover">
                          <td className="whitespace-nowrap text-xs">{formatDateTime(entry.created_at)}</td>
                          <td className="font-mono text-xs font-semibold text-primary">{entry.ip_address || UNKNOWN}</td>
                          <td><span className="inline-flex items-center gap-1 text-xs"><MapPin size={11} className="text-secondary" /> {[entry.city, entry.region, entry.country].filter((v) => v && v !== UNKNOWN).join(", ") || UNKNOWN}</span></td>
                          <td>{entry.browser || UNKNOWN} {entry.browser_version && entry.browser_version !== UNKNOWN ? entry.browser_version : ""}<br /><span className="text-[11px] text-base-content/60">{entry.os || UNKNOWN} · {entry.device || UNKNOWN}</span></td>
                          <td><span className="badge badge-ghost badge-xs">{loginMethodLabel(entry.login_method)}</span></td>
                          <td>{entry.web_version || "—"}<br /><span className="text-[10px] font-mono text-base-content/60">{entry.commit_hash || entry.build_id || "—"}</span></td>
                          <td><span className="badge badge-outline badge-xs font-mono">{sourceLabel(entry.web_source)}</span></td>
                          <td>{entry.ended_at ? <span className="badge badge-ghost badge-xs">Đã kết thúc</span> : entryOnline ? <span className="badge badge-success badge-xs">Đang hoạt động</span> : <span className="badge badge-warning badge-xs">Mất heartbeat</span>}</td>
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
          <div className="modal-box max-w-lg rounded-3xl p-6 border border-base-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg flex items-center gap-2 text-error mb-2">
              <AlertTriangle className="text-error" /> Xác nhận Thao tác Quản trị
            </h3>
            <p className="text-sm text-base-content/80 mb-4">
              Bạn đang thực hiện thao tác <strong className="uppercase text-primary">{actionModal.type}</strong> đối với tài khoản <strong>{userName(actionModal.user)}</strong>.
            </p>

            {actionModal.type === "role" && (
              <div className="form-control mb-4">
                <label className="label font-semibold text-sm">Chọn Vai Trò RBAC:</label>
                <select
                  className="select select-bordered w-full rounded-xl"
                  value={actionModal.newRole}
                  onChange={(e) => setActionModal({ ...actionModal, newRole: e.target.value })}
                >
                  <option value="super_admin">👑 Super Admin - Toàn quyền quản trị</option>
                  <option value="admin">🛡️ Admin - Quản lý user & vi phạm</option>
                  <option value="moderator">⚖️ Moderator - Chỉ xử lý vi phạm</option>
                  <option value="support">🎧 Support - Xem dữ liệu hỗ trợ cơ bản</option>
                  <option value="user">👤 User - Người dùng web thông thường</option>
                </select>
              </div>
            )}

            <div className="form-control mb-6">
              <label className="label font-semibold text-sm">
                <span>Lý do bắt buộc (Lưu vào Nhật ký Audit Log):</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24 rounded-xl text-sm"
                placeholder="Ví dụ: Phát hiện nghi vấn xâm phạm, Đổi quyền theo lệnh Super Admin..."
                value={actionModal.reason}
                onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
              />
            </div>

            <div className="modal-action flex items-center justify-end gap-2">
              <button type="button" className="btn btn-sm btn-ghost rounded-xl" onClick={() => setActionModal(null)}>Hủy bỏ</button>
              <button
                type="button"
                className={`btn btn-sm btn-primary rounded-xl px-6 ${Boolean(actionLoading) ? "loading" : ""}`}
                onClick={executeModalAction}
                disabled={Boolean(actionLoading)}
              >
                Xác nhận & Thực thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC MINH LẠI MẬT KHẨU LOCKET (PHIÊN QUẢN TRỊ 30 PHÚT) */}
      {reauthModalOpen && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setReauthModalOpen(false)}>
          <div className="modal-box max-w-md rounded-3xl p-6 border-2 border-primary/30 shadow-2xl bg-base-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg flex items-center gap-2 text-primary mb-2">
              🔐 Xác Minh Mật Khẩu Locket
            </h3>
            <p className="text-xs text-base-content/70 leading-relaxed mb-4">
              Để bảo vệ hệ thống tối cao, vui lòng xác minh lại mật khẩu tài khoản Locket hiện tại (<strong>{currentEmail || "Tài khoản của bạn"}</strong>). Phiên quản trị sẽ có hiệu lực trong <strong>30 phút</strong>. Mật khẩu không bao giờ được lưu lại trên máy chủ hoặc trình duyệt.
            </p>

            {reauthError && (
              <div className="alert alert-error text-xs py-2 mb-4 rounded-xl">
                <AlertTriangle size={15} /> <span>{reauthError}</span>
              </div>
            )}

            <form onSubmit={handleReauthSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label text-xs font-bold text-base-content/80">MẬT KHẨU TÀI KHOẢN LOCKET</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu của bạn..."
                  className="input input-bordered w-full rounded-xl pr-10 shadow-inner text-sm"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  disabled={reauthLoading}
                  autoFocus
                />
              </div>

              <div className="modal-action flex items-center justify-end gap-2 pt-2">
                <button type="button" className="btn btn-sm btn-ghost rounded-xl" onClick={() => { setReauthModalOpen(false); setPendingCallback(null); }} disabled={reauthLoading}>Hủy bỏ</button>
                <button type="submit" className="btn btn-sm btn-primary rounded-xl px-6 font-bold shadow-md" disabled={reauthLoading || !reauthPassword.trim()}>
                  {reauthLoading ? <span className="loading loading-spinner loading-xs" /> : "Xác minh & Mở khóa thao tác"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
