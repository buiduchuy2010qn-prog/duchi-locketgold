import React, { useEffect } from "react";
import { Bell, Pause, Play, RefreshCw, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSlotMonitor } from "./useSlotMonitor";
import { SLOT_STATUS } from "./slotMonitorCore";

const statusLabel = (status) => {
  switch (status) {
    case SLOT_STATUS.SLOT_OPEN:
      return "🔥 Đã mở slot";
    case SLOT_STATUS.PAUSED:
      return "⏸ Tạm dừng";
    case SLOT_STATUS.ERROR:
      return "⚠️ Đang thử lại";
    default:
      return "🔔 Đang canh";
  }
};

const timeAgo = (value) => {
  if (!value) return "Chưa kiểm tra";
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  return `${Math.floor(minutes / 60)} giờ trước`;
};

export default function SlotWatchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const {
    watchedCelebs,
    checkingUids,
    unwatchCeleb,
    pauseWatch,
    resumeWatch,
    checkNow,
    clearAll,
  } = useSlotMonitor();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="interaction-modal-backdrop fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-3"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="interaction-modal-card w-full max-w-lg max-h-[86vh] overflow-hidden rounded-2xl bg-base-100 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Danh sách canh slot"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-base-300 p-4">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><Bell size={18} /> Canh Slot</h2>
            <p className="text-xs text-base-content/60">Giữ Huy Locket hoạt động để nhận slot nhanh nhất.</p>
          </div>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[65vh] overflow-y-auto p-3 space-y-2">
          {watchedCelebs.length === 0 ? (
            <div className="py-10 text-center text-base-content/55">
              <Bell className="mx-auto mb-2 opacity-30" />
              Chưa có Celeb nào đang được canh.
            </div>
          ) : watchedCelebs.map((celeb) => {
            const checking = checkingUids.includes(celeb.uid);
            const slotOpen = celeb.status === SLOT_STATUS.SLOT_OPEN;
            return (
              <article key={celeb.uid} className="rounded-xl bg-base-200/60 p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={celeb.avatar || "/images/default_profile.png"}
                    alt={celeb.displayName}
                    className="h-11 w-11 rounded-full object-cover"
                    onError={(event) => { event.currentTarget.src = "/images/default_profile.png"; }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{celeb.displayName}</p>
                    <p className="truncate text-xs text-base-content/60">@{celeb.username}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-base-content/60">
                      <span>{checking ? "⏳ Đang kiểm tra..." : statusLabel(celeb.status)}</span>
                      <span>{celeb.friendCount.toLocaleString()} / {celeb.maxFriends.toLocaleString()}</span>
                      <span>{timeAgo(celeb.lastCheckedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {slotOpen && (
                    <button
                      className="btn btn-error btn-sm"
                      onClick={() => {
                        onClose();
                        navigate("/friends", { state: { slotUsername: celeb.username } });
                      }}
                    >
                      Kết bạn ngay
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={checking}
                    onClick={() => checkNow(celeb.uid)}
                  >
                    <RefreshCw size={14} className={checking ? "animate-spin" : ""} /> Kiểm tra
                  </button>
                  {celeb.status === SLOT_STATUS.PAUSED ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => resumeWatch(celeb.uid)}>
                      <Play size={14} /> Tiếp tục
                    </button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => pauseWatch(celeb.uid)}>
                      <Pause size={14} /> Tạm dừng
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm ml-auto text-error"
                    onClick={() => {
                      if (window.confirm(`Hủy canh @${celeb.username}?`)) unwatchCeleb(celeb.uid);
                    }}
                  >
                    <Trash2 size={14} /> Hủy
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {watchedCelebs.length > 0 && (
          <footer className="flex items-center justify-between border-t border-base-300 p-3 text-xs">
            <span className="text-base-content/60">{watchedCelebs.length}/20 tài khoản</span>
            <button
              className="btn btn-ghost btn-xs text-error"
              onClick={() => {
                if (window.confirm("Hủy canh tất cả tài khoản?")) clearAll();
              }}
            >
              Hủy tất cả
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
