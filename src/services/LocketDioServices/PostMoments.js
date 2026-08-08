import api from "@/libs/axios";
import { reconcilePostedMedia } from "@/utils/upload/reconcilePostedMedia";

function emitUploadProgress(payload, progressEvent, phase = "uploading") {
  if (typeof window === "undefined") return;
  const loaded = Number(progressEvent?.loaded || 0);
  const total = Number(progressEvent?.total || 0);
  const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;
  const rate = Number(progressEvent?.rate || 0);
  const estimated = Number(progressEvent?.estimated || 0);
  window.dispatchEvent(
    new CustomEvent("huy-locket-upload-progress", {
      detail: {
        id: payload?.id || payload?.draftId || "",
        draftId: payload?.draftId || "",
        loaded,
        total,
        progress,
        speedBps: rate > 0 ? rate : null,
        estimatedSeconds: estimated > 0 ? estimated : null,
        phase,
        at: Date.now(),
      },
    }),
  );
}

function uploadConfig(payload) {
  return {
    onUploadProgress: (event) => emitUploadProgress(payload, event, "uploading"),
  };
}

function emitServerProcessing(payload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("huy-locket-upload-progress", {
      detail: {
        id: payload?.id || payload?.draftId || "",
        draftId: payload?.draftId || "",
        progress: 100,
        phase: "processing",
        at: Date.now(),
      },
    }),
  );
}

export const uploadMediaV2 = async (payload) => {
  const { mediaInfo } = payload;
  const fileType = mediaInfo.type;
  const timeoutDuration =
    fileType === "image" ? 5000 : fileType === "video" ? 10000 : 5000;

  const timeoutId = setTimeout(() => {
    console.log("⏳ Uploading is taking longer than expected...");
  }, timeoutDuration);

  try {
    const response = await api.post("/locket/postMomentV2", payload, uploadConfig(payload));
    emitServerProcessing(payload);
    reconcilePostedMedia(payload, response.data);
    console.log("✅ Upload thành công:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Lỗi khi upload:", error.response?.data || error.message);

    if (error.response) {
      console.error("📡 Server Error:", error.response);
    } else {
      console.error("🌐 Network Error:", error.message);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const PostMoments = async (payload) => {
  try {
    const response = await api.post("/locket/postMomentV2", payload, uploadConfig(payload));
    emitServerProcessing(payload);

    // The queue examines payload.mediaInfo again after this promise resolves.
    // Preserve the permanent API URLs before it builds the optimistic moment.
    reconcilePostedMedia(payload, response.data);

    console.log("✅ Upload thành công:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Lỗi khi upload:", error.response?.data || error.message);

    if (error.response) {
      console.error("📡 Server Error:", error.response);
    } else {
      console.error("🌐 Network Error:", error.message);
    }

    throw error;
  }
};