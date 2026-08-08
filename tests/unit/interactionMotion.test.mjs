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
  assert.match(css, /#huy-locket-nav-drawer/);
  assert.match(css, /hl-moment-enter-lite/);
  assert.match(pageTransition, /useReducedMotion/);
  assert.match(pageTransition, /litePageVariants/);
  assert.match(pageTransition, /litePageTransition/);
  assert.doesNotMatch(pageTransition, /filter:\s*["']blur/);
});

test("menu slide animates Tailwind v4 translate and lite mode stays visible", () => {
  const css = read("src/styles/interaction-motion.css");

  assert.match(
    css,
    /#huy-locket-nav-drawer\s*\{[\s\S]*transition-property:\s*translate,\s*transform,\s*opacity/i,
  );
  assert.match(
    css,
    /data-performance-mode="lite"\]\s+#huy-locket-nav-drawer[\s\S]*170ms/i,
  );
  assert.match(
    css,
    /data-performance-mode="lite"\]\s+\.moment-enter\s*\{[\s\S]*hl-moment-enter-lite/i,
  );
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
