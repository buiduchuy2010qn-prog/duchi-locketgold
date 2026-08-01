import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Clock,
  Info,
  Lock,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
} from "lucide-react";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import {
  adminRequest,
  hasAdminSession,
  verifyAdminSession,
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

function errorMessage(error) {
  if (error?.code === "DATABASE_NOT_CONFIGURED") {
    return "Database theo dõi người dùng chưa được cấu hình trên Railway API.";
  }
  if (error?.status === 403) return "Tài khoản này không có quyền xem dữ liệu quản trị.";
  if (error?.status === 401) return "Phiên đăng nhập đã hết hạn.";
  return `Không thể tải danh sách người dùng. ${error?.message || "Lỗi không xác định"}`;
}

function historyErrorMessage(error) {
  if (error?.code === "DATABASE_NOT_CONFIGURED") {
    return "Database lịch sử đăng nhập chưa được cấu hình trên Railway API.";
  }
  if (error?.status === 403) return "Bạn không có quyền xem lịch sử đăng nhập.";
  if (error?.status === 401) return "Phiên đăng nhập đã hết hạn.";
  return `Không thể tải lịch sử đăng nhập. ${error?.message || "Lỗi không xác định"}`;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(hasAdminSession());
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

  useEffect(() => {
    if (!hasAdminSession()) {
      setCheckingAdmin(false);
      navigate("/login", { replace: true });
      return undefined;
    }

    let active = true;
    verifyAdminSession()
      .then((verified) => {
        if (!active) return;
        setIsAdmin(verified);
        if (verified) fetchUsers();
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
    if (!isAdmin) return undefined;
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
  }, [fetchUsers, isAdmin]);

  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) =>
      user.displayName?.toLowerCase().includes(normalized)
      || user.username?.toLowerCase().includes(normalized)
      || user.email?.toLowerCase().includes(normalized)
      || user.uid.toLowerCase().includes(normalized));
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
      setHistoryError(historyErrorMessage(requestError));
      setHistoryState("error");
    }
  };

  const handleToggleLock = async (user) => {
    setActionLoading(`lock-${user.uid}`);
    try {
      const action = user.disabled ? "unlock" : "lock";
      await adminRequest(`/users/${encodeURIComponent(user.uid)}/${action}`, { method: "POST" });
      const nextDisabled = !user.disabled;
      const update = (entry) => entry.uid === user.uid
        ? { ...entry, disabled: nextDisabled, accountStatus: nextDisabled ? "locked" : "active" }
        : entry;
      setUsers((current) => current.map(update));
      setSelectedUser((current) => current ? update(current) : current);
      SonnerInfo(nextDisabled ? "Đã khóa quyền truy cập Huy Locket" : "Đã mở khóa quyền truy cập Huy Locket");
    } catch (requestError) {
      SonnerInfo(`Lỗi thao tác: ${requestError.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearHistory = async () => {
    if (!selectedUser) return;
    if (!clearHistoryConfirm) {
      setClearHistoryConfirm(true);
      return;
    }
    setActionLoading(`history-${selectedUser.uid}`);
    try {
      const data = await adminRequest(`/users/${encodeURIComponent(selectedUser.uid)}/login-history`, {
        method: "DELETE",
      });
      setHistory([]);
      setHistoryState("empty");
      setClearHistoryConfirm(false);
      setUsers((current) => current.map((entry) => entry.uid === selectedUser.uid
        ? { ...entry, latestLoginData: null }
        : entry));
      SonnerInfo(`Đã xóa ${data.deleted || 0} sự kiện đăng nhập`);
    } catch (requestError) {
      SonnerInfo(`Không thể xóa lịch sử: ${requestError.message}`);
    } finally {
      setActionLoading(null);
    }
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="text-primary" /> Quản lý người dùng
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            {totalUsers} người dùng Huy Locket được ghi nhận bằng token đã xác minh phía server · Tự cập nhật trong tối đa 5 giây
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <input type="text" placeholder="Tìm email, tên, username, uid..." className="input input-bordered w-full pl-10" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
        </div>
      </div>

      <div className="alert alert-info mb-4 text-sm">
        <Info size={18} />
        <span>Người dùng cũ chỉ được bổ sung khi có dấu vết xác thực thật trong log còn lưu. IP, vị trí và trình duyệt chỉ có từ những lần đăng nhập sau khi hệ thống theo dõi được kích hoạt.</span>
      </div>

      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>Người dùng</th>
                <th>Đăng nhập gần nhất</th>
                <th>IP / vị trí</th>
                <th>Trình duyệt / phiên bản</th>
                <th>Tài khoản</th>
                <th>Hoạt động gần nhất</th>
                <th>Nguồn web</th>
                <th>Ghi nhận từ</th>
                <th className="text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></td></tr>
              ) : error ? (
                <tr><td colSpan="9" className="text-center py-12"><AlertTriangle size={32} className="mx-auto text-error mb-2" /><p className="text-error">{error.message}</p><button type="button" onClick={() => fetchUsers()} className="btn btn-sm btn-outline mt-4"><RefreshCw size={14} /> Thử lại</button></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-12 text-base-content/50">Chưa có người dùng website đã xác thực phù hợp.</td></tr>
              ) : filteredUsers.map((user) => {
                const latestLogin = user.latestLoginData;
                const location = latestLogin
                  ? [latestLogin.city, latestLogin.region, latestLogin.country]
                    .filter((value) => value && value !== UNKNOWN)
                    .join(", ") || UNKNOWN
                  : UNKNOWN;
                return (
                  <tr key={user.uid} className="hover">
                  <td>
                    <div className="font-medium flex items-center gap-2">
                      {userName(user)}
                      {user.isAdmin && <span className="badge badge-primary badge-xs font-bold">ADMIN</span>}
                      {!user.displayName && !user.username && <span className="badge badge-ghost badge-xs">UID thật · chưa có tên</span>}
                    </div>
                    <div className="text-xs text-base-content/60">{user.email || user.username || user.uid}</div>
                  </td>
                  <td className="min-w-40">
                    {latestLogin ? (
                      <>
                        <div className="text-sm whitespace-nowrap">{formatDateTime(latestLogin.created_at)}</div>
                        <span className="badge badge-ghost badge-xs mt-1">{loginMethodLabel(latestLogin.login_method || user.loginMethod || user.provider)}</span>
                      </>
                    ) : <span className="text-sm text-base-content/50">Chưa ghi nhận</span>}
                  </td>
                  <td className="min-w-48">
                    <div className="font-mono text-xs">{latestLogin?.ip_address || UNKNOWN}</div>
                    <div className="inline-flex items-center gap-1 mt-1 text-xs text-base-content/70"><MapPin size={12} /> {location}</div>
                  </td>
                  <td className="min-w-52">
                    <div className="inline-flex items-center gap-1 text-sm"><Monitor size={13} /> {latestLogin?.browser || UNKNOWN}{latestLogin?.browser_version && latestLogin.browser_version !== UNKNOWN ? ` ${latestLogin.browser_version}` : ""}</div>
                    <div className="text-xs text-base-content/60">{latestLogin ? `${latestLogin.os || UNKNOWN} · ${latestLogin.device || UNKNOWN}` : UNKNOWN}</div>
                    <div className="text-xs text-base-content/50 mt-1">Web {latestLogin?.web_version || "—"} · <span className="font-mono">{latestLogin?.commit_hash || latestLogin?.build_id || "—"}</span></div>
                  </td>
                  <td>{user.disabled ? <span className="badge badge-error badge-sm gap-1"><Lock size={12} /> Đã khóa</span> : <span className="badge badge-success badge-sm gap-1"><Unlock size={12} /> Hoạt động</span>}</td>
                  <td>
                    {isOnline(user)
                      ? <span className="badge badge-success badge-sm gap-1"><Activity size={12} /> Đang hoạt động · {user.activeSessions} phiên</span>
                      : <span className="text-sm text-base-content/70">{user.lastLogoutAt && new Date(user.lastLogoutAt) >= new Date(user.lastSeenAt || 0) ? "Đã đăng xuất" : relativeActivity(user.lastSeenAt)}</span>}
                  </td>
                  <td><span className="badge badge-outline badge-sm">{sourceLabel(latestLogin?.web_source || user.webSource)}</span></td>
                  <td className="text-sm">{formatDate(user.creationTime)}</td>
                  <td className="text-right"><button type="button" className="btn btn-sm btn-ghost btn-circle" onClick={() => openUser(user)} title="Xem chi tiết"><Info size={18} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && !error && (
        <p className="mt-3 text-xs text-base-content/60 text-center">
          Đang hiển thị {users.length}/{totalUsers} người dùng đã xác minh
        </p>
      )}

      {!loading && !error && pageToken && !search.trim() && (
        <div className="mt-4 flex justify-center">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => fetchUsers(pageToken)}>Tải thêm</button>
        </div>
      )}

      {selectedUser && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setSelectedUser(null)}>
          <div className="modal-box max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setSelectedUser(null)}>✕</button>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
              {userName(selectedUser)}
              {selectedUser.isAdmin && <span className="badge badge-primary badge-sm">ADMIN</span>}
            </h3>
            <p className="text-sm text-base-content/60">{selectedUser.email || selectedUser.username || "Không có email/username"}</p>
            <p className="text-xs text-base-content/40 mb-5 font-mono">UID: {selectedUser.uid}</p>

            {selectedUser.isAdmin ? (
              <div className="alert alert-info bg-primary/10 border-primary/20 text-primary mb-5 text-sm">
                <span>🛡️ Tài khoản quản trị được bảo vệ khỏi thao tác khóa.</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-5">
                <button type="button" className={`btn btn-sm ${selectedUser.disabled ? "btn-success" : "btn-warning"}`} onClick={() => handleToggleLock(selectedUser)} disabled={Boolean(actionLoading)}>
                  {actionLoading === `lock-${selectedUser.uid}` ? <span className="loading loading-spinner loading-xs" /> : selectedUser.disabled ? <Unlock size={14} /> : <Lock size={14} />}
                  {selectedUser.disabled ? "Mở khóa" : "Khóa truy cập web"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 text-sm">
              <div className="bg-base-200/50 rounded-lg p-3"><Clock size={15} className="inline mr-1" /> Đăng nhập: {formatDateTime(selectedUser.lastSignInTime)}</div>
              <div className="bg-base-200/50 rounded-lg p-3"><Activity size={15} className="inline mr-1" /> {isOnline(selectedUser) ? `Đang hoạt động · ${selectedUser.activeSessions} phiên` : relativeActivity(selectedUser.lastSeenAt)}</div>
              <div className="bg-base-200/50 rounded-lg p-3"><Monitor size={15} className="inline mr-1" /> {sourceLabel(selectedUser.webSource)}</div>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3 border-b border-base-200 pb-2">
              <h4 className="font-semibold flex items-center gap-2"><Clock size={16} /> Lịch sử đăng nhập</h4>
              <button type="button" className={`btn btn-xs btn-error btn-outline ${clearHistoryConfirm ? "animate-pulse" : ""}`} onClick={handleClearHistory} disabled={historyState === "loading" || history.length === 0 || Boolean(actionLoading)}>
                {actionLoading === `history-${selectedUser.uid}` ? <span className="loading loading-spinner loading-xs" /> : <Trash2 size={13} />}
                {clearHistoryConfirm ? "Xác nhận xóa lịch sử" : "Xóa lịch sử"}
              </button>
            </div>

            {historyState === "loading" ? (
              <div className="py-10 text-center"><span className="loading loading-spinner loading-md text-primary" /></div>
            ) : historyState === "error" ? (
              <div className="alert alert-error text-sm"><AlertTriangle size={16} /><span>{historyError}</span></div>
            ) : historyState === "empty" ? (
              <div className="alert text-sm"><Info size={16} /><span>Chưa từng có lịch sử thật được ghi nhận. Lịch sử chỉ bắt đầu từ khi hệ thống theo dõi được kích hoạt.</span></div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="table table-sm">
                  <thead><tr><th>Thời gian</th><th>IP</th><th>Vị trí ước tính</th><th>Trình duyệt / thiết bị</th><th>Phương thức</th><th>Build</th><th>Nguồn</th><th>Phiên</th></tr></thead>
                  <tbody>
                    {history.map((entry) => {
                      const entryOnline = !entry.ended_at && Date.now() - new Date(entry.last_seen_at).getTime() <= onlineWindowSeconds * 1000;
                      return (
                        <tr key={entry.event_id || entry.session_id}>
                          <td className="whitespace-nowrap">{formatDateTime(entry.created_at)}</td>
                          <td className="font-mono text-xs">{entry.ip_address || UNKNOWN}</td>
                          <td><span className="inline-flex items-center gap-1"><MapPin size={12} /> {[entry.city, entry.region, entry.country].filter((value) => value && value !== UNKNOWN).join(", ") || UNKNOWN}</span></td>
                          <td>{entry.browser || UNKNOWN} {entry.browser_version && entry.browser_version !== UNKNOWN ? entry.browser_version : ""}<br /><span className="text-xs text-base-content/60">{entry.os || UNKNOWN} · {entry.device || UNKNOWN}</span></td>
                          <td>{loginMethodLabel(entry.login_method)}</td>
                          <td>{entry.web_version || "—"}<br /><span className="text-xs font-mono">{entry.commit_hash || entry.build_id || "—"}</span></td>
                          <td>{sourceLabel(entry.web_source)}</td>
                          <td>{entry.ended_at ? <span className="badge badge-ghost badge-xs">Đã đăng xuất</span> : entryOnline ? <span className="badge badge-success badge-xs">Đang hoạt động</span> : <span className="badge badge-warning badge-xs">Mất heartbeat</span>}</td>
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
    </div>
  );
}
