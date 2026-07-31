import React, { useState, useEffect } from "react";
import { Search, Lock, Unlock, UserX, Info, Clock, AlertTriangle, LogIn } from "lucide-react";
import { useAuthStore } from "@/stores";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";
import { isAdminUser } from "@/utils/googleDrive";

const MOCK_USERS = [
  { id: "user_1", name: "Nguyễn Văn A", email: "nva@gmail.com", method: "google.com", isLocked: false, lastLogin: "2026-07-31T10:00:00Z" },
  { id: "user_2", name: "Trần Thị B", email: "ttb@gmail.com", method: "password", isLocked: true, lastLogin: "2026-07-30T15:30:00Z" },
  { id: "user_3", name: "Lê Văn C", email: "lvc@gmail.com", method: "apple.com", isLocked: false, lastLogin: "2026-07-29T08:15:00Z" },
  { id: "user_4", name: "Phạm Thị D", email: "ptd@gmail.com", method: "google.com", isLocked: false, lastLogin: "2026-07-28T14:45:00Z" },
];

const MOCK_HISTORY = [
  { id: 1, time: "2026-07-31T10:00:00Z", ip: "113.190.233.12", location: "Hà Nội, VN (Ước tính)", browser: "Chrome 114", os: "Windows 11", build: "v1.4.0-fef3b41", method: "google.com" },
  { id: 2, time: "2026-07-30T09:12:00Z", ip: "113.190.233.45", location: "Hà Nội, VN (Ước tính)", browser: "Safari 16.5", os: "iOS 16.5", build: "v1.4.0-c1e042c", method: "google.com" },
];

export default function AdminUsers() {
  const user = useAuthStore((state) => state.user);
  const localId = getMyLocalId(user);
  const email = user?.email || localStorage.getItem("email") || sessionStorage.getItem("email") || "";
  const isAdmin = Boolean(user) && isAdminUser(localId, { email, localId, uid: user?.uid || localId });

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      // Giả lập gọi API lấy danh sách
      setTimeout(() => {
        setUsers(MOCK_USERS);
        setLoading(false);
      }, 800);
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle size={64} className="text-error mb-4" />
        <h1 className="text-2xl font-bold">Truy cập bị từ chối</h1>
        <p className="mt-2 text-base-content/70">Bạn không có quyền quản trị viên hoặc chưa đăng nhập.</p>
        <p className="mt-4 text-sm text-warning italic border border-warning/30 bg-warning/10 p-3 rounded-lg max-w-lg">
          Lưu ý: Màn hình này hiện đang chạy Mockup UI (dữ liệu giả) trên Client vì hệ thống chưa có Admin API Backend thực sự.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenUser = (u) => {
    setSelectedUser(u);
    setHistoryLoading(true);
    setDeleteConfirmStep(0);
    // Giả lập load history
    setTimeout(() => {
      setHistoryLoading(false);
    }, 600);
  };

  const handleToggleLock = (u) => {
    setActionLoading(`lock-${u.id}`);
    setTimeout(() => {
      setUsers(users.map(user => user.id === u.id ? { ...user, isLocked: !user.isLocked } : user));
      if (selectedUser?.id === u.id) setSelectedUser({ ...selectedUser, isLocked: !selectedUser.isLocked });
      setActionLoading(null);
    }, 800);
  };

  const handleDeleteAuth = (u) => {
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1);
      return;
    }
    setActionLoading(`delete-${u.id}`);
    setTimeout(() => {
      setUsers(users.filter(user => user.id !== u.id));
      setSelectedUser(null);
      setActionLoading(null);
    }, 1000);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl animate-fade-in pt-20">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="text-primary" /> Quản lý Người dùng (Mockup)
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Chỉ hiển thị với Admin. Dữ liệu đang được giả lập.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <input 
            type="text" 
            placeholder="Tìm email, tên..." 
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
                <th>Đăng nhập cuối</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} aria-busy="true">
                    <td><div className="skeleton h-10 w-32"></div></td>
                    <td><div className="skeleton h-6 w-20"></div></td>
                    <td><div className="skeleton h-6 w-16"></div></td>
                    <td><div className="skeleton h-6 w-24"></div></td>
                    <td className="text-right"><div className="skeleton h-8 w-8 inline-block"></div></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-base-content/50">
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover">
                    <td>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-base-content/60">{u.email}</div>
                    </td>
                    <td>
                      <span className="badge badge-ghost badge-sm">{u.method}</span>
                    </td>
                    <td>
                      {u.isLocked ? (
                        <span className="badge badge-error badge-sm gap-1"><Lock size={12}/> Đã khóa</span>
                      ) : (
                        <span className="badge badge-success badge-sm gap-1"><Unlock size={12}/> Đang hoạt động</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {new Date(u.lastLogin).toLocaleDateString("vi-VN", { hour: '2-digit', minute:'2-digit' })}
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

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setSelectedUser(null)}>
          <div className="modal-box max-w-3xl" onClick={e => e.stopPropagation()}>
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setSelectedUser(null)}>✕</button>
            
            <h3 className="font-bold text-lg mb-1">{selectedUser.name}</h3>
            <p className="text-sm text-base-content/60 mb-6">{selectedUser.email}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              <button 
                className={`btn btn-sm ${selectedUser.isLocked ? "btn-success" : "btn-warning"}`}
                onClick={() => handleToggleLock(selectedUser)}
                disabled={actionLoading}
              >
                {actionLoading === `lock-${selectedUser.id}` ? <span className="loading loading-spinner loading-xs"></span> : selectedUser.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                {selectedUser.isLocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
              </button>

              <button 
                className={`btn btn-sm btn-error ${deleteConfirmStep === 1 ? "animate-pulse" : ""}`}
                onClick={() => handleDeleteAuth(selectedUser)}
                disabled={actionLoading}
              >
                {actionLoading === `delete-${selectedUser.id}` ? <span className="loading loading-spinner loading-xs"></span> : <UserX size={14} />}
                {deleteConfirmStep === 0 ? "Xóa quyền đăng nhập" : "Nhấn lại để Xác nhận Xóa"}
              </button>
            </div>

            {deleteConfirmStep === 1 && (
              <div className="alert alert-error mb-6 text-sm py-2">
                <AlertTriangle size={16}/> 
                <span><strong>Cảnh báo:</strong> Thao tác này chỉ xóa tài khoản Auth. Hồ sơ, media và bài đăng vẫn được giữ nguyên. Vui lòng xác nhận.</span>
              </div>
            )}

            <h4 className="font-semibold flex items-center gap-2 mb-3 border-b border-base-200 pb-2">
              <Clock size={16} /> Lịch sử đăng nhập
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
                    {MOCK_HISTORY.map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap">{new Date(h.time).toLocaleString("vi-VN")}</td>
                        <td>
                          <div>{h.ip}</div>
                          <div className="text-xs text-base-content/50">{h.location}</div>
                        </td>
                        <td>
                          <div>{h.os} - {h.browser}</div>
                          <div className="text-xs text-base-content/50">Build: {h.build}</div>
                        </td>
                        <td><span className="badge badge-ghost badge-xs">{h.method}</span></td>
                      </tr>
                    ))}
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
