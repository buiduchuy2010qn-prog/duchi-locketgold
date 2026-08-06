import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeMoment,
} = require("../../api/src/utils/normalize/normalizeMoment.js");

function firestoreDoc(fields) {
  return {
    name: "projects/demo/databases/(default)/documents/moments/test-moment",
    createTime: "2026-08-06T04:00:00.000Z",
    fields,
  };
}

test("backend không tạo object overlay giả khi bài không có caption", () => {
  const result = normalizeMoment(
    firestoreDoc({
      canonical_uid: { stringValue: "empty-overlay" },
      user: { stringValue: "user-1" },
      overlays: { arrayValue: { values: [] } },
    }),
  );

  assert.equal(result.caption, "");
  assert.equal(result.overlays, null);
});

test("backend lấy alt_text khi data.text bị rỗng", () => {
  const result = normalizeMoment(
    firestoreDoc({
      canonical_uid: { stringValue: "alt-text-caption" },
      user: { stringValue: "user-1" },
      overlays: {
        arrayValue: {
          values: [
            {
              mapValue: {
                fields: {
                  overlay_id: { stringValue: "caption:standard" },
                  overlay_type: { stringValue: "caption" },
                  alt_text: { stringValue: "🥺 君が恋しい" },
                  data: {
                    mapValue: {
                      fields: {
                        text: { stringValue: "" },
                        type: { stringValue: "standard" },
                        text_color: { stringValue: "#FFFFFFE6" },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    }),
  );

  assert.equal(result.caption, "🥺 君が恋しい");
  assert.equal(result.overlays?.text, "🥺 君が恋しい");
  assert.equal(result.overlays?.caption, "🥺 君が恋しい");
});

test("backend giữ music overlay dù text trống nếu payload có dữ liệu", () => {
  const result = normalizeMoment(
    firestoreDoc({
      canonical_uid: { stringValue: "music-overlay" },
      overlays: {
        arrayValue: {
          values: [
            {
              mapValue: {
                fields: {
                  overlay_id: { stringValue: "caption:music" },
                  overlay_type: { stringValue: "caption" },
                  data: {
                    mapValue: {
                      fields: {
                        text: { stringValue: "" },
                        type: { stringValue: "music" },
                        payload: {
                          mapValue: {
                            fields: {
                              isrc: { stringValue: "USRC17607839" },
                              song_title: { stringValue: "Test Song" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    }),
  );

  assert.equal(result.overlays?.type, "music");
  assert.equal(result.overlays?.payload?.song_title, "Test Song");
});
