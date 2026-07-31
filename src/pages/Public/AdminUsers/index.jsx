import React, { useState, useEffect } from "react";
import { Search, Lock, Unlock, UserX, Info, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/stores";
import api from "@/libs/axios";
import { SonnerInfo } from "@/components/uikit/SonnerToast";

export default function AdminUsers() {
  const user = useAuthStore((state) => state.user);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [pageToken, setPageToken] = useState(null);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);

  // 1. Kiểm tra Admin role từ API thật
  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const res = await api.get("/api/admin/verify");
        if (res.data?.isAdmin) {
          setIsAdmin(true);
          fetchUsers();
        } else {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
      } catch (err) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        setError(err.response?.data?.error || err.message);
      }
    };
    if (user) {
      verifyAdmin();
    } else {
      setCheckingAdmin(false);
    }
  }, [user]);

  // 2. Fetch danh sách Users thật
  const fetchUsers = async (token = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/admin/users?limit=50${token ? `&pageToken=${token}` : ""}`);
      setUsers(res.data.users || []);
      setPageToken(res.data.pageToken || null);
    } catch (err) {
      setError("Không thể tải danh sách người dùng. " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
      setCheckingAdmin(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center animate-fade-in">
        <AlertTriangle size={64} className="text-error mb-4" />
        <h1 className="text-2xl font-bold">Truy cập bị từ chối</h1>
        <p className="mt-2 text-base-content/70">{error || "Bạn không có quyền quản trị viên hệ thống."}</p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const s = search.toLowerCase();
    return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.uid?.toLowerCase().includes(s));
  });

  const handleOpenUser = (u) => {
    setSelectedUser(u);
    setHistoryLoading(true);
    setDeleteConfirmStep(0);
    // History is now fetched along with users (latestLoginData) for simplicity. 
    // If we wanted full history, we would call /api/admin/users/[uid]/history here.
    // For now, we just display the latest one attached to the user object.
    setHistoryLoading(false);
  };

  const handleToggleLock = async (u) => {
    setActionLoading(`lock-${u.uid}`);
    try {
      if (u.disabled) {
        await api.post(`/api/admin/users/${u.uid}/unlock`);
        SonnerInfo("Đã mở khóa tài khoản thành công");
      } else {
        await api.post(`/api/admin/users/${u.uid}/lock`);
        SonnerInfo("Đã khóa tài khoản thành công");
      }
      setUsers(users.map(user => user.uid === u.uid ? { ...user, disabled: !user.disabled } : user));
      if (selectedUser?.uid === u.uid) setSelectedUser({ ...selectedUser, disabled: !selectedUser.disabled });
    } catch (err) {
      SonnerInfo("Lỗi thao tác: " + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAuth = async (u) => {
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1);
      return;
    }
    setActionLoading(`delete-${u.uid}`);
    try {
      await api.delete(`/api/admin/users/${u.uid}/auth`);
      SonnerInfo("Đã xóa quyền đăng nhập thành công");
      setUsers(users.filter(user => user.uid !== u.uid));
      setSelectedUser(null);
    } catch (err) {
      SonnerInfo("Lỗi thao tác: " + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
      setDeleteConfirmStep(0);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl animate-fade-in pt-20">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="text-primary" /> Quản lý Người dùng
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Hệ thống quản trị tài khoản Firebase Auth
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <input 
            type="text" 
            placeholder="Tìm email, tên, uid..." 
            className="input input-bordered w-full pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
        </div>
      </div>

      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>Người dùng</th>
                <th>Phương thức</th>
                <th>Trạng thái</th>
                <th>Ngày tham gia</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-busy="true">
                    <td>
                      <div className="skeleton h-5 w-32 mb-1"></div>
                      <div className="skeleton h-3 w-24"></div>
                    </td>
                    <td><div className="skeleton h-6 w-20 rounded-full"></div></td>
                    <td><div className="skeleton h-6 w-16 rounded-full"></div></td>
                    <td><div className="skeleton h-5 w-24"></div></td>
                    <td className="text-right"><div className="skeleton h-8 w-8 inline-block rounded-full"></div></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan="5" className="text-center py-12">
                    <AlertTriangle size={32} className="mx-auto text-error mb-2 opacity-50" />
                    <p className="text-error">{error}</p>
                    <button onClick={() => fetchUsers()} className="btn btn-sm btn-outline mt-4">
                      <RefreshCw size={14} className="mr-1"/> Thử lại
                    </button>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-base-content/50">
                    {search ? "Không tìm thấy người dùng nào phù hợp." : "Hệ thống chưa có người dùng nào."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover">
                    <td>
                      <div className="font-medium">{u.displayName || "Người dùng ẩn danh"}</div>
                      <div className="text-xs text-base-content/60">{u.email || u.uid}</div>
                    </td>
                    <td>
                      <span className="badge badge-ghost badge-sm">{u.provider}</span>
                    </td>
                    <td>
                      {u.disabled ? (
                        <span className="badge badge-error badge-sm gap-1"><Lock size={12}/> Đã khóa</span>
                      ) : (
                        <span className="badge badge-success badge-sm gap-1"><Unlock size={12}/> Đang hoạt động</span>
                      )}
                    </td>
                    <td className="text-sm text-base-content/80">
                      {new Date(u.creationTime).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="text-right">
                      <button 
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={() => handleOpenUser(u)}
                        title="Xem chi tiết"
                      >
                        <Info size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination (nếu API có pageToken) */}
      {!loading && !error && pageToken && !search && (
         <div className="mt-4 flex justify-center">
            <button className="btn btn-outline btn-sm" onClick={() => fetchUsers(pageToken)}>
               Tải thêm người dùng
            </button>
         </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setSelectedUser(null)}>
          <div className="modal-box max-w-3xl" onClick={e => e.stopPropagation()}>
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setSelectedUser(null)}>✕</button>
            
            <h3 className="font-bold text-lg mb-1">{selectedUser.displayName || "Ẩn danh"}</h3>
            <p className="text-sm text-base-content/60 mb-1">{selectedUser.email || selectedUser.uid}</p>
            <p className="text-xs text-base-content/40 mb-6 font-mono">UID: {selectedUser.uid}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              <button 
                className={`btn btn-sm ${selectedUser.disabled ? "btn-success" : "btn-warning"}`}
                onClick={() => handleToggleLock(selectedUser)}
                disabled={actionLoading}
              >
                {actionLoading === `lock-${selectedUser.uid}` ? <span className="loading loading-spinner loading-xs"></span> : selectedUser.disabled ? <Unlock size={14} /> : <Lock size={14} />}
                {selectedUser.disabled ? "Mở khóa tài khoản" : "Khóa tài khoản"}
              </button>

              <button 
                className={`btn btn-sm btn-error ${deleteConfirmStep === 1 ? "animate-pulse" : ""}`}
                onClick={() => handleDeleteAuth(selectedUser)}
                disabled={actionLoading}
              >
                {actionLoading === `delete-${selectedUser.uid}` ? <span className="loading loading-spinner loading-xs"></span> : <UserX size={14} />}
                {deleteConfirmStep === 0 ? "Xóa quyền đăng nhập" : "Nhấn lại để Xác nhận Xóa"}
              </button>
            </div>

            {deleteConfirmStep === 1 && (
              <div className="alert alert-error mb-6 text-sm py-2">
                <AlertTriangle size={16} className="shrink-0"/> 
                <span><strong>Cảnh báo:</strong> Thao tác này chỉ xóa quyền Auth vĩnh viễn và thu hồi Token. Hồ sơ, media và bài đăng trên cơ sở dữ liệu sẽ vẫn được giữ nguyên. Vui lòng xác nhận.</span>
              </div>
            )}

            <h4 className="font-semibold flex items-center gap-2 mb-3 border-b border-base-200 pb-2">
              <Clock size={16} /> Lịch sử đăng nhập gần nhất
            </h4>

            {historyLoading ? (
              <div className="flex justify-center p-8"><span className="loading loading-spinner loading-md text-primary"></span></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th>Thời gian (Server)</th>
                      <th>IP & Vị trí</th>
                      <th>Thiết bị</th>
                      <th>Phương thức</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUser.latestLoginData ? (
                      <tr>
                        <td className="whitespace-nowrap">{new Date(selectedUser.latestLoginData.created_at).toLocaleString("vi-VN")}</td>
                        <td>
                          <div>{selectedUser.latestLoginData.ip_address}</div>
                          <div className="text-xs text-base-content/50">{selectedUser.latestLoginData.city}, {selectedUser.latestLoginData.country}</div>
                        </td>
                        <td>
                          <div>{selectedUser.latestLoginData.os} - {selectedUser.latestLoginData.browser}</div>
                          <div className="text-xs text-base-content/50">Build: {selectedUser.latestLoginData.build_version}</div>
                        </td>
                        <td><span className="badge badge-ghost badge-xs">{selectedUser.latestLoginData.login_method}</span></td>
                      </tr>
                    ) : (
                       <tr>
                          <td colSpan="4" className="text-center py-4 text-base-content/50 text-sm">Chưa có lịch sử đăng nhập nào được ghi nhận.</td>
                       </tr>
                    )}
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
