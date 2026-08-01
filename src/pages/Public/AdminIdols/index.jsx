import React, { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import api from "@/libs/axios";

const EMPTY_FORM = {
  locketUrl: "",
  displayName: "",
  username: "",
  countryCode: "OTHER",
  sortOrder: 0,
  enabled: true,
};

function getApiError(error) {
  const status = error?.response?.status || error?.status;
  const serverMessage = error?.response?.data?.message;
  if (status === 401) return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.";
  if (status === 403) return "Bạn không có quyền quản trị idol.";
  if (status === 409) return serverMessage || "Idol này đã có trong danh sách.";
  if (status === 429) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau.";
  if (status === 503) {
    return serverMessage || "Dịch vụ quản trị idol chưa được cấu hình.";
  }
  if (!error?.response) return "Không thể kết nối máy chủ.";
  return serverMessage || "Không thể xử lý dữ liệu idol.";
}

export default function AdminIdols() {
  const [idols, setIdols] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [error, setError] = useState("");

  const loadIdols = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("api/idols/admin");
      setIdols(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (requestError) {
      setIdols([]);
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdols();
  }, [loadIdols]);

  const updateField = (field) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (idol) => {
    setEditingId(idol.id);
    setForm({
      locketUrl: idol.locketUrl,
      displayName: idol.displayName,
      username: idol.username,
      countryCode: idol.countryCode,
      sortOrder: idol.sortOrder,
      enabled: idol.enabled,
    });
    setError("");
  };

  const submitIdol = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      sortOrder: Number(form.sortOrder),
    };

    try {
      const response = editingId
        ? await api.put(`api/idols/admin/${editingId}`, payload)
        : await api.post("api/idols/admin", payload);
      const saved = response.data?.data;
      if (!saved) throw new Error("INVALID_IDOL_RESPONSE");

      setIdols((current) => {
        const next = editingId
          ? current.map((idol) => (idol.id === saved.id ? saved : idol))
          : [...current, saved];
        return next.sort(
          (a, b) =>
            a.sortOrder - b.sortOrder ||
            a.displayName.localeCompare(b.displayName, "vi"),
        );
      });
      resetForm();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (idol) => {
    if (actionId) return;
    setActionId(idol.id);
    setError("");
    try {
      const response = await api.patch(`api/idols/admin/${idol.id}/enabled`, {
        enabled: !idol.enabled,
      });
      const saved = response.data?.data;
      setIdols((current) =>
        current.map((item) => (item.id === idol.id ? saved : item)),
      );
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setActionId(null);
    }
  };

  const deleteIdol = async (idol) => {
    if (deleteConfirmId !== idol.id) {
      setDeleteConfirmId(idol.id);
      return;
    }
    if (actionId) return;

    setActionId(idol.id);
    setError("");
    try {
      await api.delete(`api/idols/admin/${idol.id}`);
      setIdols((current) => current.filter((item) => item.id !== idol.id));
      if (editingId === idol.id) resetForm();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setActionId(null);
      setDeleteConfirmId(null);
    }
  };

  return (
    <main className="container mx-auto max-w-5xl p-4 pt-20 md:p-6 md:pt-20">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Star className="text-primary" aria-hidden="true" /> Quản lý idol
          </h1>
          <p className="mt-1 text-sm text-base-content/60">
            Dữ liệu được xác minh với Locket và lưu trong cơ sở dữ liệu.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={loadIdols}
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={loading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          <span>{error}</span>
        </div>
      )}

      <form
        className="mb-6 grid gap-3 rounded-xl border border-base-300 bg-base-100 p-4 md:grid-cols-2"
        onSubmit={submitIdol}
      >
        <label className="form-control md:col-span-2">
          <span className="label-text mb-1 font-medium">Liên kết Locket</span>
          <input
            type="url"
            className="input input-bordered w-full"
            value={form.locketUrl}
            onChange={updateField("locketUrl")}
            placeholder="Dán liên kết hồ sơ Locket thật"
            autoComplete="off"
            required
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1 font-medium">Tên hiển thị</span>
          <input
            type="text"
            className="input input-bordered w-full"
            value={form.displayName}
            onChange={updateField("displayName")}
            maxLength={120}
            placeholder="Tự lấy từ Locket nếu để trống"
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1 font-medium">Username</span>
          <input
            type="text"
            className="input input-bordered w-full"
            value={form.username}
            onChange={updateField("username")}
            maxLength={64}
            placeholder="Tự lấy từ liên kết nếu để trống"
            autoComplete="off"
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1 font-medium">Mã quốc gia</span>
          <input
            type="text"
            className="input input-bordered w-full uppercase"
            value={form.countryCode}
            onChange={updateField("countryCode")}
            maxLength={8}
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1 font-medium">Thứ tự</span>
          <input
            type="number"
            className="input input-bordered w-full"
            value={form.sortOrder}
            onChange={updateField("sortOrder")}
            min={-100000}
            max={100000}
          />
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={form.enabled}
            onChange={updateField("enabled")}
          />
          <span className="font-medium">Hiển thị cho người dùng</span>
        </label>

        <div className="flex justify-end gap-2 md:col-span-2">
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              <X size={16} aria-hidden="true" /> Hủy sửa
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <span className="loading loading-spinner loading-sm" />
            ) : editingId ? (
              <Save size={16} aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
            {editingId ? "Lưu idol" : "Thêm idol"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Idol</th>
              <th>Quốc gia</th>
              <th>Thứ tự</th>
              <th>Hiển thị</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} aria-busy="true">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-10 w-10 rounded-full" />
                      <div>
                        <div className="skeleton mb-1 h-4 w-28" />
                        <div className="skeleton h-3 w-20" />
                      </div>
                    </div>
                  </td>
                  <td><div className="skeleton h-5 w-12" /></td>
                  <td><div className="skeleton h-5 w-10" /></td>
                  <td><div className="skeleton h-6 w-14 rounded-full" /></td>
                  <td><div className="ml-auto skeleton h-8 w-20" /></td>
                </tr>
              ))
            ) : idols.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-10 text-center text-base-content/60">
                  Chưa có idol nào trong cơ sở dữ liệu.
                </td>
              </tr>
            ) : (
              idols.map((idol) => (
                <tr key={idol.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <img
                        src={idol.avatarUrl || "/images/default_profile.png"}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium">{idol.displayName}</div>
                        <a
                          href={idol.locketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline"
                        >
                          @{idol.username}
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td>{idol.countryCode}</td>
                  <td>{idol.sortOrder}</td>
                  <td>
                    <button
                      type="button"
                      className={`btn btn-xs ${idol.enabled ? "btn-success" : "btn-ghost"}`}
                      onClick={() => toggleEnabled(idol)}
                      disabled={actionId === idol.id}
                      aria-pressed={idol.enabled}
                    >
                      {actionId === idol.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : idol.enabled ? (
                        "Bật"
                      ) : (
                        "Tắt"
                      )}
                    </button>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={() => startEdit(idol)}
                        aria-label={`Sửa ${idol.displayName}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          deleteConfirmId === idol.id
                            ? "btn-error"
                            : "btn-ghost btn-circle"
                        }`}
                        onClick={() => deleteIdol(idol)}
                        disabled={actionId === idol.id}
                        aria-label={`Xóa ${idol.displayName}`}
                      >
                        {actionId === idol.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2 size={16} aria-hidden="true" />
                        )}
                        {deleteConfirmId === idol.id && "Xác nhận"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
