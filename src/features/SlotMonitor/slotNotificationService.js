import { instanceMain } from "@/libs/instanceMain";

export async function fetchSlotNotificationSettings() {
  const response = await instanceMain.get("api/slot-monitor/notifications");
  return response?.data?.data || null;
}

export async function saveSlotNotificationSettings(settings) {
  const response = await instanceMain.put("api/slot-monitor/notifications", settings);
  return response?.data?.data || null;
}

export async function testSlotNotificationChannel(channel) {
  const response = await instanceMain.post(
    `api/slot-monitor/notifications/test/${encodeURIComponent(channel)}`,
  );
  return response?.data?.data || null;
}
