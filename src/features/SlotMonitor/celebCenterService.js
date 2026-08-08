import { instanceMain } from "@/libs/instanceMain";

export async function fetchCelebCenterHistory({ uid = "", limit = 160 } = {}) {
  const params = new URLSearchParams();
  if (uid) params.set("uid", String(uid));
  params.set("limit", String(Math.max(1, Math.min(200, Number(limit) || 160))));
  const response = await instanceMain.get(`api/slot-monitor/history?${params.toString()}`);
  const rows = response?.data?.data;
  return Array.isArray(rows) ? rows : [];
}

export async function retryCelebRequest(uid) {
  const response = await instanceMain.post(
    `api/slot-monitor/retry/${encodeURIComponent(uid)}`,
  );
  return response?.data?.data || null;
}
