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

test("Vercel receives the Vite source, public assets, service worker and nested data", () => {
  const ignoreEntries = activeIgnoreEntries(
    readFileSync(resolve(repoRoot, ".vercelignore"), "utf8"),
  );

  for (const forbidden of ["src", "src/", "public", "public/", "data"]) {
    assert.equal(
      ignoreEntries.includes(forbidden),
      false,
      `${forbidden} must not be ignored by Vercel`,
    );
  }

  assert.ok(ignoreEntries.includes("/data"));
  assert.match(
    readFileSync(resolve(repoRoot, "src/sw.js"), "utf8"),
    /precacheAndRoute/,
  );
  assert.match(
    readFileSync(
      resolve(
        repoRoot,
        "src/features/CustomeStudio/data/japaneseCaptionPresets.js",
      ),
      "utf8",
    ),
    /buildJapaneseCaptionSections/,
  );
});
