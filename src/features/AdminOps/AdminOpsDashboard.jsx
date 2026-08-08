import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Bot,
  Clock3,
  GitCommitHorizontal,
  RefreshCw,
  Server,
  Users,
  Zap,
} from "lucide-react";
import { adminRequest } from "@/services/AdminAuthService";

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

function duration(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  if (total < 60) return `${Math.round(total)} giây`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
}

function pickNumber(object, paths) {
  for (const path of paths) {
    const parts = path.split(".");
    let value = object;
    for (const part of parts) value = value?.[part];
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function shortCommit(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 10) : "—";
}

function MetricCard({ icon: Icon, label, value, note, tone = "base" }) {
  const tones = {
    base: "border-base-300 bg-base-200/35",
    success: "border-success/25 bg-success/5",
    warning: "border-warning/25 bg-warning/5",
    error: "border-error/25 bg-error/5",
    info: "border-info/25 bg-info/5",
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone] || tones.base}`}>
      <div className="flex items-center gap-1.5 text-xs text-base-content/55">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {note && <div className="mt-1 text-[11px] text-base-content/45">{note}</div>}
    </div>
  );
}

export default function AdminOpsDashboard() {
  const [ops, setOps] = useState(null);
  const [serverHealth, setServerHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [onlineWindowSeconds, setOnlineWindowSeconds] = useState(150);
  const [frontendVersion, setFrontendVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [opsResult, healthResult, usersResult, versionResult] = await Promise.allSettled([
        adminRequest("/ops-dashboard"),
        adminRequest("/server-health"),
        adminRequest("/users?live=1&limit=100"),
        fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" }).then((res) =>
          res.ok ? res.json() : null,
        ),
      ]);

      if (opsResult.status === "fulfilled") {
        setOps(opsResult.value?.data || null);
      } else {
        throw opsResult.reason;
      }
      if (healthResult.status === "fulfilled") {
        setServerHealth(healthResult.value?.data || null);
      }
      if (usersResult.status === "fulfilled") {
        setUsers(Array.isArray(usersResult.value?.users) ? usersResult.value.users : []);
        setOnlineWindowSeconds(Number(usersResult.value?.onlineWindowSeconds) || 150);
      }
      if (versionResult.status === "fulfilled") {
        setFrontendVersion(versionResult.value || null);
      }
    } catch (loadError) {
      setError(loadError?.message || "Không tải được Dashboard vận hành.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const onlineUsers = useMemo(() => {
    const now = Date.now();
    return users.filter((user) => {
      if (Number(user.activeSessions || 0) < 1 || !user.lastSeenAt) return false;
      return now - new Date(user.lastSeenAt).getTime() <= onlineWindowSeconds * 1000;
    }).length;
  }, [onlineWindowSeconds, users]);

  const requestRate = pickNumber(serverHealth, [
    "requestsPerMinute",
    "requests_per_minute",
    "rpm",
    "requests.perMinute",
    "traffic.requestsPerMinute",
  ]);
  const apiErrors = pickNumber(serverHealth, [
    "errorsLastMinute",
    "errors_last_minute",
    "errorsPerMinute",
    "errors.perMinute",
    "traffic.errorsLastMinute",
  ]);

  const notifyRate = ops?.notifications?.successRate;
  const failures = Array.isArray(ops?.notifications?.recentFailures)
    ? ops.notifications.recentFailures
    : [];
  const slot = ops?.slotMonitor || {};
  const worker = ops?.worker || {};
  const runtime = ops?.runtime || {};

  const frontendCommit =
    frontendVersion?.commit ||
    frontendVersion?.commitHash ||
    frontendVersion?.gitCommit ||
    frontendVersion?.sha ||
    "";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 text-base-content md:px-8">
      <section className="overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-lg">
        <header className="border-b border-base-300 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <Activity className="h-6 w-6" /> Tổng quan vận hành
              </h2>
              <p className="mt-1 text-sm text-base-content/60">
                Dashboard Admin 2.0: người dùng online, telemetry API nếu backend có cung cấp, Canh Slot worker và tỉ lệ gửi thông báo.
              </p>
            </div>
            <button className="btn btn-sm btn-outline" disabled={loading} onClick={() => load()}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Làm mới
            </button>
          </div>
          {error && (
            <div className="alert alert-error mt-4 py-2 text-sm"><AlertTriangle className="h-4 w-4" /> {error}</div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard icon={Users} label="Online" value={onlineUsers} note={`${users.length} user đã nạp`} tone="info" />
            <MetricCard icon={Zap} label="Request/phút" value={requestRate == null ? "—" : requestRate.toLocaleString("vi-VN")} note={requestRate == null ? "Health API chưa có metric này" : "Telemetry backend"} />
            <MetricCard icon={AlertTriangle} label="API lỗi/phút" value={apiErrors == null ? "—" : apiErrors.toLocaleString("vi-VN")} note={apiErrors == null ? "Không suy đoán khi thiếu telemetry" : "Telemetry backend"} tone={apiErrors > 0 ? "warning" : "success"} />
            <MetricCard icon={Bot} label="Worker" value={`${Math.round(Number(worker.pollIntervalMs || 45000) / 1000)}s`} note={`${Number(worker.checkedWatchesLastMinute || 0)} watch check gần 1 phút`} tone="success" />
            <MetricCard icon={BellRing} label="Gửi thông báo" value={notifyRate == null ? "—" : `${notifyRate}%`} note={`${Number(ops?.notifications?.failed24h || 0)} lỗi / 24h`} tone={notifyRate != null && notifyRate < 90 ? "warning" : "success"} />
            <MetricCard icon={Clock3} label="API uptime" value={runtime.uptimeSeconds == null ? "—" : duration(runtime.uptimeSeconds)} note={runtime.environment || "production"} />
          </div>
        </header>

        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-base-300 bg-base-200/30 p-4">
              <h3 className="font-bold">Canh Slot toàn server</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><div className="text-xs text-base-content/50">User đang dùng</div><div className="text-xl font-bold">{Number(slot.users || 0)}</div></div>
                <div><div className="text-xs text-base-content/50">Watch bật</div><div className="text-xl font-bold">{Number(slot.enabled || 0)} / {Number(slot.total || 0)}</div></div>
                <div><div className="text-xs text-base-content/50">Đang có slot</div><div className="text-xl font-bold text-error">{Number(slot.openNow || 0)}</div></div>
                <div><div className="text-xs text-base-content/50">Auto request</div><div className="text-xl font-bold">{Number(slot.autoEnabled || 0)}</div></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                <div className="rounded-xl bg-base-100/70 p-2">Phiên tốt: <b>{Number(slot.sessionsHealthy || 0)}</b></div>
                <div className="rounded-xl bg-base-100/70 p-2">Phiên cần xem: <b>{Number(slot.sessionsAttention || 0)}</b></div>
                <div className="rounded-xl bg-base-100/70 p-2">Slot mở 24h: <b>{Number(slot.slotOpen24h || 0)}</b></div>
                <div className="rounded-xl bg-base-100/70 p-2">Request: <b className="text-success">{Number(slot.requestSent24h || 0)}</b> / <b className="text-error">{Number(slot.requestFailed24h || 0)}</b></div>
              </div>
            </div>

            <div className="rounded-2xl border border-base-300 bg-base-200/30 p-4">
              <h3 className="font-bold">Phiên bản đang chạy</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-base-100/70 p-3">
                  <div className="flex items-center gap-1 text-xs text-base-content/50"><GitCommitHorizontal className="h-3 w-3" /> Frontend</div>
                  <div className="mt-1 font-mono text-sm font-bold">{shortCommit(frontendCommit)}</div>
                  <div className="mt-1 text-[11px] text-base-content/45">version.json của bundle đang mở</div>
                </div>
                <div className="rounded-xl bg-base-100/70 p-3">
                  <div className="flex items-center gap-1 text-xs text-base-content/50"><Server className="h-3 w-3" /> Railway API</div>
                  <div className="mt-1 font-mono text-sm font-bold">{shortCommit(runtime.backendCommit)}</div>
                  <div className="mt-1 text-[11px] text-base-content/45">Node {runtime.node || "—"}</div>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-base-300 bg-base-200/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold">Lỗi thông báo gần đây</h3>
                <p className="text-[11px] text-base-content/50">Chỉ lỗi delivery, không hiển thị token hay secret.</p>
              </div>
              <BellRing className="h-5 w-5" />
            </div>
            <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
              {failures.length === 0 ? (
                <div className="rounded-xl border border-dashed border-base-300 p-6 text-center text-sm text-base-content/50">Không có lỗi delivery gần đây.</div>
              ) : (
                failures.map((failure, index) => (
                  <div key={`${failure.createdAt}-${index}`} className="rounded-xl border border-error/20 bg-error/5 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold uppercase">{failure.channel || "channel"}</span>
                      <span className="text-base-content/45">{formatTime(failure.createdAt)}</span>
                    </div>
                    {failure.username && <div className="mt-1">@{failure.username}</div>}
                    <div className="mt-1 text-error">{failure.errorCode || "DELIVERY_FAILED"}</div>
                    {failure.errorMessage && <div className="mt-1 break-words text-base-content/60">{failure.errorMessage}</div>}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>

        <footer className="border-t border-base-300 px-4 py-3 text-[11px] text-base-content/45 sm:px-5">
          Cập nhật tự động 30 giây · kiểm tra gần nhất {formatTime(ops?.checkedAt)}. Metric không có nguồn thật sẽ hiện “—”, không tự dựng số.
        </footer>
      </section>
    </div>
  );
}
