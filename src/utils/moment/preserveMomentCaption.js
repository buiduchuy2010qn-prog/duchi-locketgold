const asText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

function overlayText(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    for (const item of value) {
      const text =
        overlayText(item?.data || item) || asText(item?.alt_text);
      if (text) return text;
    }
    return "";
  }

  if (typeof value !== "object") return "";

  return (
    asText(value.text) ||
    asText(value.caption) ||
    asText(value.alt_text) ||
    overlayText(value.data)
  );
}

function firstLegacyCaption(moment) {
  if (!Array.isArray(moment?.captions)) return null;
  return (
    moment.captions.find(
      (item) => asText(item?.text) || asText(item?.caption),
    ) || null
  );
}

export function getMomentCaptionText(moment) {
  if (!moment || typeof moment !== "object") return "";

  const legacy = firstLegacyCaption(moment);
  return (
    overlayText(moment.overlays) ||
    asText(moment.caption) ||
    asText(legacy?.text) ||
    asText(legacy?.caption)
  );
}

export function createMomentCaptionSnapshot(moment) {
  const text = getMomentCaptionText(moment);
  if (!text) return null;

  const legacy = firstLegacyCaption(moment);
  let overlays = moment?.overlays || null;

  if (!overlays) {
    overlays = {
      overlay_id: "caption:standard",
      overlay_type: "caption",
      type: legacy?.type || "caption",
      text,
      caption: text,
      text_color: legacy?.text_color || "#FFFFFFE6",
      background: legacy?.background || {},
      icon: legacy?.icon || {},
      payload: legacy?.payload || {},
    };
  }

  const captions =
    Array.isArray(moment?.captions) && moment.captions.length
      ? moment.captions
      : [
          {
            text,
            caption: text,
            text_color:
              overlays?.text_color || overlays?.textColor || "#FFFFFFE6",
            background: overlays?.background || {},
            icon: overlays?.icon || {},
            payload: overlays?.payload || {},
            type: overlays?.type || "caption",
          },
        ];

  return {
    text,
    caption: text,
    overlays,
    captions,
  };
}

function mediaKey(value) {
  if (!asText(value)) return [];

  try {
    const url = new URL(value, "https://huy-locket.local");
    const decodedPath = decodeURIComponent(url.pathname).toLowerCase();
    const fileName = decodedPath.split("/").filter(Boolean).pop() || "";
    return [
      `media:${decodedPath}`,
      fileName ? `file:${fileName}` : "",
    ].filter(Boolean);
  } catch {
    const clean = String(value).split("?")[0].split("#")[0].toLowerCase();
    const fileName = clean.split("/").filter(Boolean).pop() || "";
    return [`media:${clean}`, fileName ? `file:${fileName}` : ""].filter(
      Boolean,
    );
  }
}

export function getMomentCaptionIdentityKeys(moment) {
  if (!moment || typeof moment !== "object") return [];

  const keys = [];
  const add = (prefix, value) => {
    const text = asText(value);
    if (text) keys.push(`${prefix}:${text}`);
  };

  add("id", moment.id);
  add("id", moment.canonical_uid);
  add("id", moment.canonicalUid);
  add("md5", moment.md5);

  const mediaValues = [
    moment.image_url,
    moment.imageUrl,
    moment.video_url,
    moment.videoUrl,
    moment.thumbnail_url,
    moment.thumbnailUrl,
  ];

  for (const value of mediaValues) {
    keys.push(...mediaKey(value));
  }

  return [...new Set(keys)];
}

export function restoreMomentCaption(moment, snapshot) {
  if (!moment || !snapshot?.text) return moment;
  if (getMomentCaptionText(moment)) return moment;

  return {
    ...moment,
    caption: snapshot.text,
    overlays: snapshot.overlays,
    captions: snapshot.captions,
  };
}
