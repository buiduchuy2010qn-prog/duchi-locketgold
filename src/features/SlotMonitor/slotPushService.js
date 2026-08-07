import { instanceMain } from "@/libs/instanceMain";
import { getToken, urlBase64ToUint8Array } from "@/utils";

function toBase64Url(buffer) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function getSlotPushConfig() {
  const response = await instanceMain.get("api/slot-monitor/config");
  return response?.data?.data || null;
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
}

async function ensureMatchingSubscription(registration, vapidPublicKey) {
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const currentKey = toBase64Url(subscription.options?.applicationServerKey);
    if (currentKey && currentKey !== vapidPublicKey) {
      await subscription.unsubscribe().catch(() => false);
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  return subscription;
}

export async function enableSlotPush({ requestPermission = true } = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { enabled: false, reason: "NOTIFICATION_UNSUPPORTED" };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { enabled: false, reason: "PUSH_UNSUPPORTED" };
  }

  const config = await getSlotPushConfig();
  if (!config?.enabled || !config?.vapidPublicKey) {
    return { enabled: false, reason: config?.reason || "SERVER_UNAVAILABLE" };
  }

  let permission = window.Notification.permission;
  if (permission === "default" && requestPermission) {
    permission = await window.Notification.requestPermission();
  }

  const { refreshToken } = getToken();
  if (!refreshToken) {
    return { enabled: false, reason: "REFRESH_TOKEN_REQUIRED", permission };
  }

  let subscription = null;
  if (permission === "granted") {
    const registration = await getRegistration();
    if (!registration) return { enabled: false, reason: "SERVICE_WORKER_UNAVAILABLE" };
    subscription = await ensureMatchingSubscription(registration, config.vapidPublicKey);
  }

  await instanceMain.post("api/slot-monitor/enable", {
    refreshToken,
    subscription: subscription?.toJSON?.() || subscription || null,
  });

  return {
    enabled: permission === "granted" && Boolean(subscription),
    backgroundEnabled: true,
    permission,
    reason: permission === "denied" ? "PERMISSION_DENIED" : null,
  };
}

export async function syncSlotWatch(watch) {
  return instanceMain.post("api/slot-monitor/watch", { watch });
}

export async function removeSlotWatch(uid) {
  return instanceMain.delete(`api/slot-monitor/watch/${encodeURIComponent(uid)}`);
}

export async function setServerSlotWatchEnabled(uid, enabled) {
  return instanceMain.patch(`api/slot-monitor/watch/${encodeURIComponent(uid)}`, {
    enabled,
  });
}

export async function checkServerSlotWatchNow(uid) {
  return instanceMain.post(`api/slot-monitor/check/${encodeURIComponent(uid)}`);
}

export async function testSlotPush() {
  return instanceMain.post("api/slot-monitor/test-push");
}

export async function syncExistingWatches(watches = []) {
  const safe = Array.isArray(watches) ? watches.slice(0, 20) : [];
  for (const watch of safe) {
    await syncSlotWatch(watch);
  }
  return safe.length;
}
