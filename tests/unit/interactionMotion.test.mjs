import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("interaction motion pack is loaded and respects accessibility/performance", () => {
  const main = read("src/main.jsx");
  const css = read("src/styles/interaction-motion.css");
  const pageTransition = read("src/components/Effects/PageTransition.jsx");

  assert.match(main, /interaction-motion\.css/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /data-performance-mode="lite"/);
  assert.match(pageTransition, /useReducedMotion/);
  assert.doesNotMatch(pageTransition, /filter:\s*["']blur/);
});

test("moment loading and modal motion stay opt-in", () => {
  const viewer = read(
    "src/pages/LocketCameraBeta/BottomHomeScreen/Views/SwiperView/MomentViewer.jsx",
  );
  const modal = read("src/components/MomentDraft/RestoreDraftModal.jsx");

  assert.match(viewer, /moment-enter/);
  assert.match(viewer, /moment-skeleton/);
  assert.match(viewer, /moment-overlay-enter/);
  assert.match(modal, /interaction-modal-backdrop/);
  assert.match(modal, /interaction-modal-card/);
});
