export const BACKGROUND_SOCKET_PAUSE_MS = 90 * 1000;
export const RECOVERY_SYNC_MIN_INTERVAL_MS = 12 * 1000;
export const MAX_RECOVERY_USER_THREADS = 4;
export const MAX_RECOVERY_GROUP_THREADS = 4;

export function shouldPauseSocketForBackground({
  visibilityState = "visible",
  hiddenForMs = 0,
  online = true,
  connected = true,
} = {}) {
  return Boolean(
    visibilityState === "hidden" &&
      online &&
      connected &&
      hiddenForMs >= BACKGROUND_SOCKET_PAUSE_MS,
  );
}

export function shouldRunRecoverySync({
  recoveryEpoch = 0,
  isConnected = false,
  online = true,
  visibilityState = "visible",
  lastSyncAt = 0,
  now = Date.now(),
} = {}) {
  if (!recoveryEpoch || !isConnected || !online) return false;
  if (visibilityState !== "visible") return false;
  if (lastSyncAt > 0 && now - lastSyncAt < RECOVERY_SYNC_MIN_INTERVAL_MS) {
    return false;
  }
  return true;
}

function latestThreadTimestamp(state) {
  const items = Array.isArray(state?.items) ? state.items : [];
  let latest = 0;

  for (const item of items) {
    const value = Number(
      item?.update_time ||
        item?.updated_at ||
        item?.created_at ||
        item?.create_time ||
        0,
    );
    if (Number.isFinite(value) && value > latest) latest = value;
  }

  return latest;
}

export function pickRecentLoadedThreadIds(messageState = {}, limit = 4) {
  const safeLimit = Math.max(0, Number(limit) || 0);
  if (!safeLimit || !messageState || typeof messageState !== "object") {
    return [];
  }

  return Object.entries(messageState)
    .filter(([id, state]) => {
      if (!id) return false;
      const items = Array.isArray(state?.items) ? state.items : [];
      return Boolean(state?.hasFetched || items.length);
    })
    .map(([id, state]) => ({
      id,
      latest: latestThreadTimestamp(state),
    }))
    .sort((a, b) => b.latest - a.latest)
    .slice(0, safeLimit)
    .map((entry) => entry.id);
}
