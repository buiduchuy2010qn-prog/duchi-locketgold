import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");

function activeIgnoreEntries(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

test("Vercel source build includes the Vite app and service worker", () => {
  const ignoreEntries = activeIgnoreEntries(
    readFileSync(resolve(repoRoot, ".vercelignore"), "utf8"),
  );

  assert.equal(ignoreEntries.includes("src"), false);
  assert.equal(ignoreEntries.includes("src/"), false);
  assert.equal(ignoreEntries.includes("public"), false);
  assert.equal(ignoreEntries.includes("public/"), false);
  assert.equal(ignoreEntries.includes("data"), false);
  assert.equal(ignoreEntries.includes("/data"), true);

  const serviceWorker = readFileSync(resolve(repoRoot, "src/sw.js"), "utf8");
  assert.match(serviceWorker, /precacheAndRoute/);

  const japanesePresets = readFileSync(
    resolve(repoRoot, "src/features/CustomeStudio/data/japaneseCaptionPresets.js"),
    "utf8",
  );
  assert.match(japanesePresets, /buildJapaneseCaptionSections/);
});
