import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

test("slot push client subscribes through service worker and authenticated backend", () => {
  const source = read("src/features/SlotMonitor/slotPushService.js");
  assert.match(source, /navigator\.serviceWorker\.ready/);
  assert.match(source, /pushManager\.subscribe/);
  assert.match(source, /api\/slot-monitor\/enable/);
  assert.match(source, /refreshToken/);
});

test("slot monitor syncs watches to Railway and exposes a 24\/7 sidebar entry", () => {
  const provider = read("src/features/SlotMonitor/SlotMonitorProvider.jsx");
  const sidebar = read("src/components/Sidebar/index.jsx");
  assert.match(provider, /syncSlotWatch/);
  assert.match(provider, /enableBackgroundPush/);
  assert.match(sidebar, /\/friends\?slot=1/);
  assert.match(sidebar, /Canh Slot/);
  assert.match(sidebar, /24\/7/);
});

test("service worker handles push and notification clicks", () => {
  const sw = read("src/sw.js");
  assert.match(sw, /addEventListener\(["']push["']/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /addEventListener\(["']notificationclick["']/);
  assert.match(sw, /openWindow/);
});

test("Railway API mounts persistent slot monitor worker", () => {
  const app = read("api/app.js");
  const routes = read("api/src/routes/index.js");
  assert.match(app, /startSlotMonitorWorker/);
  assert.match(routes, /slot-monitor/);
});

test("auto Celeb request is opt-in and wired to the real Locket follow request", () => {
  const worker = read("api/src/modules/slotMonitor/service.js");
  const requestService = read("api/src/services/LocketFriend/RequestServices.js");
  const store = read("api/src/modules/slotMonitor/store.js");
  const ui = read("src/features/SlotMonitor/SlotWatchInline.jsx");

  assert.match(store, /auto_request_enabled BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(worker, /appCheckServices\.getOrCreateAppCheckToken/);
  assert.match(worker, /requestServices\.SendAddCelebrity/);
  assert.match(requestService, /instanceLocketV2\.post\("sendFollowRequest"/);
  assert.match(requestService, /intent:\s*"add-friend"/);
  assert.match(worker, /status:\s*"SENT"/);
  assert.match(worker, /status:\s*"FAILED"/);
  assert.match(ui, /Tự gửi request Celeb khi có slot/);
});
