import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  Gauge,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { fetchSystemStatus } from "./accountHealthService";

const ICONS = {
  api: Server,
  database: Database,
  "slot-worker": Gauge,
  auth: ShieldCheck,
  telegram: Bot,
  gmail: Mail,
};

const META = {
  OK: {
    label: "Online",
    badge: "badge-success",
    border: "border-success/25 bg-success/5",
    icon: CheckCircle2,
    iconClass: "text-success",
  },
  WARNING: {
    label: "Cảnh báo",
    badge: "badge-warning",
    border: "border-warning/25 bg-warning/5",
    icon: CircleAlert,
    iconClass: "text-warning",
  },
  ERROR: {
    label: "Lỗi",
    badge: "badge-error",
    border: "border-error/25 bg-error/5",
    icon: XCircle,
    iconClass: "text-error",
  },
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

export default function SystemStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const next = await fetchSystemStatus();
      setStatus(next);
      return next;
    } catch (loadError) {
      setError(
        loadError?.response?.data?.message ||
          "Không lấy được trạng thái hệ thống.",
      );
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const services = Array.isArray(status?.services) ? status.services : [];
  const summary = useMemo(() => {
    const ok = services.filter((item) => item.status === "OK").length;
    const warning = services.filter((item) => item.status === "WARNING").length;
    const failed = services.filter((item) => item.status === "ERROR").length;
    return { ok, warning, failed };
  }, [services]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-6 text-base-content">
      <div className="overflow-hidden rounded-3xl border border-base-300 bg-base-100/90 shadow-xl">
        <header className="border-b border-base-300 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Cloud size={24} />
                <h2 className="text-xl font-bold">System Status</h2>
                {status?.overall && (
                  <span className={`badge badge-sm ${META[status.overall]?.badge || "badge-ghost"}`}>
                    {status.overall === "OK"
                      ? "Ổn định"
                      : status.overall === "WARNING"
                        ? "Có cảnh báo"
                        : "Có lỗi"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-base-content/60">
                Theo dõi backend, database, Canh Slot worker, auth và các kênh gửi thông báo.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm self-start"
              disabled={loading}
              onClick={() => load()}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Làm mới
            </button>
          </div>

          {!loading && services.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/55">
              <span className="text-success">{summary.ok} online</span>
              <span className="text-warning">{summary.warning} cảnh báo</span>
              <span className="text-error">{summary.failed} lỗi</span>
              <span>Kiểm tra: {formatTime(status?.checkedAt)}</span>
              {status?.version && (
                <span title={status.version}>Commit: {status.version.slice(0, 8)}</span>
              )}
            </div>
          )}
        </header>

        <div className="p-3 sm:p-5">
          {error && (
            <div className="mb-3 rounded-xl border border-error/25 bg-error/5 px-3 py-2 text-xs text-error">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-base-content/50">
              <span className="loading loading-spinner loading-sm mr-2" /> Đang kiểm tra hệ thống...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => {
                const meta = META[service.status] || META.WARNING;
                const Icon = ICONS[service.id] || Server;
                const StateIcon = meta.icon;
                return (
                  <article
                    key={service.id}
                    className={`rounded-2xl border p-4 ${meta.border}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-base-100/80 p-2 ring-1 ring-base-300">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{service.label}</p>
                          <span className={`badge badge-xs ${meta.badge}`}>
                            <StateIcon size={10} /> {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-base-content/65">
                          {service.detail}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-[11px] text-base-content/45">
            System Status chỉ hiển thị trạng thái an toàn. Token, mật khẩu, App Script secret và Telegram bot token không được trả về trình duyệt.
          </p>
        </div>
      </div>
    </section>
  );
}
