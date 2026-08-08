import { adminRequest } from "@/services/AdminAuthService";

export async function fetchAdminSlotWatches() {
  const result = await adminRequest("/slot-monitor/watches");
  return result?.data || { watches: [], users: {} };
}

export async function fetchAdminSlotEvents({ limit = 250 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 250));
  const result = await adminRequest(`/slot-monitor/events?limit=${safeLimit}`);
  return Array.isArray(result?.data) ? result.data : [];
}

export async function updateAdminSlotWatch(userUid, celebUid, patch) {
  const result = await adminRequest(
    `/slot-monitor/watches/${encodeURIComponent(userUid)}/${encodeURIComponent(celebUid)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch || {}),
    },
  );
  return result?.data || null;
}

export async function deleteAdminSlotWatch(userUid, celebUid) {
  return adminRequest(
    `/slot-monitor/watches/${encodeURIComponent(userUid)}/${encodeURIComponent(celebUid)}`,
    { method: "DELETE" },
  );
}
