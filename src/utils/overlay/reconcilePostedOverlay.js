const textOf = (overlay) => {
  if (!overlay || typeof overlay !== "object") return "";
  if (Array.isArray(overlay)) {
    for (const item of overlay) {
      const text = textOf(item?.data || item);
      if (text) return text;
      if (typeof item?.alt_text === "string" && item.alt_text.trim()) {
        return item.alt_text.trim();
      }
    }
    return "";
  }
  const value = overlay.text || overlay.caption || overlay.alt_text || "";
  return typeof value === "string" ? value.trim() : "";
};

export function overlayHasText(overlay) {
  return Boolean(textOf(overlay));
}

/**
 * Caption/style selected in the composer is the source of truth for the
 * optimistic feed item. Locket's immediate response can contain an icon or an
 * empty overlay but omit the text for a short time.
 */
export function applyLocalOverlayToMoment(moment, localOverlay) {
  if (!moment || !localOverlay) return moment;

  const localText = textOf(localOverlay);
  if (!localText) return moment;

  const serverOverlay =
    moment.overlays && typeof moment.overlays === "object" && !Array.isArray(moment.overlays)
      ? moment.overlays
      : {};

  const mergedOverlay = {
    ...serverOverlay,
    ...localOverlay,
    text: localText,
    caption: localText,
    payload: {
      ...(serverOverlay.payload || {}),
      ...(localOverlay.payload || {}),
    },
    icon:
      localOverlay.icon && Object.keys(localOverlay.icon).length
        ? localOverlay.icon
        : serverOverlay.icon || {},
    background:
      localOverlay.background && Object.keys(localOverlay.background).length
        ? localOverlay.background
        : serverOverlay.background || {},
  };

  return {
    ...moment,
    caption: localText,
    overlays: mergedOverlay,
    captions: [
      {
        text: localText,
        caption: localText,
        text_color:
          mergedOverlay.text_color || mergedOverlay.textColor || "#FFFFFFE6",
        icon: mergedOverlay.icon || {},
        background: mergedOverlay.background || {},
        type: mergedOverlay.type || "caption",
        payload: mergedOverlay.payload || {},
      },
    ],
  };
}
