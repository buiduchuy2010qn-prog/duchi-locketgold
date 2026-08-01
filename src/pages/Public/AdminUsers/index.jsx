import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Info,
  Lock,
  RefreshCw,
  Search,
  Unlock,
  UserX,
} from "lucide-react";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import {
  adminRequest,
  hasAdminSession,
  verifyAdminSession,
} from "@/services/AdminAuthService";

export default function AdminUsers() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(hasAdminSession());
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
      setError(`Không thể tải danh sách người dùng. ${requestError.message}`);
    } finally {
      setLoading(false);
      setCheckingAdmin(false);
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
        SonnerInfo(requestError.status === 403
          ? "Tài khoản này không có quyền quản trị"
          : "Phiên đăng nhập đã hết hạn");
        navigate("/locket", { replace: true });
      });
    return () => {
      active = false;
    };
  }, [fetchUsers, navigate]);

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
      SonnerInfo("Đã xóa tài khoản người dùng");
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
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
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
            <Lock className="text-primary" /> Quản lý người dùng
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Chỉ tài khoản Huy Locket được cấp quyền admin mới truy cập được
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <input type="text" placeholder="Tìm email, tên, uid..." className="input input-bordered w-full pl-10" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
          </div>
        </div>
      </div>

      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr className="bg-base-200/50"><th>Người dùng</th><th>Phương thức</th><th>Trạng thái</th><th>Ngày tạo</th><th className="text-right">Thao tác</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></td></tr>
              ) : error ? (
                <tr><td colSpan="5" className="text-center py-12"><AlertTriangle size={32} className="mx-auto text-error mb-2" /><p className="text-error">{error}</p><button type="button" onClick={() => fetchUsers()} className="btn btn-sm btn-outline mt-4"><RefreshCw size={14} /> Thử lại</button></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-12 text-base-content/50">Không có người dùng phù hợp.</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.uid} className="hover">
                  <td><div className="font-medium">{user.displayName || "Người dùng"}</div><div className="text-xs text-base-content/60">{user.email || user.uid}</div></td>
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
            <h3 className="font-bold text-lg mb-1">{selectedUser.displayName || "Người dùng"}</h3>
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
