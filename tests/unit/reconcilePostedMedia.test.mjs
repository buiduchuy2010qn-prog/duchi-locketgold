import test from "node:test";
import assert from "node:assert/strict";
import {
  getPostedMomentData,
  reconcilePostedMedia,
} from "../../src/utils/upload/reconcilePostedMedia.js";

test("lấy dữ liệu moment từ response body có lớp data", () => {
  const posted = { id: "moment-1", image_url: "https://cdn.test/a.webp" };
  assert.equal(getPostedMomentData({ success: true, data: posted }), posted);
});

test("video giữ URL mp4 vĩnh viễn thay vì bị thumbnail ghi đè", () => {
  const payload = {
    contentType: "video",
    mediaInfo: {
      type: "video",
      publicUrl: "inline://local",
      thumbnailUrl: "blob:temporary",
    },
  };

  reconcilePostedMedia(payload, {
    success: true,
    data: {
      id: "moment-video",
      video_url:
        "https://firebasestorage.googleapis.com/v0/b/locket-video/o/users%2Fu%2Fmoments%2Fvideos%2Fv.mp4?alt=media&token=1",
      thumbnail_url:
        "https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2Fu%2Fmoments%2Fthumbnails%2Fv.webp?alt=media&token=2",
    },
  });

  assert.match(payload.mediaInfo.publicUrl, /\.mp4\?/);
  assert.match(payload.mediaInfo.video_url, /\.mp4\?/);
  assert.match(payload.mediaInfo.thumbnailUrl, /\.webp\?/);
  assert.notEqual(
    payload.mediaInfo.video_url,
    payload.mediaInfo.thumbnailUrl,
  );
});

test("ảnh dùng image_url trả về từ API", () => {
  const payload = {
    contentType: "image",
    mediaInfo: { type: "image", publicUrl: "inline://local" },
  };

  reconcilePostedMedia(payload, {
    data: { image_url: "https://cdn.test/image.webp" },
  });

  assert.equal(payload.mediaInfo.publicUrl, "https://cdn.test/image.webp");
  assert.equal(payload.mediaInfo.downloadURL, "https://cdn.test/image.webp");
});
