import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLocalOverlayToMoment,
  overlayHasText,
} from "../../src/utils/overlay/reconcilePostedOverlay.js";

test("icon-only server overlay is not enough to replace local caption", () => {
  const merged = applyLocalOverlayToMoment(
    {
      id: "moment-1",
      overlays: {
        overlay_id: "caption:standard",
        type: "standard",
        text: "",
        icon: { type: "emoji", data: "💘" },
      },
    },
    {
      overlay_id: "caption:standard",
      type: "caption",
      text: "💘 大好きだよ",
      caption: "💘 大好きだよ",
      text_color: "#FFFFFFE6",
      background: { colors: ["#EC4899"] },
    },
  );

  assert.equal(merged.caption, "💘 大好きだよ");
  assert.equal(merged.overlays.text, "💘 大好きだよ");
  assert.equal(merged.captions[0].text, "💘 大好きだよ");
  assert.equal(overlayHasText(merged.overlays), true);
});
