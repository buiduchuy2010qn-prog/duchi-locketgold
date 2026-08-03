import React, { useState, useEffect, useCallback } from "react";
import { fetchGlobalBroadcast } from "@/services/UserActivityService";
import { useAuthStore } from "@/stores";

export default function GlobalBroadcastBanner() {
  const { user } = useAuthStore();
  const [broadcast, setBroadcast] = useState(null);
  const [dismissedKey, setDismissedKey] = useState("");

  const checkBroadcast = useCallback(async (forceShow = false) => {
    try {
      const res = await fetchGlobalBroadcast();
      const list = res?.list || (res ? [res] : []);
      const activeItems = list.filter((item) => item && item.active && item.message);
      if (!activeItems.length) {
        setBroadcast(null);
        return;
      }

      const myEmail = String(user?.email || "").trim().toLowerCase();
      const myUid = String(user?.uid || user?.user_id || user?.localId || user?.local_id || "").trim().toLowerCase();

      let matchedItem = null;

      for (const item of activeItems) {
        const target = String(item.targetUser || "ALL").trim().toLowerCase();
        const isAll = target === "all" || target === "*";
        const isTargeted = isAll ||
          (myEmail && (target === myEmail || target.includes(myEmail))) ||
          (myUid && (target === myUid || target.includes(myUid)));

        if (isTargeted) {
          matchedItem = item;
          break;
        }
      }

      if (!matchedItem) {
        setBroadcast(null);
        return;
      }

      const key = `${matchedItem.id || ""}_${matchedItem.message}_${matchedItem.updatedAt || Date.now()}`;
      if (forceShow) {
        setDismissedKey("");
        setBroadcast({ ...matchedItem, key });
      } else if (key !== dismissedKey) {
        setBroadcast({ ...matchedItem, key });
      }
    } catch (err) {
      // ignore silently
    }
  }, [user, dismissedKey]);

  useEffect(() => {
    checkBroadcast();
    const interval = setInterval(() => checkBroadcast(false), 4000);

    const handleUpdate = () => checkBroadcast(true);
    window.addEventListener("locket_broadcast_updated", handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("locket_broadcast_updated", handleUpdate);
    };
  }, [checkBroadcast]);

  if (!broadcast || (broadcast.key === dismissedKey)) return null;

  const isWarning = broadcast.level === "warning" || broadcast.level === "error" || broadcast.level === "danger";

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[99999] w-max max-w-[94%] sm:max-w-3xl animate-in fade-in slide-in-from-top-4 duration-400">
      <div className={`relative flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border ${
        isWarning 
          ? "bg-gradient-to-r from-red-950/95 via-orange-950/95 to-amber-950/95 border-red-500/50 text-red-100 shadow-red-900/30"
          : "bg-gradient-to-r from-indigo-950/95 via-purple-950/95 to-slate-950/95 border-purple-400/50 text-indigo-100 shadow-purple-900/40"
      }`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="flex h-3.5 w-3.5 relative flex-shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isWarning ? "bg-red-400" : "bg-purple-400"
            }`} />
            <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
              isWarning ? "bg-red-500" : "bg-purple-500"
            }`} />
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-extrabold text-white/80">
              <span>📢 THÔNG BÁO HỆ THỐNG</span>
              {broadcast.targetUser && broadcast.targetUser !== "ALL" ? (
                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold">
                  Riêng cho bạn
                </span>
              ) : null}
            </div>
            <p className="font-black text-sm sm:text-base text-white break-words mt-0.5 leading-snug drop-shadow">
              {broadcast.message}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setDismissedKey(broadcast.key);
            setBroadcast(null);
          }}
          className="flex-shrink-0 p-2 hover:bg-white/10 rounded-xl transition-colors duration-200 text-white/80 hover:text-white"
          title="Đóng thông báo"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
