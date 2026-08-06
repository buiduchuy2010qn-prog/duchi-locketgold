import api from "@/libs/axios";
import { reconcilePostedMedia } from "@/utils/upload/reconcilePostedMedia";

export const uploadMediaV2 = async (payload) => {
  const { mediaInfo } = payload;
  const fileType = mediaInfo.type;
  const timeoutDuration =
    fileType === "image" ? 5000 : fileType === "video" ? 10000 : 5000;

  const timeoutId = setTimeout(() => {
    console.log("⏳ Uploading is taking longer than expected...");
  }, timeoutDuration);

  try {
    const response = await api.post("/locket/postMomentV2", payload);
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
    const response = await api.post("/locket/postMomentV2", payload);

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
