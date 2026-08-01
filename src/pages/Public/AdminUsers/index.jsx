import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Info,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Unlock,
  UserX,
} from "lucide-react";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import {
  adminRequest,
  clearAdminSession,
  hasAdminSession,
  signInAdmin,
  verifyAdminSession,
} from "@/services/AdminAuthService";

export default function AdminUsers() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(hasAdminSession());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [pageToken, setPageToken] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);

  const fetchUsers = useCallback(async (token = "") => {
    setLoading(true);
    setError(null);
    try {
      const query = token ? `&pageToken=${encodeURIComponent(token)}` : "";
      const data = await adminRequest(`/users?limit=50${query}`);
      setUsers(data.users || []);
      setPageToken(data.pageToken || null);
    } catch (requestError) {
      setError(`Không thể tải danh sách tài khoản quản trị. ${requestError.message}`);
    } finally {
      setLoading(false);
      setCheckingAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAdminSession()) {
      setCheckingAdmin(false);
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
        setError(requestError.message);
        setCheckingAdmin(false);
      });
    return () => {
      active = false;
    };
  }, [fetchUsers]);

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setSigningIn(true);
    setError(null);
    try {
      const verified = await signInAdmin(email, password);
      if (!verified) throw new Error("Tài khoản không có quyền admin");
      setPassword("");
      setIsAdmin(true);
      await fetchUsers();
    } catch (requestError) {
      setIsAdmin(false);
      setError(requestError.message || "Đăng nhập admin thất bại");
    } finally {
      setSigningIn(false);
      setCheckingAdmin(false);
    }
  };

  const handleAdminLogout = () => {
    clearAdminSession();
    setIsAdmin(false);
    setUsers([]);
    setSelectedUser(null);
  };

  const handleToggleLock = async (user) => {
    setActionLoading(`lock-${user.uid}`);
    try {
      const action = user.disabled ? "unlock" : "lock";
      await adminRequest(`/users/${encodeURIComponent(user.uid)}/${action}`, { method: "POST" });
      const nextDisabled = !user.disabled;
      setUsers((current) => current.map((entry) =>
        entry.uid === user.uid ? { ...entry, disabled: nextDisabled } : entry));
      setSelectedUser((current) =>
        current?.uid === user.uid ? { ...current, disabled: nextDisabled } : current);
      SonnerInfo(nextDisabled ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
    } catch (requestError) {
      SonnerInfo(`Lỗi thao tác: ${requestError.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAuth = async (user) => {
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1);
      return;
    }
    setActionLoading(`delete-${user.uid}`);
    try {
      await adminRequest(`/users/${encodeURIComponent(user.uid)}/auth`, { method: "DELETE" });
      setUsers((current) => current.filter((entry) => entry.uid !== user.uid));
      setSelectedUser(null);
      SonnerInfo("Đã xóa tài khoản quản trị");
    } catch (requestError) {
      SonnerInfo(`Lỗi thao tác: ${requestError.message}`);
    } finally {
      setActionLoading(null);
      setDeleteConfirmStep(0);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 animate-fade-in">
        <form className="card w-full max-w-sm bg-base-100 border border-base-200 shadow-xl" onSubmit={handleAdminLogin}>
          <div className="card-body">
            <h1 className="card-title">Đăng nhập quản trị Huy Locket</h1>
            <p className="text-sm text-base-content/60">
              Tài khoản admin riêng của dự án woww-7720f, không phải tài khoản Locket chính thức.
            </p>
            <label className="form-control w-full">
              <span className="label-text mb-1">Email admin</span>
              <input className="input input-bordered w-full" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="form-control w-full">
              <span className="label-text mb-1">Mật khẩu</span>
              <input className="input input-bordered w-full" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {error && <p className="text-sm text-error">{error}</p>}
            <button className="btn btn-primary w-full" type="submit" disabled={signingIn}>
              {signingIn && <span className="loading loading-spinner loading-sm" />}
              Đăng nhập admin
            </button>
          </div>
        </form>
      </div>
    );
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) =>
    user.displayName?.toLowerCase().includes(normalizedSearch)
    || user.email?.toLowerCase().includes(normalizedSearch)
    || user.uid.toLowerCase().includes(normalizedSearch));

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl animate-fade-in pt-20">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="text-primary" /> Quản lý quản trị viên
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Firebase Auth riêng của Huy Locket (woww-7720f)
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <input type="text" placeholder="Tìm email, tên, uid..." className="input input-bordered w-full pl-10" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
          </div>
          <button type="button" className="btn btn-ghost btn-circle" title="Đăng xuất admin" onClick={handleAdminLogout}><LogOut size={18} /></button>
        </div>
      </div>

      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr className="bg-base-200/50"><th>Quản trị viên</th><th>Phương thức</th><th>Trạng thái</th><th>Ngày tạo</th><th className="text-right">Thao tác</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></td></tr>
              ) : error ? (
                <tr><td colSpan="5" className="text-center py-12"><AlertTriangle size={32} className="mx-auto text-error mb-2" /><p className="text-error">{error}</p><button type="button" onClick={() => fetchUsers()} className="btn btn-sm btn-outline mt-4"><RefreshCw size={14} /> Thử lại</button></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-12 text-base-content/50">Không có tài khoản quản trị phù hợp.</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.uid} className="hover">
                  <td><div className="font-medium">{user.displayName || "Quản trị viên"}</div><div className="text-xs text-base-content/60">{user.email || user.uid}</div></td>
                  <td><span className="badge badge-ghost badge-sm">{user.provider}</span></td>
                  <td>{user.disabled ? <span className="badge badge-error badge-sm gap-1"><Lock size={12} /> Đã khóa</span> : <span className="badge badge-success badge-sm gap-1"><Unlock size={12} /> Hoạt động</span>}</td>
                  <td className="text-sm text-base-content/80">{new Date(user.creationTime).toLocaleDateString("vi-VN")}</td>
                  <td className="text-right"><button type="button" className="btn btn-sm btn-ghost btn-circle" onClick={() => { setSelectedUser(user); setDeleteConfirmStep(0); }} title="Xem chi tiết"><Info size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && !error && pageToken && !normalizedSearch && <div className="mt-4 flex justify-center"><button type="button" className="btn btn-outline btn-sm" onClick={() => fetchUsers(pageToken)}>Tải thêm</button></div>}

      {selectedUser && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setSelectedUser(null)}>
          <div className="modal-box max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setSelectedUser(null)}>✕</button>
            <h3 className="font-bold text-lg mb-1">{selectedUser.displayName || "Quản trị viên"}</h3>
            <p className="text-sm text-base-content/60 mb-1">{selectedUser.email || selectedUser.uid}</p>
            <p className="text-xs text-base-content/40 mb-6 font-mono">UID: {selectedUser.uid}</p>
            <div className="flex flex-wrap gap-2 mb-6">
              <button type="button" className={`btn btn-sm ${selectedUser.disabled ? "btn-success" : "btn-warning"}`} onClick={() => handleToggleLock(selectedUser)} disabled={Boolean(actionLoading)}>{actionLoading === `lock-${selectedUser.uid}` ? <span className="loading loading-spinner loading-xs" /> : selectedUser.disabled ? <Unlock size={14} /> : <Lock size={14} />}{selectedUser.disabled ? "Mở khóa" : "Khóa tài khoản"}</button>
              <button type="button" className={`btn btn-sm btn-error ${deleteConfirmStep === 1 ? "animate-pulse" : ""}`} onClick={() => handleDeleteAuth(selectedUser)} disabled={Boolean(actionLoading)}>{actionLoading === `delete-${selectedUser.uid}` ? <span className="loading loading-spinner loading-xs" /> : <UserX size={14} />}{deleteConfirmStep === 0 ? "Xóa tài khoản" : "Nhấn lại để xác nhận"}</button>
            </div>
            {deleteConfirmStep === 1 && <div className="alert alert-error mb-6 text-sm py-2"><AlertTriangle size={16} /><span>Thao tác này xóa vĩnh viễn tài khoản khỏi Firebase Auth riêng.</span></div>}
            <h4 className="font-semibold flex items-center gap-2 mb-3 border-b border-base-200 pb-2"><Clock size={16} /> Đăng nhập gần nhất</h4>
            {selectedUser.latestLoginData ? <div className="text-sm">{new Date(selectedUser.latestLoginData.created_at).toLocaleString("vi-VN")} · {selectedUser.latestLoginData.os} · {selectedUser.latestLoginData.browser}</div> : <p className="text-sm text-base-content/50">Chưa có lịch sử đăng nhập được ghi nhận.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
