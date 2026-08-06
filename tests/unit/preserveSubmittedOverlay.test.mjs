import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  preserveSubmittedOverlay,
} = require("../../api/src/modules/moment/utils/preserveSubmittedOverlay.js");

test("response thiếu caption được bổ sung từ payload đã gửi", () => {
  const result = preserveSubmittedOverlay(
    {
      canonical_uid: "moment-1",
      overlays: {
        overlay_id: "caption:standard",
        type: "standard",
        text: "",
        icon: { type: "emoji", data: "💘" },
      },
    },
    {
      data: {
        caption: "💘 大好きだよ",
        overlays: [
          {
            overlay_id: "caption:standard",
            overlay_type: "caption",
            alt_text: "💘 大好きだよ",
            data: {
              type: "standard",
              text: "💘 大好きだよ",
              text_color: "#FFFFFFE6",
            },
          },
        ],
      },
    },
  );

  assert.equal(result.caption, "💘 大好きだよ");
  assert.ok(Array.isArray(result.overlays));
  assert.equal(result.overlays[0].data.text, "💘 大好きだよ");
});

test("response đã có caption thật không bị thay thế", () => {
  const result = preserveSubmittedOverlay(
    {
      caption: "server caption",
      overlays: [
        {
          alt_text: "server caption",
          data: { text: "server caption", type: "standard" },
        },
      ],
    },
    {
      data: {
        caption: "local caption",
        overlays: [
          {
            alt_text: "local caption",
            data: { text: "local caption", type: "standard" },
          },
        ],
      },
    },
  );

  assert.equal(result.caption, "server caption");
  assert.equal(result.overlays[0].data.text, "server caption");
});
