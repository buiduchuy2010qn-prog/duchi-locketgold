function getTextFromOverlay(overlay) {
  if (!overlay || typeof overlay !== "object") return "";
  const data = overlay.data && typeof overlay.data === "object" ? overlay.data : overlay;
  const value = data.text || data.caption || overlay.alt_text || "";
  return typeof value === "string" ? value.trim() : "";
}

function hasOverlayText(overlays) {
  if (Array.isArray(overlays)) {
    return overlays.some((overlay) => Boolean(getTextFromOverlay(overlay)));
  }
  return Boolean(getTextFromOverlay(overlays));
}

/**
 * Locket's immediate post response can omit caption/overlays even though the
 * submitted payload is valid and the official app shows it. Echo the submitted
 * overlay into the web response until Firestore realtime catches up.
 */
function preserveSubmittedOverlay(responseMoment, submittedPostData) {
  const moment =
    responseMoment && typeof responseMoment === "object" ? responseMoment : {};
  const requestData = submittedPostData?.data || submittedPostData || {};
  const submittedOverlays = Array.isArray(requestData.overlays)
    ? requestData.overlays
    : [];
  const submittedCaption =
    (typeof requestData.caption === "string" && requestData.caption.trim()) ||
    getTextFromOverlay(submittedOverlays[0]) ||
    "";

  if (submittedCaption && !String(moment.caption || "").trim()) {
    moment.caption = submittedCaption;
  }

  if (
    submittedOverlays.length &&
    (!hasOverlayText(moment.overlays) || !String(moment.caption || "").trim())
  ) {
    moment.overlays = submittedOverlays;
  }

  return moment;
}

module.exports = {
  getTextFromOverlay,
  hasOverlayText,
  preserveSubmittedOverlay,
};
