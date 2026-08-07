const webPush = require("web-push");
const authServices = require("../../services/AuthSecurity/AuthServices");
const friendServices = require("../../services/LocketFriend/FriendsServices");
const store = require("./store");
const { encryptSecret, decryptSecret, getEncryptionKey } = require("./crypto");
const {
  computeTransition,
  decodeFirebaseUid,
  extractCelebritySnapshot,
} = require("./core");

const POLL_INTERVAL_MS = 3 * 60 * 1000;
const POLL_JITTER_MS = 30 * 1000;
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 500;
const VAPID_CONFIG_KEY = "slot_monitor_vapid_v1";
let vapidPromise = null;
let workerTimer = null;
let workerRunning = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getVapidKeys() {
  if (vapidPromise) return vapidPromise;

  vapidPromise = (async () => {
    const envPublic = String(process.env.VAPID_PUBLIC_KEY || "").trim();
    const envPrivate = String(process.env.VAPID_PRIVATE_KEY || "").trim();
    let keys = null;

    if (envPublic && envPrivate) {
      keys = { publicKey: envPublic, privateKey: envPrivate };
    } else {
      const stored = await store.getConfigValue(VAPID_CONFIG_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.publicKey && parsed?.privateKey) keys = parsed;
        } catch {
          /* regenerate below */
        }
      }

      if (!keys) {
        keys = webPush.generateVAPIDKeys();
        await store.setConfigValue(VAPID_CONFIG_KEY, JSON.stringify(keys));
        console.log("[slot-monitor] generated persistent VAPID key pair in database");
      }
    }

    webPush.setVapidDetails(
      String(process.env.VAPID_SUBJECT || "mailto:buiduchuy2010qn@gmail.com"),
      keys.publicKey,
      keys.privateKey,
    );
    return keys;
  })().catch((error) => {
    vapidPromise = null;
    throw error;
  });

  return vapidPromise;
}

async function getPublicConfig() {
  if (!store.isConfigured() || !getEncryptionKey()) {
    return {
      enabled: false,
      reason: !store.isConfigured()
        ? "DATABASE_UNAVAILABLE"
        : "ENCRYPTION_KEY_UNAVAILABLE",
      vapidPublicKey: null,
      pollIntervalMs: POLL_INTERVAL_MS,
    };
  }

  const keys = await getVapidKeys();
  return {
    enabled: true,
    vapidPublicKey: keys.publicKey,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}

async function validateAndSaveSession(userUid, refreshToken) {
  if (!refreshToken) {
    const error = new Error("Thiếu refresh token để bật Canh Slot 24/7.");
    error.code = "REFRESH_TOKEN_REQUIRED";
    error.status = 400;
    throw error;
  }

  const refreshed = await authServices.refreshIdToken(String(refreshToken));
  const idToken = refreshed?.id_token || refreshed?.access_token;
  const refreshedUid = decodeFirebaseUid(idToken);
  if (!idToken || !refreshedUid || String(refreshedUid) !== String(userUid)) {
    const error = new Error("Phiên đăng nhập không khớp tài khoản hiện tại.");
    error.code = "SLOT_SESSION_MISMATCH";
    error.status = 403;
    throw error;
  }

  const nextRefreshToken = refreshed?.refresh_token || refreshToken;
  await store.saveSession(userUid, encryptSecret(nextRefreshToken));
  return idToken;
}

async function enableBackgroundPush({ userUid, refreshToken, subscription, userAgent }) {
  await store.ensureSchema();
  await getVapidKeys();
  await validateAndSaveSession(userUid, refreshToken);
  if (subscription) {
    await store.upsertSubscription(userUid, subscription, userAgent);
  }
  return getPublicConfig();
}

async function refreshUserSession(userUid) {
  const session = await store.getSession(userUid);
  if (!session?.enabled || !session?.refresh_token_enc) {
    const error = new Error("Không có phiên nền cho Canh Slot.");
    error.code = "SLOT_SESSION_MISSING";
    throw error;
  }

  const refreshToken = decryptSecret(session.refresh_token_enc);
  try {
    const refreshed = await authServices.refreshIdToken(refreshToken);
    const idToken = refreshed?.id_token || refreshed?.access_token;
    const uid = decodeFirebaseUid(idToken);
    if (!idToken || !uid || String(uid) !== String(userUid)) {
      throw new Error("Background session user mismatch");
    }
    const nextRefresh = refreshed?.refresh_token || refreshToken;
    await store.markSessionRefreshed(userUid, encryptSecret(nextRefresh));
    return idToken;
  } catch (error) {
    await store.markSessionError(userUid, error?.message || "Session refresh failed");
    throw error;
  }
}

async function sendPushToUser(userUid, payload) {
  await getVapidKeys();
  const subscriptions = await store.listSubscriptionsForUser(userUid);
  if (!subscriptions.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await webPush.sendNotification(subscription, body, { TTL: 120 });
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = Number(error?.statusCode || error?.status);
        if (statusCode === 404 || statusCode === 410) {
          await store.deactivateSubscription(row.endpoint).catch(() => {});
        }
        console.warn("[slot-monitor] push failed", {
          userUid,
          statusCode: statusCode || null,
        });
      }
    }),
  );

  return { sent, failed };
}

async function checkOneWatch(userUid, idToken, watch, { notify = true } = {}) {
  try {
    const result = await friendServices.FindFriendByUserName(idToken, watch.username);
    const snapshot = extractCelebritySnapshot(result);
    if (!snapshot) throw new Error("Celebrity slot data unavailable");

    const transition = computeTransition(watch, snapshot);
    await store.updateWatchSnapshot(userUid, watch.celeb_uid, transition);

    if (notify && transition.shouldNotify) {
      const count = transition.availableSlots;
      await sendPushToUser(userUid, {
        type: "slot-open",
        title: "🔥 Slot vừa mở!",
        body: `@${watch.username} vừa mở ${count} slot. Nhấn để kết bạn ngay!`,
        icon: watch.avatar_url || "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `slot-${watch.celeb_uid}`,
        url: `/friends?slot=1&username=${encodeURIComponent(watch.username)}`,
        celeb: {
          uid: watch.celeb_uid,
          username: watch.username,
          displayName: watch.display_name || watch.username,
          availableSlots: count,
          friendCount: transition.friendCount,
          maxFriends: transition.maxFriends,
        },
      });
    }

    return { ok: true, transition };
  } catch (error) {
    console.warn("[slot-monitor] celeb check failed", {
      userUid,
      username: watch.username,
      status: error?.response?.status || null,
      code: error?.code || null,
    });
    return { ok: false, error };
  }
}

async function checkUserWatches(userUid) {
  const idToken = await refreshUserSession(userUid);
  const watches = await store.listActiveWatchesForUser(userUid);

  for (let i = 0; i < watches.length; i += BATCH_SIZE) {
    const batch = watches.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((watch) => checkOneWatch(userUid, idToken, watch)));
    if (i + BATCH_SIZE < watches.length) await sleep(BATCH_DELAY_MS);
  }
}

async function runWorkerCycle() {
  if (workerRunning || !store.isConfigured() || !getEncryptionKey()) return;
  workerRunning = true;
  try {
    await store.ensureSchema();
    const users = await store.listActiveUsers();
    for (const row of users) {
      try {
        await checkUserWatches(row.user_uid);
      } catch (error) {
        console.warn("[slot-monitor] user cycle failed", {
          userUid: row.user_uid,
          code: error?.code || null,
        });
      }
    }
  } catch (error) {
    console.error("[slot-monitor] worker cycle failed", error?.message || error);
  } finally {
    workerRunning = false;
  }
}

function scheduleWorker() {
  const jitter = Math.floor((Math.random() * 2 - 1) * POLL_JITTER_MS);
  const delay = Math.max(60_000, POLL_INTERVAL_MS + jitter);
  workerTimer = setTimeout(async () => {
    await runWorkerCycle();
    scheduleWorker();
  }, delay);
  workerTimer.unref?.();
}

function startSlotMonitorWorker() {
  if (workerTimer || !store.isConfigured() || !getEncryptionKey()) {
    if (!store.isConfigured()) {
      console.warn("[slot-monitor] 24/7 worker disabled: DATABASE_URL missing");
    } else if (!getEncryptionKey()) {
      console.warn("[slot-monitor] 24/7 worker disabled: encryption secret missing");
    }
    return false;
  }

  console.log("[slot-monitor] 24/7 Railway worker enabled (about every 3 minutes)");
  const startup = setTimeout(runWorkerCycle, 15_000);
  startup.unref?.();
  scheduleWorker();
  return true;
}

async function checkNowForUser(userUid, celebUid, idToken) {
  const watches = await store.listUserWatches(userUid);
  const watch = watches.find((item) => String(item.celeb_uid) === String(celebUid));
  if (!watch) {
    const error = new Error("Không tìm thấy Celeb đang canh.");
    error.status = 404;
    error.code = "SLOT_WATCH_NOT_FOUND";
    throw error;
  }
  return checkOneWatch(userUid, idToken, watch, { notify: true });
}

module.exports = {
  POLL_INTERVAL_MS,
  getPublicConfig,
  enableBackgroundPush,
  validateAndSaveSession,
  sendPushToUser,
  checkNowForUser,
  runWorkerCycle,
  startSlotMonitorWorker,
};
