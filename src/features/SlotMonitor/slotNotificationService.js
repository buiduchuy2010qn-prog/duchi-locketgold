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
