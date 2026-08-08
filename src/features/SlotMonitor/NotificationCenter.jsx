import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Mail,
  RefreshCw,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";
import { useSlotMonitor } from "./useSlotMonitor";
import {
  fetchSlotNotificationHistory,
  fetchSlotNotificationSettings,
} from "./slotNotificationService";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";

const CHANNEL_META = {
  "web-push": { label: "Web Push", icon: Smartphone },
  telegram: { label: "Telegram", icon: Send },
  email: { label: "Gmail", icon: Mail },
  zalo: { label: "Zalo", icon: Bell },
};

const STATUS_META = {
  SUCCESS: { label: "Đã gửi", className: "badge-success", icon: CheckCircle2 },
  PARTIAL: { label: "Một phần", className: "badge-warning", icon: BellRing },
  FAILED: { label: "Thất bại", className: "badge-error", icon: XCircle },
  SKIPPED: { label: "Bỏ qua", className: "badge-ghost", icon: Bell },
};

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function seenStorageKey() {
  return `duchi-notification-center-seen:${getMyLocalId() || "anonymous"}`;
}

export default function NotificationCenter() {
  const { slotPushState } = useSlotMonitor();
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSeenAt, setLastSeenAt] = useState(() => {
    try {
      return Number(localStorage.getItem(seenStorageKey()) || 0) || 0;
    } catch {
      return 0;
    }
  });

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [rows, nextSettings] = await Promise.all([
        fetchSlotNotificationHistory({ limit: 220 }),
        fetchSlotNotificationSettings(),
      ]);
      setHistory(rows);
      setSettings(nextSettings);
    } catch (loadError) {
      setError(
        loadError?.response?.data?.message ||
          "Chưa tải được Trung tâm thông báo.",
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const unreadCount = useMemo(
    () => history.filter((item) => Number(item.createdAt || 0) > lastSeenAt).length,
    [history, lastSeenAt],
  );

  const filtered = useMemo(
    () =>
      selectedChannel
        ? history.filter((item) => item.channel === selectedChannel)
        : history,
    [history, selectedChannel],
  );

  const deliveryStats = useMemo(() => {
    const delivered = history.filter((item) => item.status !== "SKIPPED");
    const ok = delivered.filter((item) =>
      ["SUCCESS", "PARTIAL"].includes(item.status),
    ).length;
    const failed = delivered.filter((item) => item.status === "FAILED").length;
    const rate = delivered.length > 0 ? Math.round((ok / delivered.length) * 100) : 100;
    return { total: delivered.length, ok, failed, rate };
  }, [history]);

  const markAllSeen = () => {
    const newest = history.reduce(
      (max, item) => Math.max(max, Number(item.createdAt || 0)),
      Date.now(),
    );
    setLastSeenAt(newest);
    try {
      localStorage.setItem(seenStorageKey(), String(newest));
    } catch {
      /* local marker is optional */
    }
  };

  const channelCards = [
    {
      channel: "web-push",
      label: "Web Push",
      enabled: Boolean(slotPushState?.enabled),
      detail: slotPushState?.enabled
        ? "Thiết bị hiện tại đang nhận push"
        : slotPushState?.backgroundEnabled
          ? "Railway chạy nền, thiết bị chưa nhận push"
          : "Chưa bật Canh 24/7",
    },
    {
      channel: "telegram",
      label: "Telegram",
      enabled: Boolean(settings?.telegramEnabled),
      detail: settings?.telegramEnabled ? "Đang bật" : "Đang tắt",
    },
    {
      channel: "email",
      label: "Gmail",
      enabled: Boolean(settings?.emailEnabled),
      detail: settings?.emailEnabled ? "Đang bật" : "Đang tắt",
    },
  ];

  return (
    <section
      id="notification-center"
      className="mx-auto w-full max-w-5xl px-4 pb-6 text-base-content"
    >
      <div className="overflow-hidden rounded-3xl border border-base-300 bg-base-100/90 shadow-xl">
        <header className="border-b border-base-300 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <BellRing size={23} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-error-content">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold">Trung tâm thông báo</h2>
              </div>
              <p className="mt-1 text-sm text-base-content/60">
                Gom lịch sử Web Push, Telegram và Gmail; biết kênh nào gửi thành công hoặc thất bại.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={loading}
                onClick={() => load()}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Làm mới
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={unreadCount === 0}
                onClick={markAllSeen}
              >
                Đánh dấu đã đọc
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {channelCards.map((item) => {
              const Icon = CHANNEL_META[item.channel]?.icon || Bell;
              return (
                <button
                  type="button"
                  key={item.channel}
                  className={`rounded-2xl border p-3 text-left transition-colors ${
                    selectedChannel === item.channel
                      ? "border-primary bg-primary/10"
                      : "border-base-300 bg-base-200/40 hover:bg-base-200/70"
                  }`}
                  onClick={() =>
                    setSelectedChannel((current) =>
                      current === item.channel ? "" : item.channel,
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <Icon size={15} /> {item.label}
                    </span>
                    <span
                      className={`badge badge-sm ${
                        item.enabled ? "badge-success" : "badge-ghost"
                      }`}
                    >
                      {item.enabled ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-base-content/50">
                    {item.detail}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/55">
            <span>Tổng bản ghi: {history.length}</span>
            <span>Thành công: {deliveryStats.ok}</span>
            <span>Thất bại: {deliveryStats.failed}</span>
            <span className="font-semibold text-success">
              Tỉ lệ gửi: {deliveryStats.rate}%
            </span>
          </div>
        </header>

        <div className="p-3 sm:p-5">
          {error && (
            <div className="mb-3 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-base-content/50">
              <span className="loading loading-spinner loading-sm mr-2" /> Đang tải thông báo...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-base-300 px-4 py-12 text-center text-sm text-base-content/50">
              Chưa có lịch sử gửi trên kênh này. Sự kiện mới sẽ tự xuất hiện ở đây.
            </div>
          ) : (
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((item) => {
                const channelMeta = CHANNEL_META[item.channel] || {
                  label: item.channel || "Kênh",
                  icon: Bell,
                };
                const statusMeta = STATUS_META[item.status] || STATUS_META.FAILED;
                const ChannelIcon = channelMeta.icon;
                const StatusIcon = statusMeta.icon;
                const unread = Number(item.createdAt || 0) > lastSeenAt;

                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-3 sm:p-4 ${
                      unread
                        ? "border-primary/35 bg-primary/5"
                        : "border-base-300 bg-base-200/35"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl bg-base-100 p-2 ring-1 ring-base-300">
                        <ChannelIcon size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-base-content/65">
                            {channelMeta.label}
                          </span>
                          <span className={`badge badge-xs ${statusMeta.className}`}>
                            <StatusIcon size={10} /> {statusMeta.label}
                          </span>
                          {unread && <span className="badge badge-primary badge-xs">Mới</span>}
                          <span className="ml-auto text-[10px] text-base-content/45">
                            {formatTime(item.createdAt)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm font-semibold">
                          {item.title || "Thông báo Canh Slot"}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-base-content/65">
                          {item.body || "Không có nội dung."}
                        </p>

                        {item.username && (
                          <div className="mt-2 text-[11px] text-base-content/50">
                            @{item.username}
                            {Number(item.availableSlots || 0) > 0
                              ? ` • ${Number(item.availableSlots).toLocaleString("vi-VN")} slot lúc gửi`
                              : ""}
                          </div>
                        )}

                        {item.status === "FAILED" && (item.errorMessage || item.errorCode) && (
                          <div className="mt-2 rounded-lg bg-error/5 px-2 py-1.5 text-[11px] text-error">
                            {item.errorCode ? `${item.errorCode}: ` : ""}
                            {item.errorMessage || "Không gửi được thông báo."}
                          </div>
                        )}

                        {item.url && (
                          <a
                            href={item.url}
                            className="btn btn-ghost btn-xs mt-2 px-2"
                          >
                            Mở sự kiện
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
