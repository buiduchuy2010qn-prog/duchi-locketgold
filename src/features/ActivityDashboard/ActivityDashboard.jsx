import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Flame,
  HardDrive,
  Image,
  RefreshCw,
  Users,
  Video,
} from "lucide-react";
import { useAuthStore, useStreakStore, useUploadQueueStore } from "@/stores";

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function lastDays(count) {
  const rows = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    rows.push({
      key: dateKey(d),
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      count: 0,
    });
  }
  return rows;
}

function numberFrom(obj, keys) {
  for (const key of keys) {
    const value = Number(obj?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export default function ActivityDashboard() {
  const user = useAuthStore((s) => s.user);
  const uploadStats = useAuthStore((s) => s.uploadStats);
  const fetchUserData = useAuthStore((s) => s.fetchUserData);
  const postedMoments = useUploadQueueStore((s) => s.postedMoments);
  const hydrateUploadQueue = useUploadQueueStore((s) => s.hydrateUploadQueue);
  const streak = useStreakStore((s) => s.streak);
  const fetchStreak = useStreakStore((s) => s.fetchStreak);
  const [range, setRange] = useState(7);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    hydrateUploadQueue();
    fetchStreak();
  }, [fetchStreak, hydrateUploadQueue]);

  const imageCount = numberFrom(uploadStats, ["image_uploaded", "image_uploads", "images"]);
  const videoCount = numberFrom(uploadStats, ["video_uploaded", "video_uploads", "videos"]);
  const totalCount = numberFrom(uploadStats, ["total_uploaded", "total_uploads"]) || imageCount + videoCount;
  const storageMb = numberFrom(uploadStats, ["total_storage_used_mb", "storage_used_mb"]);
  const friendCount = numberFrom(user, ["friendCount", "friendsCount", "numFriends", "friends_count"]);
  const streakCount = numberFrom(streak, ["count", "current_streak", "streak_count"]);

  const chart = useMemo(() => {
    const rows = lastDays(range);
    const map = new Map(rows.map((row) => [row.key, row]));
    for (const moment of postedMoments || []) {
      const key = dateKey(moment.createdAt || moment.createTime || moment.date);
      if (map.has(key)) map.get(key).count += 1;
    }
    return rows;
  }, [postedMoments, range]);

  const maxCount = Math.max(1, ...chart.map((item) => item.count));
  const busiest = chart.reduce(
    (best, row) => (row.count > (best?.count || 0) ? row : best),
    null,
  );

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([fetchUserData(), hydrateUploadQueue(), fetchStreak()]);
    } finally {
      setRefreshing(false);
    }
  };

  const stats = [
    { label: "Tổng bài", value: totalCount || "—", icon: CalendarDays },
    { label: "Ảnh", value: imageCount || "—", icon: Image },
    { label: "Video", value: videoCount || "—", icon: Video },
    { label: "Streak", value: streakCount || "—", icon: Flame },
    { label: "Bạn bè", value: friendCount || "—", icon: Users },
    { label: "Storage", value: storageMb ? `${storageMb.toFixed(1)} MB` : "—", icon: HardDrive },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 text-base-content">
      <section className="overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-lg">
        <header className="border-b border-base-300 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Hoạt động Locket</h2>
              <p className="mt-1 text-sm text-base-content/60">
                Số liệu tài khoản lấy từ API; biểu đồ ngày dùng lịch sử bài đã đăng qua Huy Locket trên thiết bị này.
              </p>
            </div>
            <button className="btn btn-sm btn-outline" disabled={refreshing} onClick={refresh}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Làm mới
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-base-300 bg-base-200/35 p-3">
                <div className="flex items-center gap-1 text-xs text-base-content/55"><Icon className="h-3.5 w-3.5" /> {label}</div>
                <div className="mt-1 text-xl font-bold">{value}</div>
              </div>
            ))}
          </div>
        </header>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">Nhịp đăng bài</h3>
              <p className="text-xs text-base-content/50">
                {busiest?.count ? `Ngày nhiều nhất trong khoảng: ${busiest.label} · ${busiest.count} bài` : "Chưa có bài Huy Locket nào trong khoảng này."}
              </p>
            </div>
            <div className="join">
              <button className={`btn btn-xs join-item ${range === 7 ? "btn-primary" : "btn-outline"}`} onClick={() => setRange(7)}>7 ngày</button>
              <button className={`btn btn-xs join-item ${range === 30 ? "btn-primary" : "btn-outline"}`} onClick={() => setRange(30)}>30 ngày</button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-2">
            <div className={`flex min-w-[620px] items-end gap-1 ${range === 30 ? "h-56" : "h-48"}`}>
              {chart.map((row) => (
                <div key={row.key} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                  <div className="mb-1 text-[10px] font-semibold text-base-content/55">{row.count || ""}</div>
                  <div
                    className="mx-auto w-[70%] min-w-2 rounded-t-lg bg-primary/75 transition-all"
                    style={{ height: `${Math.max(row.count ? 8 : 2, (row.count / maxCount) * 82)}%` }}
                    title={`${row.label}: ${row.count} bài`}
                  />
                  <div className={`mt-2 text-[9px] text-base-content/45 ${range === 30 && ![0, 4].includes(new Date(row.key).getDay()) ? "opacity-0" : ""}`}>
                    {row.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-base-300 bg-base-200/30 p-3 text-xs text-base-content/55">
            Không suy đoán số liệu Locket bị thiếu: ô nào API chưa trả sẽ hiển thị “—”. Lịch sử cục bộ không được dùng để giả làm tổng hoạt động tài khoản.
          </div>
        </div>
      </section>
    </div>
  );
}
