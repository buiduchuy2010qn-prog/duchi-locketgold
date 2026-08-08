import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKGROUND_SOCKET_PAUSE_MS,
  RECOVERY_SYNC_MIN_INTERVAL_MS,
  pickRecentLoadedThreadIds,
  shouldPauseSocketForBackground,
  shouldRunRecoverySync,
} from "../../src/socket/realtimeRecoveryPolicy.js";

test("background socket only pauses after the grace period", () => {
  assert.equal(
    shouldPauseSocketForBackground({
      visibilityState: "hidden",
      hiddenForMs: BACKGROUND_SOCKET_PAUSE_MS - 1,
      online: true,
      connected: true,
    }),
    false,
  );

  assert.equal(
    shouldPauseSocketForBackground({
      visibilityState: "hidden",
      hiddenForMs: BACKGROUND_SOCKET_PAUSE_MS,
      online: true,
      connected: true,
    }),
    true,
  );

  assert.equal(
    shouldPauseSocketForBackground({
      visibilityState: "visible",
      hiddenForMs: BACKGROUND_SOCKET_PAUSE_MS * 2,
      online: true,
      connected: true,
    }),
    false,
  );
});

test("recovery sync requires a visible connected online tab", () => {
  const base = {
    recoveryEpoch: 1,
    isConnected: true,
    online: true,
    visibilityState: "visible",
    lastSyncAt: 0,
    now: 100_000,
  };

  assert.equal(shouldRunRecoverySync(base), true);
  assert.equal(shouldRunRecoverySync({ ...base, recoveryEpoch: 0 }), false);
  assert.equal(shouldRunRecoverySync({ ...base, isConnected: false }), false);
  assert.equal(shouldRunRecoverySync({ ...base, online: false }), false);
  assert.equal(
    shouldRunRecoverySync({ ...base, visibilityState: "hidden" }),
    false,
  );
});

test("recovery sync is throttled to avoid reconnect storms", () => {
  const now = 200_000;
  assert.equal(
    shouldRunRecoverySync({
      recoveryEpoch: 2,
      isConnected: true,
      online: true,
      visibilityState: "visible",
      lastSyncAt: now - RECOVERY_SYNC_MIN_INTERVAL_MS + 1,
      now,
    }),
    false,
  );

  assert.equal(
    shouldRunRecoverySync({
      recoveryEpoch: 2,
      isConnected: true,
      online: true,
      visibilityState: "visible",
      lastSyncAt: now - RECOVERY_SYNC_MIN_INTERVAL_MS,
      now,
    }),
    true,
  );
});

test("recent loaded message threads are selected by latest activity", () => {
  const ids = pickRecentLoadedThreadIds(
    {
      old: {
        hasFetched: true,
        items: [{ id: "1", update_time: 100 }],
      },
      newest: {
        hasFetched: true,
        items: [{ id: "2", update_time: 900 }],
      },
      middle: {
        items: [{ id: "3", created_at: 500 }],
      },
      untouched: {
        hasFetched: false,
        items: [],
      },
    },
    2,
  );

  assert.deepEqual(ids, ["newest", "middle"]);
});
