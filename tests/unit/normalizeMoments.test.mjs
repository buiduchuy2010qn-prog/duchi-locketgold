import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMoment,
  overlayFromOptionsData,
} from "../../src/utils/standardize/normalizeMoments.js";

test("caption top-level được dùng khi API trả overlay caption rỗng", () => {
  const moment = normalizeMoment({
    canonical_uid: "moment-caption-fallback",
    caption: "💗 恋って最高",
    overlays: {
      overlay_id: "caption:standard",
      overlay_type: "caption",
      type: "caption",
      text: "",
      caption: "",
      payload: {},
      icon: {},
    },
  });

  assert.equal(moment.caption, "💗 恋って最高");
  assert.equal(moment.overlays?.text, "💗 恋って最高");
  assert.equal(moment.captions[0]?.text, "💗 恋って最高");
});

test("overlay caption thật sự rỗng được chuyển thành null", () => {
  const moment = normalizeMoment({
    canonical_uid: "moment-empty-caption",
    overlays: {
      overlay_id: "caption:standard",
      overlay_type: "caption",
      type: "caption",
      text: "",
      caption: "",
      payload: {},
      icon: {},
    },
  });

  assert.equal(moment.caption, "");
  assert.equal(moment.overlays, null);
  assert.deepEqual(moment.captions, []);
});

test("music overlay không có text vẫn được giữ khi payload có dữ liệu", () => {
  const moment = normalizeMoment({
    canonical_uid: "moment-music",
    overlays: {
      overlay_id: "caption:music",
      overlay_type: "caption",
      type: "music",
      text: "",
      payload: {
        isrc: "USRC17607839",
        song_title: "Test Song",
      },
      icon: {},
    },
  });

  assert.equal(moment.overlays?.type, "music");
  assert.equal(moment.overlays?.payload?.song_title, "Test Song");
});

test("caption local giữ text, màu và background để dùng ngay sau đăng", () => {
  const overlay = overlayFromOptionsData({
    type: "custom",
    text: "🥺 君が恋しい",
    text_color: "#FFEEFF",
    background: {
      material_blur: "ultra_thin",
      colors: ["#8B5CF6", "#EC4899"],
    },
  });

  assert.equal(overlay.text, "🥺 君が恋しい");
  assert.equal(overlay.caption, "🥺 君が恋しい");
  assert.equal(overlay.text_color, "#FFEEFF");
  assert.deepEqual(overlay.background.colors, ["#8B5CF6", "#EC4899"]);
});
