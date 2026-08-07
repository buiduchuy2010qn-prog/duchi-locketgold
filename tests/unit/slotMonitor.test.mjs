import test from "node:test";
import assert from "node:assert/strict";
import {
  canClaimLeader,
  canSendBrowserNotification,
  computeSlotTransition,
  extractCelebritySnapshot,
  isLeaderLockStale,
  SLOT_STATUS,
  SLOT_WATCH_LIMIT,
} from "../../src/features/SlotMonitor/slotMonitorCore.js";
import {
  addWatch,
  clearAllWatch,
  getWatchedCelebs,
  removeWatch,
  SLOT_MONITOR_STORAGE_KEY,
  updateWatch,
} from "../../src/features/SlotMonitor/slotMonitorStorage.js";

class MemoryStorage {
  #map = new Map();
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
  clear() { this.#map.clear(); }
}

globalThis.localStorage = new MemoryStorage();

const makeCeleb = (index = 1) => ({
  uid: `uid-${index}`,
  username: `celeb${index}`,
  displayName: `Celeb ${index}`,
  avatar: `https://example.com/${index}.jpg`,
  friendCount: 1000,
  maxFriends: 1000,
});

const fullSnapshot = extractCelebritySnapshot({
  success: true,
  data: { celebrity_data: { friend_count: 1000, max_friends: 1000 } },
});
const openSnapshot = extractCelebritySnapshot({
  success: true,
  data: { celebrity_data: { friend_count: 999, max_friends: 1000 } },
});

test.beforeEach(() => {
  globalThis.localStorage.clear();
});

test("add watch persists the celeb without credentials", () => {
  addWatch(makeCeleb());
  const stored = getWatchedCelebs();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, SLOT_STATUS.WATCHING);
  assert.equal(stored[0].lastWasFull, true);
  assert.equal("idToken" in stored[0], false);
  assert.equal("accessToken" in stored[0], false);
});

test("remove watch deletes only the selected celeb", () => {
  addWatch(makeCeleb(1));
  addWatch(makeCeleb(2));
  removeWatch("uid-1");
  assert.deepEqual(getWatchedCelebs().map((item) => item.uid), ["uid-2"]);
});

test("storage survives a reload-style read", () => {
  addWatch(makeCeleb());
  const raw = globalThis.localStorage.getItem(SLOT_MONITOR_STORAGE_KEY);
  assert.ok(raw?.includes("celeb1"));
  assert.equal(getWatchedCelebs()[0].username, "celeb1");
});

test("duplicate watch does not create duplicate rows", () => {
  addWatch(makeCeleb());
  addWatch({ ...makeCeleb(), displayName: "Updated" });
  assert.equal(getWatchedCelebs().length, 1);
  assert.equal(getWatchedCelebs()[0].displayName, "Updated");
});

test("watch list is capped at 20 celebs", () => {
  for (let i = 0; i < SLOT_WATCH_LIMIT; i += 1) addWatch(makeCeleb(i));
  assert.throws(() => addWatch(makeCeleb(999)), /tối đa 20/);
  assert.equal(getWatchedCelebs().length, SLOT_WATCH_LIMIT);
});

test("friend_count equal max_friends is full", () => {
  assert.equal(fullSnapshot.isFull, true);
  assert.equal(fullSnapshot.isOpen, false);
});

test("friend_count below max_friends reports available slots", () => {
  assert.equal(openSnapshot.isOpen, true);
  assert.equal(openSnapshot.availableSlots, 1);
});

test("WATCHING transitions to SLOT_OPEN and notifies once", () => {
  const previous = { ...makeCeleb(), status: SLOT_STATUS.WATCHING, lastWasFull: true };
  const first = computeSlotTransition(previous, openSnapshot, 1234);
  assert.equal(first.shouldNotify, true);
  assert.equal(first.updates.status, SLOT_STATUS.SLOT_OPEN);
  assert.equal(first.updates.notifiedAt, 1234);

  const second = computeSlotTransition({ ...previous, ...first.updates }, openSnapshot, 5678);
  assert.equal(second.shouldNotify, false);
  assert.equal(second.updates.notifiedAt, 1234);
});

test("SLOT_OPEN becomes full again and rearms a later notification", () => {
  const opened = {
    ...makeCeleb(),
    status: SLOT_STATUS.SLOT_OPEN,
    lastWasFull: false,
    notifiedAt: 111,
  };
  const fullAgain = computeSlotTransition(opened, fullSnapshot, 222);
  assert.equal(fullAgain.updates.status, SLOT_STATUS.WATCHING);
  assert.equal(fullAgain.updates.lastWasFull, true);
  assert.equal(fullAgain.updates.notifiedAt, null);

  const reopened = computeSlotTransition({ ...opened, ...fullAgain.updates }, openSnapshot, 333);
  assert.equal(reopened.shouldNotify, true);
});

test("reload while slot is already open does not notify again", () => {
  const restored = {
    ...makeCeleb(),
    status: SLOT_STATUS.SLOT_OPEN,
    lastWasFull: false,
    notifiedAt: 100,
  };
  const result = computeSlotTransition(restored, openSnapshot, 200);
  assert.equal(result.shouldNotify, false);
  assert.equal(result.updates.notifiedAt, 100);
});

test("API error status updates do not remove the watch", () => {
  addWatch(makeCeleb());
  updateWatch("uid-1", { status: SLOT_STATUS.ERROR, errorCount: 3 });
  const stored = getWatchedCelebs();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, SLOT_STATUS.ERROR);
  assert.equal(stored[0].errorCount, 3);
});

test("clear all removes watches without reload", () => {
  addWatch(makeCeleb());
  clearAllWatch();
  assert.deepEqual(getWatchedCelebs(), []);
});

test("multi-tab leader lock rejects a fresh foreign leader", () => {
  const now = 10_000;
  const lock = { id: "tab-a", ts: now - 1_000 };
  assert.equal(isLeaderLockStale(lock, now), false);
  assert.equal(canClaimLeader(lock, "tab-b", now), false);
  assert.equal(canClaimLeader(lock, "tab-a", now), true);
});

test("multi-tab leader lock can be claimed after timeout", () => {
  const now = 100_000;
  const lock = { id: "dead-tab", ts: 1 };
  assert.equal(isLeaderLockStale(lock, now), true);
  assert.equal(canClaimLeader(lock, "new-tab", now), true);
});

test("browser notification respects granted and denied permission", () => {
  assert.equal(canSendBrowserNotification("granted", true), true);
  assert.equal(canSendBrowserNotification("denied", true), false);
  assert.equal(canSendBrowserNotification("granted", false), false);
});
