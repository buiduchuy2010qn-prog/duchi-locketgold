const asNonEmptyString = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

export function getPostedMomentData(responseBody) {
  if (!responseBody || typeof responseBody !== "object") return null;

  if (
    responseBody.data &&
    typeof responseBody.data === "object" &&
    !Array.isArray(responseBody.data)
  ) {
    return responseBody.data;
  }

  return responseBody;
}

/**
 * The upload queue reads mediaInfo again after PostMoments resolves.
 * Copy the permanent Firebase URLs returned by the API back into mediaInfo so
 * a temporary inline/blob URL or a thumbnail can never replace video_url.
 */
export function reconcilePostedMedia(payload, responseBody) {
  const mediaInfo = payload?.mediaInfo;
  const posted = getPostedMomentData(responseBody);

  if (!mediaInfo || !posted) return responseBody;

  const type = String(mediaInfo.type || payload?.contentType || "").toLowerCase();

  if (type === "video") {
    const videoUrl =
      asNonEmptyString(posted.video_url) ||
      asNonEmptyString(posted.videoUrl);
    const thumbnailUrl =
      asNonEmptyString(posted.thumbnail_url) ||
      asNonEmptyString(posted.thumbnailUrl) ||
      asNonEmptyString(posted.image_url) ||
      asNonEmptyString(posted.imageUrl);

    if (videoUrl) {
      mediaInfo.publicUrl = videoUrl;
      mediaInfo.publicURL = videoUrl;
      mediaInfo.downloadURL = videoUrl;
      mediaInfo.url = videoUrl;
      mediaInfo.videoUrl = videoUrl;
      mediaInfo.video_url = videoUrl;
    }

    if (thumbnailUrl) {
      mediaInfo.thumbnailUrl = thumbnailUrl;
      mediaInfo.thumbnail_url = thumbnailUrl;
    }

    return responseBody;
  }

  const imageUrl =
    asNonEmptyString(posted.image_url) ||
    asNonEmptyString(posted.imageUrl) ||
    asNonEmptyString(posted.thumbnail_url) ||
    asNonEmptyString(posted.thumbnailUrl);

  if (imageUrl) {
    mediaInfo.publicUrl = imageUrl;
    mediaInfo.publicURL = imageUrl;
    mediaInfo.downloadURL = imageUrl;
    mediaInfo.url = imageUrl;
  }

  return responseBody;
}
