/**
 * Single owner for app-update state, service-worker activation, and reload.
 *
 * State flow:
 * idle -> checking -> update-ready -> applying -> reloading
 */

import currentBuild from "@/config/buildMeta.json";
import { usePostStore } from "@/stores/PostStores/usePostStore";
import { useUploadQueueStore } from "@/stores/PostStores/useUploadPostStore";
import { useMomentDraftStore } from "@/stores/PostStores/useMomentDraftStore";
import { SonnerInfo } from "@/components/uikit/SonnerToast";

const STORAGE_BUILD = "app_known_build_id";
const STORAGE_RELOAD_GUARD = "app_update_reload_guard";
const STORAGE_LAST_AWAY = "app_last_away_at";
const STORAGE_LAST_ACTIVE = "app_last_active_at";

const POLL_MS = 5 * 60 * 1000;
const AWAY_AUTO_UPDATE_MS = 30 * 60 * 1000;
const RELOAD_GUARD_MS = 60 * 1000;
const CONTROLLER_TIMEOUT_MS = 8 * 1000;
const EVENT_NAME = "app:update_state";
const UPDATE_LOCK_NAME = "huy-locket-app-update";
const TAB_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const APP_UPDATE_PHASE = Object.freeze({
  IDLE: "idle",
  CHECKING: "checking",
  UPDATE_READY: "update-ready",
  APPLYING: "applying",
  RELOADING: "reloading",
});

let pollTimer = null;
let started = false;
let checkingPromise = null;
let autoUpdatingPromise = null;
let applyPromise = null;
let pendingSwApply = null;
let serviceWorkerCheck = null;
let controllerChangeListener = null;
let reloadFallbackTimer = null;

let updateState = {
  phase: APP_UPDATE_PHASE.IDLE,
  available: false,
  latest: null,
  swWaiting: false,
};

function now() {
  return Date.now();
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readReloadGuard() {
  const raw = safeGet(STORAGE_RELOAD_GUARD);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const at = Number(value?.at || 0);
    if (!Number.isFinite(at) || now() - at >= RELOAD_GUARD_MS) {
      safeRemove(STORAGE_RELOAD_GUARD);
      return null;
    }
    return value;
  } catch {
    safeRemove(STORAGE_RELOAD_GUARD);
    return null;
  }
}

function isReloadGuardActive(targetBuildId) {
  const guard = readReloadGuard();
  if (!guard) return false;
  return !targetBuildId || !guard.buildId || guard.buildId === targetBuildId;
}

function claimReloadGuard(targetBuildId, { replaceExisting = false } = {}) {
  if (replaceExisting) {
    safeRemove(STORAGE_RELOAD_GUARD);
  } else if (isReloadGuardActive(targetBuildId)) {
    return null;
  }

  const token = `${TAB_ID}:${now()}`;
  safeSet(
    STORAGE_RELOAD_GUARD,
    JSON.stringify({
      at: now(),
      buildId: targetBuildId || "",
      owner: TAB_ID,
      token,
    }),
  );

  const claimed = readReloadGuard();
  return claimed?.token === token ? token : null;
}

function releaseReloadGuard(token) {
  if (!token) return;
  const guard = readReloadGuard();
  if (guard?.token === token) safeRemove(STORAGE_RELOAD_GUARD);
}

function markActive() {
  safeSet(STORAGE_LAST_ACTIVE, String(now()));
}

function markAway() {
  safeSet(STORAGE_LAST_AWAY, String(now()));
}

function hasBeenAwayLongEnough() {
  const awayAt = Number(safeGet(STORAGE_LAST_AWAY));
  if (Number.isFinite(awayAt) && awayAt > 0) {
    return now() - awayAt >= AWAY_AUTO_UPDATE_MS;
  }

  const activeAt = Number(safeGet(STORAGE_LAST_ACTIVE));
  return (
    Number.isFinite(activeAt) &&
    activeAt > 0 &&
    now() - activeAt >= AWAY_AUTO_UPDATE_MS
  );
}

function statesMatch(a, b) {
  return (
    a.phase === b.phase &&
    a.available === b.available &&
    a.swWaiting === b.swWaiting &&
    a.latest?.buildId === b.latest?.buildId
  );
}

function publishState(partial) {
  const next = { ...updateState, ...partial };
  if (statesMatch(updateState, next)) return;
  updateState = next;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { ...updateState } }),
    );
  } catch {
    /* ignore */
  }
}

export function getCurrentBuildMeta() {
  return {
    version: currentBuild?.version || "0.0.0",
    buildId: currentBuild?.buildId || "unknown",
    commitHash: currentBuild?.commitHash || "",
    deployedAt: currentBuild?.deployedAt || "",
  };
}

export async function fetchLatestVersion() {
  const url = `/version.json?t=${Date.now()}`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`version.json ${res.status}`);
  const data = await res.json();
  if (!data?.buildId) throw new Error("version.json missing buildId");
  return {
    version: String(data.version || ""),
    buildId: String(data.buildId),
    commitHash: String(data.commitHash || ""),
    deployedAt: String(data.deployedAt || ""),
  };
}

export function getAppUpdateState() {
  return { ...updateState };
}

export function subscribeAppUpdate(listener) {
  if (typeof listener !== "function") return () => {};
  const handler = (event) =>
    listener(event?.detail || getAppUpdateState());
  window.addEventListener(EVENT_NAME, handler);
  try {
    listener(getAppUpdateState());
  } catch {
    /* ignore */
  }
  return () => window.removeEventListener(EVENT_NAME, handler);
}

export async function clearOldAppCache() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("[update] clear caches", error);
  }
}

function clearReloadWaiters() {
  if (reloadFallbackTimer) {
    clearTimeout(reloadFallbackTimer);
    reloadFallbackTimer = null;
  }
  if (controllerChangeListener) {
    navigator.serviceWorker?.removeEventListener?.(
      "controllerchange",
      controllerChangeListener,
    );
    controllerChangeListener = null;
  }
}

function makeReloadUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(now()));
  return url.pathname + url.search + url.hash;
}

function reloadExactlyOnce(targetBuildId, useReplace = false) {
  if (updateState.phase === APP_UPDATE_PHASE.RELOADING) return false;

  clearReloadWaiters();
  safeSet(STORAGE_BUILD, targetBuildId || getCurrentBuildMeta().buildId);
  publishState({ phase: APP_UPDATE_PHASE.RELOADING });

  if (useReplace) {
    window.location.replace(makeReloadUrl());
  } else {
    window.location.reload();
  }
  return true;
}

function armControllerReload(targetBuildId) {
  clearReloadWaiters();

  controllerChangeListener = () => {
    reloadExactlyOnce(targetBuildId, true);
  };
  navigator.serviceWorker?.addEventListener?.(
    "controllerchange",
    controllerChangeListener,
    { once: true },
  );

  reloadFallbackTimer = setTimeout(() => {
    console.warn(
      "[update] controllerchange timeout, using one guarded reload",
    );
    reloadExactlyOnce(targetBuildId, true);
  }, CONTROLLER_TIMEOUT_MS);
}

async function withApplyLock(
  targetBuildId,
  task,
  { userInitiated = false } = {},
) {
  const runWithGuard = async () => {
    const guardToken = claimReloadGuard(targetBuildId, {
      replaceExisting: userInitiated,
    });
    if (!guardToken) return { acquired: false, value: null };
    try {
      const value = await task();
      if (value === false) releaseReloadGuard(guardToken);
      return { acquired: true, value };
    } catch (error) {
      releaseReloadGuard(guardToken);
      throw error;
    }
  };

  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    if (userInitiated) {
      return navigator.locks.request(
        UPDATE_LOCK_NAME,
        { mode: "exclusive" },
        runWithGuard,
      );
    }

    return navigator.locks.request(
      UPDATE_LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (!lock) return { acquired: false, value: null };
        return runWithGuard();
      },
    );
  }

  return runWithGuard();
}

export function isUserBusy() {
  try {
    const postState = usePostStore.getState();
    if (
      postState.selectedFile ||
      postState.preview ||
      postState.imageToCrop ||
      postState.videoToCrop
    ) {
      return true;
    }

    const uploadState = useUploadQueueStore.getState();
    if (
      uploadState.isQueueRunning ||
      uploadState.uploadItems?.some(
        (item) => item.status === "queued" || item.status === "uploading",
      )
    ) {
      return true;
    }

    const draftState = useMomentDraftStore.getState();
    if (
      draftState.postingDraftId ||
      draftState.pendingNewFile ||
      draftState.loading
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function applyWebsiteUpdate(
  targetBuildId,
  { userInitiated = false } = {},
) {
  if (
    updateState.phase === APP_UPDATE_PHASE.APPLYING ||
    updateState.phase === APP_UPDATE_PHASE.RELOADING
  ) {
    return applyPromise || Promise.resolve(null);
  }
  if (applyPromise) return applyPromise;

  applyPromise = (async () => {
    if (isUserBusy()) return false;

    const target =
      targetBuildId ||
      updateState.latest?.buildId ||
      getCurrentBuildMeta().buildId;

    const result = await withApplyLock(
      target,
      async () => {
        if (isUserBusy()) return false;

        publishState({ phase: APP_UPDATE_PHASE.APPLYING });
        safeSet(STORAGE_BUILD, target);

        if (typeof pendingSwApply === "function") {
          armControllerReload(target);
          try {
            const applyWaitingWorker = pendingSwApply;
            pendingSwApply = null;
            const sent = await applyWaitingWorker();
            if (sent !== false) return true;
          } catch (error) {
            console.warn("[update] service worker apply failed", error);
          }
          clearReloadWaiters();
        }

        reloadExactlyOnce(target, true);
        return true;
      },
      { userInitiated },
    );

    if (!result.acquired) {
      publishState({ phase: APP_UPDATE_PHASE.UPDATE_READY });
      return null;
    }
    return result.value;
  })().finally(() => {
    applyPromise = null;
  });

  return applyPromise;
}

export function checkForAppUpdate() {
  if (
    updateState.phase === APP_UPDATE_PHASE.APPLYING ||
    updateState.phase === APP_UPDATE_PHASE.RELOADING
  ) {
    return Promise.resolve(updateState.available);
  }
  if (checkingPromise) return checkingPromise;
  if (typeof document !== "undefined" && document.hidden) {
    return Promise.resolve(updateState.available);
  }

  checkingPromise = (async () => {
    publishState({ phase: APP_UPDATE_PHASE.CHECKING });
    try {
      const latest = await fetchLatestVersion();
      const current = getCurrentBuildMeta();
      const available =
        latest.buildId !== current.buildId || updateState.swWaiting;

      if (!available) {
        safeSet(STORAGE_BUILD, latest.buildId);
        safeRemove(STORAGE_RELOAD_GUARD);
        publishState({
          phase: APP_UPDATE_PHASE.IDLE,
          available: false,
          latest: null,
        });
        return false;
      }

      publishState({
        phase: APP_UPDATE_PHASE.UPDATE_READY,
        available: true,
        latest,
      });
      return true;
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.debug("[update] check skipped", error?.message || error);
      }
      publishState({
        phase: updateState.available
          ? APP_UPDATE_PHASE.UPDATE_READY
          : APP_UPDATE_PHASE.IDLE,
      });
      return updateState.available;
    }
  })().finally(() => {
    checkingPromise = null;
  });

  return checkingPromise;
}

export function autoUpdateIfAvailable() {
  if (autoUpdatingPromise) return autoUpdatingPromise;
  if (typeof document !== "undefined" && document.hidden) {
    return Promise.resolve(false);
  }

  autoUpdatingPromise = (async () => {
    if (!hasBeenAwayLongEnough()) {
      await checkForAppUpdate();
      return false;
    }
    if (isUserBusy()) return false;

    const hasUpdate = await checkForAppUpdate();
    if (!hasUpdate || isUserBusy()) return false;

    const target = updateState.latest?.buildId;
    if (isReloadGuardActive(target)) return false;

    const result = await applyWebsiteUpdate(target);
    return result !== false;
  })()
    .catch((error) => {
      console.warn("[update] auto update failed", error);
      return false;
    })
    .finally(() => {
      autoUpdatingPromise = null;
    });

  return autoUpdatingPromise;
}

let userForceUpdatePromise = null;

export function userForceUpdate() {
  if (userForceUpdatePromise) return userForceUpdatePromise;
  userForceUpdatePromise = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return "offline";
      }

      try {
        await serviceWorkerCheck?.();
      } catch {
        /* version.json remains the source of truth */
      }

      const hasUpdate = await checkForAppUpdate();
      if (!hasUpdate) return "latest";

      if (isUserBusy()) {
        SonnerInfo(
          "Đã có phiên bản mới",
          "Ứng dụng sẽ cập nhật sau khi bạn hoàn tất.",
        );
        return "busy";
      }

      const result = await applyWebsiteUpdate(
        updateState.latest?.buildId,
        { userInitiated: true },
      );
      if (result === null) return "applying";
      return result ? "updated" : "error";
    } finally {
      userForceUpdatePromise = null;
    }
  })();
  return userForceUpdatePromise;
}

export function handleServiceWorkerUpdate(applyWaitingWorker) {
  if (typeof applyWaitingWorker === "function") {
    pendingSwApply = applyWaitingWorker;
  }

  publishState({
    phase: APP_UPDATE_PHASE.UPDATE_READY,
    available: true,
    swWaiting: true,
    latest: updateState.latest || {
      buildId: "sw-waiting",
      version: getCurrentBuildMeta().version,
    },
  });
  void checkForAppUpdate();
}

export function setServiceWorkerCheck(check) {
  serviceWorkerCheck = typeof check === "function" ? check : null;
}

/** @deprecated Use handleServiceWorkerUpdate. */
export function setPendingSwApply(applyWaitingWorker) {
  pendingSwApply =
    typeof applyWaitingWorker === "function" ? applyWaitingWorker : null;
}

function ensurePoll() {
  if (pollTimer) return;
  if (typeof document !== "undefined" && document.hidden) return;
  pollTimer = setInterval(() => {
    if (document.hidden) return;
    markActive();
    void checkForAppUpdate();
  }, POLL_MS);
}

export function handleVisibilityUpdateCheck() {
  if (document.visibilityState !== "visible") {
    markAway();
    stopUpdateWatcher({ keepListeners: true });
    return;
  }

  if (started) ensurePoll();
  void autoUpdateIfAvailable().finally(markActive);
}

export function handleOnlineUpdateCheck() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  void autoUpdateIfAvailable();
}

function handleFocusUpdateCheck() {
  if (document.visibilityState !== "visible") return;
  markActive();
  void checkForAppUpdate();
}

function handlePageHide() {
  markAway();
}

function handlePageShow(event) {
  if (!event.persisted) return;
  void autoUpdateIfAvailable().finally(markActive);
}

export function startUpdateWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  void autoUpdateIfAvailable().finally(markActive);
  ensurePoll();

  document.addEventListener(
    "visibilitychange",
    handleVisibilityUpdateCheck,
  );
  window.addEventListener("focus", handleFocusUpdateCheck);
  window.addEventListener("online", handleOnlineUpdateCheck);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);
}

export function stopUpdateWatcher({ keepListeners = false } = {}) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (keepListeners) return;

  started = false;
  document.removeEventListener(
    "visibilitychange",
    handleVisibilityUpdateCheck,
  );
  window.removeEventListener("focus", handleFocusUpdateCheck);
  window.removeEventListener("online", handleOnlineUpdateCheck);
  window.removeEventListener("pagehide", handlePageHide);
  window.removeEventListener("pageshow", handlePageShow);
  clearReloadWaiters();
}

/** @deprecated */
export function showUpdateAvailableToast() {}
