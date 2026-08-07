import { SLOT_STATUS, SLOT_WATCH_LIMIT } from "./slotMonitorCore.js";

export const SLOT_MONITOR_STORAGE_KEY = "huy_locket_slot_watch_v1";
export const SLOT_MONITOR_LEADER_KEY = "huy_locket_slot_monitor_leader_v1";
export const SLOT_MONITOR_COMMAND_KEY = "huy_locket_slot_monitor_command_v1";
export const SLOT_MONITOR_OWNER_KEY = "huy_locket_slot_watch_owner_v1";
export const SLOT_MONITOR_SERVER_SYNC_PREFIX = "huy_locket_slot_server_sync_v1:";

const getStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : globalThis.localStorage;
  } catch {
    return null;
  }
};

const cleanText = (value, max = 180) => String(value ?? "").trim().slice(0, max);
const cleanCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function sanitizeWatch(raw) {
  if (!raw || !raw.uid || !raw.username) return null;
  const status = Object.values(SLOT_STATUS).includes(raw.status)
    ? raw.status
    : SLOT_STATUS.WATCHING;

  return {
    uid: cleanText(raw.uid, 160),
    username: cleanText(raw.username, 80),
    displayName: cleanText(raw.displayName || raw.username, 120),
    avatar: cleanText(raw.avatar, 500),
    friendCount: cleanCount(raw.friendCount),
    maxFriends: cleanCount(raw.maxFriends),
    status,
    createdAt: Number(raw.createdAt) || Date.now(),
    lastCheckedAt: Number(raw.lastCheckedAt) || null,
    notifiedAt: Number(raw.notifiedAt) || null,
    errorCount: cleanCount(raw.errorCount),
    lastWasFull:
      typeof raw.lastWasFull === "boolean"
        ? raw.lastWasFull
        : cleanCount(raw.maxFriends) > 0 && cleanCount(raw.friendCount) >= cleanCount(raw.maxFriends),
    autoRequestEnabled: Boolean(raw.autoRequestEnabled),
    lastAutoRequestAt: Number(raw.lastAutoRequestAt) || null,
    lastAutoRequestStatus: cleanText(raw.lastAutoRequestStatus, 40),
    lastAutoRequestError: cleanText(raw.lastAutoRequestError, 500),
  };
}

export function getWatchedCelebs() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(SLOT_MONITOR_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeWatch).filter(Boolean).slice(0, SLOT_WATCH_LIMIT);
  } catch {
    return [];
  }
}

export function saveWatchedCelebs(celebs) {
  const storage = getStorage();
  if (!storage) return [];
  const safe = (Array.isArray(celebs) ? celebs : [])
    .map(sanitizeWatch)
    .filter(Boolean)
    .slice(0, SLOT_WATCH_LIMIT);
  storage.setItem(SLOT_MONITOR_STORAGE_KEY, JSON.stringify(safe));
  return safe;
}

export function getSlotMonitorOwner() {
  const storage = getStorage();
  if (!storage) return "";
  return String(storage.getItem(SLOT_MONITOR_OWNER_KEY) || "").trim();
}

export function setSlotMonitorOwner(uid) {
  const storage = getStorage();
  if (!storage) return;
  const value = String(uid || "").trim();
  if (value) storage.setItem(SLOT_MONITOR_OWNER_KEY, value);
  else storage.removeItem(SLOT_MONITOR_OWNER_KEY);
}

export function hasServerSyncForOwner(uid) {
  const storage = getStorage();
  if (!storage || !uid) return false;
  return storage.getItem(`${SLOT_MONITOR_SERVER_SYNC_PREFIX}${uid}`) === "1";
}

export function markServerSyncForOwner(uid) {
  const storage = getStorage();
  if (!storage || !uid) return;
  storage.setItem(`${SLOT_MONITOR_SERVER_SYNC_PREFIX}${uid}`, "1");
}

export function addWatch(celeb) {
  const current = getWatchedCelebs();
  const candidate = sanitizeWatch({
    ...celeb,
    status: SLOT_STATUS.WATCHING,
    createdAt: Date.now(),
    lastCheckedAt: celeb?.lastCheckedAt ?? null,
    notifiedAt: null,
    errorCount: 0,
    lastWasFull: true,
    autoRequestEnabled: Boolean(celeb?.autoRequestEnabled),
    lastAutoRequestAt: null,
    lastAutoRequestStatus: "",
    lastAutoRequestError: "",
  });
  if (!candidate) throw new Error("Tài khoản Celeb không hợp lệ.");

  const existingIndex = current.findIndex((item) => item.uid === candidate.uid);
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    current[existingIndex] = {
      ...existing,
      username: candidate.username,
      displayName: candidate.displayName,
      avatar: candidate.avatar,
      friendCount: candidate.friendCount,
      maxFriends: candidate.maxFriends,
      status: existing.status === SLOT_STATUS.PAUSED ? SLOT_STATUS.PAUSED : existing.status,
      lastWasFull:
        candidate.maxFriends > 0
          ? candidate.friendCount >= candidate.maxFriends
          : existing.lastWasFull,
    };
    return saveWatchedCelebs(current);
  }

  if (current.length >= SLOT_WATCH_LIMIT) {
    throw new Error(`Bạn chỉ có thể canh tối đa ${SLOT_WATCH_LIMIT} tài khoản cùng lúc.`);
  }

  return saveWatchedCelebs([...current, candidate]);
}

export function removeWatch(uid) {
  return saveWatchedCelebs(getWatchedCelebs().filter((item) => item.uid !== String(uid)));
}

export function updateWatch(uid, updates) {
  const current = getWatchedCelebs();
  const index = current.findIndex((item) => item.uid === String(uid));
  if (index < 0) return current;
  current[index] = sanitizeWatch({ ...current[index], ...updates });
  return saveWatchedCelebs(current);
}

export function clearAllWatch() {
  return saveWatchedCelebs([]);
}

export function readLeaderLock() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(SLOT_MONITOR_LEADER_KEY) || "null");
  } catch {
    return null;
  }
}

export function writeLeaderLock(lock) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SLOT_MONITOR_LEADER_KEY, JSON.stringify(lock));
}

export function releaseLeaderLock(tabId) {
  const storage = getStorage();
  if (!storage) return;
  const current = readLeaderLock();
  if (current?.id === tabId) storage.removeItem(SLOT_MONITOR_LEADER_KEY);
}

export function sendLeaderCommand(command) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(
    SLOT_MONITOR_COMMAND_KEY,
    JSON.stringify({ ...command, nonce: `${Date.now()}-${Math.random()}` }),
  );
}
