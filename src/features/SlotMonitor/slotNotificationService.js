import { instanceMain } from "@/libs/instanceMain";

function getCurrentWebOrigin() {
  if (typeof window === "undefined") return "";
  return String(window.location?.origin || "").trim();
}

export async function fetchSlotNotificationSettings() {
  const response = await instanceMain.get("api/slot-monitor/notifications", {
    params: { webOrigin: getCurrentWebOrigin() },
  });
  return response?.data?.data || null;
}

export async function fetchSlotNotificationHistory({ channel = "", limit = 180 } = {}) {
  const response = await instanceMain.get("api/slot-monitor/notifications/history", {
    params: {
      channel: String(channel || ""),
      limit: Math.max(1, Math.min(250, Number(limit) || 180)),
    },
  });
  const rows = response?.data?.data;
  return Array.isArray(rows) ? rows : [];
}

export async function saveSlotNotificationSettings(settings) {
  const response = await instanceMain.put("api/slot-monitor/notifications", {
    ...settings,
    webOrigin: getCurrentWebOrigin(),
  });
  return response?.data?.data || null;
}

export async function testSlotNotificationChannel(channel) {
  const response = await instanceMain.post(
    `api/slot-monitor/notifications/test/${encodeURIComponent(channel)}`,
    { webOrigin: getCurrentWebOrigin() },
  );
  return response?.data?.data || null;
}
