import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BellRing,
  FileClock,
  Image,
  RefreshCw,
  Send,
  Smartphone,
  Users,
  Video,
} from "lucide-react";
import { adminRequest } from "@/services/AdminAuthService";

function Metric({ icon: Icon, label, value, note }) {
  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/35 p-3">
      <div className="flex items-center gap-1.5 text-xs text-base-content/55">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {note && <div className="mt-1 text-[11px] text-base-content/45">{note}</div>}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
      <header className="border-b border-base-300 p-4 sm:p-5">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-xs text-base-content/55">{description}</p>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export default function AdminFeatureUsage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const result = await adminRequest("/ops-dashboard");
      setData(result?.data?.featureUsage || null);
    } catch (err) {
      setError(err?.message || "Không tải được số liệu sử dụng tính năng.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const activity = data?.activity || {};
  const uploads = data?.uploads || {};
  const drafts = data?.drafts || {};
  const pwa = data?.pwa || {};
  const channels = data?.channels || {};

  const draftBreakdown = useMemo(
    () => `${Number(drafts.images || 0)} ảnh · ${Number(drafts.videos || 0)} video`,
    [drafts.images, drafts.videos],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 text-base-content sm:px-4">
      <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-base-300 bg-base-100 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Sử dụng tính năng toàn server</h2>
          <p className="mt-1 text-xs text-base-content/55">
            Admin chỉ xem số liệu vận hành tổng hợp. Draft/Upload/PWA của từng người dùng vẫn được thao tác ở khu người dùng tương ứng.
          </p>
        </div>
        <button className="btn btn-sm btn-outline" disabled={loading} onClick={() => load()}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Làm mới
        </button>
      </div>

      {error && <div className="alert alert-error mb-4 py-2 text-sm">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Upload & bài đăng"
          description="Admin theo dõi bài đăng đã được backend ghi nhận thành công; hàng đợi upload vẫn là dữ liệu cục bộ của từng thiết bị."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric icon={Send} label="Bài xác nhận 24h" value={Number(uploads.confirmedPosts24h || 0)} />
            <Metric icon={Send} label="Bài xác nhận 7 ngày" value={Number(uploads.confirmedPosts7d || 0)} />
            <Metric icon={Users} label="User đăng trong 7 ngày" value={Number(uploads.postingUsers7d || 0)} />
          </div>
          <div className="mt-3 rounded-2xl bg-base-200/45 p-3 text-xs text-base-content/55">
            Nguồn: sự kiện <code>MOMENT_POST</code> đã được server ghi nhận. Không dùng trạng thái queue trên trình duyệt để giả làm số upload toàn hệ thống.
          </div>
        </Section>

        <Section
          title="Drafts 2.0"
          description="Chỉ thống kê bản nháp đang tồn tại trên kho draft phía server; không đọc caption hay nội dung media trong dashboard."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric icon={FileClock} label="Tổng draft" value={drafts.available === false ? "—" : Number(drafts.total || 0)} note={drafts.available === false ? "Kho draft server chưa sẵn sàng" : draftBreakdown} />
            <Metric icon={Users} label="User có draft" value={drafts.available === false ? "—" : Number(drafts.users || 0)} />
            <Metric icon={Activity} label="Cập nhật 24h" value={drafts.available === false ? "—" : Number(drafts.updatedLast24h || 0)} />
            <Metric icon={Image} label="Draft ảnh" value={drafts.available === false ? "—" : Number(drafts.images || 0)} />
            <Metric icon={Video} label="Draft video" value={drafts.available === false ? "—" : Number(drafts.videos || 0)} />
            <Metric icon={FileClock} label="Draft lỗi" value={drafts.available === false ? "—" : Number(drafts.failed || 0)} />
          </div>
        </Section>

        <Section
          title="Ứng dụng / PWA"
          description="Web không có cách đáng tin cậy để đếm mọi lượt cài PWA; dashboard dùng thiết bị Web Push đang đăng ký làm chỉ số vận hành thật."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric icon={Smartphone} label="Push device đang hoạt động" value={Number(pwa.activePushDevices || 0)} />
            <Metric icon={Smartphone} label="Tổng push device từng lưu" value={Number(pwa.totalPushDevices || 0)} />
            <Metric icon={Users} label="User có Web Push" value={Number(pwa.usersWithActivePush || 0)} />
          </div>
        </Section>

        <Section
          title="Hoạt động & kênh thông báo"
          description="Tổng hợp hành vi web và số user đang bật từng kênh thông báo; không hiển thị Chat ID, email hay secret."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric icon={Activity} label="Action 24h" value={Number(activity.actions24h || 0)} />
            <Metric icon={Users} label="User hoạt động 24h" value={Number(activity.activeUsers24h || 0)} />
            <Metric icon={BellRing} label="Telegram bật" value={Number(channels.telegramUsers || 0)} />
            <Metric icon={BellRing} label="Gmail bật" value={Number(channels.emailUsers || 0)} />
            <Metric icon={BellRing} label="Zalo bật" value={Number(channels.zaloUsers || 0)} />
          </div>
        </Section>
      </div>
    </div>
  );
}
