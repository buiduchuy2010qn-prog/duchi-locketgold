import { instanceMain } from "@/libs/instanceMain";

function currentOrigin() {
  if (typeof window === "undefined") return "";
  return String(window.location?.origin || "").trim();
}

export async function fetchAccountHealth() {
  const response = await instanceMain.get(
    "api/slot-monitor/notifications/account-health",
    { params: { webOrigin: currentOrigin() } },
  );
  return response?.data?.data || null;
}
