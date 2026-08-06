import test from "node:test";
import assert from "node:assert/strict";
import {
  createMomentCaptionSnapshot,
  getMomentCaptionIdentityKeys,
  getMomentCaptionText,
  restoreMomentCaption,
} from "../../src/utils/moment/preserveMomentCaption.js";

test("snapshot giữ caption cùng màu và nền", () => {
  const moment = {
    id: "moment-1",
    image_url: "https://cdn.locketcamera.com/users/u/moments/a.webp?token=1",
    caption: "💘 大好きだよ",
    overlays: {
      type: "caption",
      text: "💘 大好きだよ",
      text_color: "#FFFFFFE6",
      background: { colors: ["#EC4899"] },
    },
  };

  const snapshot = createMomentCaptionSnapshot(moment);
  assert.equal(snapshot.text, "💘 大好きだよ");
  assert.deepEqual(snapshot.overlays.background.colors, ["#EC4899"]);
});

test("realtime overlay rỗng được phục hồi từ caption hợp lệ gần nhất", () => {
  const snapshot = createMomentCaptionSnapshot({
    id: "moment-2",
    caption: "💘 君だけ",
    overlays: {
      overlay_id: "caption:standard",
      type: "caption",
      text: "💘 君だけ",
      background: { colors: ["#EC4899"] },
    },
  });

  const incompleteRealtime = {
    id: "moment-2",
    caption: "",
    overlays: {},
    captions: [],
    image_url: "https://cdn.test/moment.webp",
  };

  const repaired = restoreMomentCaption(incompleteRealtime, snapshot);
  assert.equal(getMomentCaptionText(repaired), "💘 君だけ");
  assert.equal(repaired.overlays.text, "💘 君だけ");
});

test("không thay caption thật mà server đã trả", () => {
  const snapshot = createMomentCaptionSnapshot({
    id: "moment-3",
    caption: "caption local",
  });

  const serverMoment = {
    id: "moment-3",
    caption: "caption server",
    overlays: { text: "caption server" },
  };

  assert.equal(restoreMomentCaption(serverMoment, snapshot), serverMoment);
});

test("URL CDN và Firebase vẫn có khóa tên file chung", () => {
  const cdnKeys = getMomentCaptionIdentityKeys({
    image_url: "https://cdn.locketcamera.com/users/u/moments/abc.webp?x=1",
  });
  const firebaseKeys = getMomentCaptionIdentityKeys({
    image_url:
      "https://firebasestorage.googleapis.com/v0/b/app/o/users%2Fu%2Fmoments%2Fabc.webp?alt=media",
  });

  assert.ok(cdnKeys.includes("file:abc.webp"));
  assert.ok(firebaseKeys.includes("file:abc.webp"));
});
