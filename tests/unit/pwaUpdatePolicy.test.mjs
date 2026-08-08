import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const swSource = await readFile(new URL("../../src/sw.js", import.meta.url), "utf8");
const watcherSource = await readFile(
  new URL("../../src/utils/pwaUtils/updateWatcher.js", import.meta.url),
  "utf8",
);

test("service-worker updates wait for explicit user activation", () => {
  assert.match(swSource, /self\.registration\.active\s*\?\s*Promise\.resolve\(\)/);
  assert.match(swSource, /event\.data\?\.type\s*===\s*"SKIP_WAITING"/);
  assert.doesNotMatch(
    swSource,
    /Always skipWaiting so updates apply immediately/,
  );
});

test("slow mobile navigation has time to fetch the newest HTML", () => {
  assert.match(swSource, /networkTimeoutSeconds:\s*4/);
});

test("version checks cannot hang indefinitely", () => {
  assert.match(watcherSource, /VERSION_FETCH_TIMEOUT_MS\s*=\s*8\s*\*\s*1000/);
  assert.match(watcherSource, /signal:\s*controller\.signal/);
  assert.match(watcherSource, /clearTimeout\(timeout\)/);
});
