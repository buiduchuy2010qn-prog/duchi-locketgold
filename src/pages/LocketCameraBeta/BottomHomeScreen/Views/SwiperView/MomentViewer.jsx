import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { OverlayRenderer } from "@/components/Overlay";
import {
  useAuthStore,
  useMomentActivityStore,
  useUploadQueueStore,
  resolveMomentOwnerUid,
  resolveMyUid,
} from "@/stores";
import MomentOwnerInfo from "../../Layout/MomentOwnerInfo";

const NON_TEXT_OVERLAY_TYPES = new Set([
  "music",
  "poll",
  "review",
  "color_palette",
  "streak",
  "locket_count",
  "weather",
  "location",
  "battery",
  "time",
  "heart",
  "special",
  "decorative",
  "template",
  "image_icon",
  "image_gif",
  "caption_gif",
  "caption_image",
  "star_sign",
  "static_content",
]);

function hasObjectContent(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0,
  );
}

function isRenderableOverlayData(value) {
  if (!value) return false;
  if (Array.isArray(value)) {
    return value.some((item) => isRenderableOverlayData(item?.data || item));
  }
  if (typeof value !== "object") return false;

  const data = value.data && typeof value.data === "object" ? value.data : value;
  const text = data.text || data.caption || value.alt_text || "";
  if (typeof text === "string" && text.trim()) return true;

  const type = String(data.type || value.type || "").toLowerCase();
  const overlayId = String(value.overlay_id || data.overlay_id || "").toLowerCase();
  const resolvedType =
    type ||
    (overlayId.startsWith("caption:")
      ? overlayId.slice("caption:".length)
      : "");

  if (NON_TEXT_OVERLAY_TYPES.has(resolvedType)) return true;

  // Unknown non-caption overlays may be image/payload only. A plain caption
  // object with no text must stay false so it cannot erase the local caption.
  const isPlainCaption =
    !resolvedType ||
    resolvedType === "caption" ||
    resolvedType === "standard" ||
    resolvedType === "default";

  return (
    !isPlainCaption &&
    (hasObjectContent(data.payload) || hasObjectContent(data.icon))
  );
}

function resolveMomentOverlay(moment) {
  if (!moment || typeof moment !== "object") return null;

  const legacyCaption =
    (Array.isArray(moment.captions)
      ? moment.captions.find((item) => item?.text || item?.caption)
      : null) || null;

  const captionText =
    moment.caption || legacyCaption?.text || legacyCaption?.caption || "";

  if (Array.isArray(moment.overlays)) {
    if (isRenderableOverlayData(moment.overlays)) return moment.overlays;
  } else if (moment.overlays && typeof moment.overlays === "object") {
    const overlay = moment.overlays;
    const overlayText = overlay.text || overlay.caption || captionText || "";
    const resolved = {
      ...overlay,
      type: overlay.type || legacyCaption?.type || "caption",
      text: overlayText,
      caption: overlayText,
      text_color:
        overlay.text_color || overlay.textColor || legacyCaption?.text_color,
      icon: overlay.icon || legacyCaption?.icon || {},
      background: overlay.background || legacyCaption?.background || {},
      payload: overlay.payload || legacyCaption?.payload || {},
    };

    // API sync can return { type: "caption", text: null, ...style }.
    // Treat that as empty instead of replacing a valid local caption.
    if (isRenderableOverlayData(resolved)) return resolved;
  }

  if (!captionText) return null;

  return {
    type: legacyCaption?.type || "caption",
    overlay_id:
      legacyCaption?.type === "music" ? "caption:music" : "caption:standard",
    text: captionText,
    caption: captionText,
    text_color: legacyCaption?.text_color,
    icon: legacyCaption?.icon || {},
    background: legacyCaption?.background || {},
    payload: legacyCaption?.payload || {},
  };
}

const MomentViewer = ({ moment, handleClose }) => {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isImageReady, setIsImageReady] = useState(false);
  const stableOverlayRef = useRef({ momentId: null, data: null });

  const { user } = useAuthStore();
  const myUid = resolveMyUid(user);
  const ownerUid = resolveMomentOwnerUid(moment);
  const isOwnMoment = Boolean(myUid && ownerUid && myUid === ownerUid);

  const pollCounts = useMomentActivityStore((s) =>
    isOwnMoment && moment?.id ? s.byMomentId[moment.id]?.pollCounts : null,
  );

  // Upload queue persists the rich local caption/style before the first API
  // refresh. Use it as a fallback when Locket returns an empty overlay object.
  const postedMomentFallback = useUploadQueueStore((s) => {
    if (!moment?.id || !Array.isArray(s.postedMoments)) return null;
    return (
      s.postedMoments.find(
        (item) => item?.id === moment.id || item?.postId === moment.id,
      ) || null
    );
  });

  const thumbnailUrl =
    moment?.thumbnailUrl || moment?.thumbnail_url || moment?.image_url;
  const videoUrl = moment?.videoUrl || moment?.video_url;

  const resolvedOverlayData = useMemo(
    () =>
      resolveMomentOverlay(moment) || resolveMomentOverlay(postedMomentFallback),
    [moment, postedMomentFallback],
  );

  const momentId = moment?.id || null;
  if (stableOverlayRef.current.momentId !== momentId) {
    stableOverlayRef.current = { momentId, data: null };
  }
  if (resolvedOverlayData) {
    stableOverlayRef.current.data = resolvedOverlayData;
  }
  const overlayData = resolvedOverlayData || stableOverlayRef.current.data;

  return (
    <div className="flex w-full flex-col justify-center items-center">
      <div
        className="relative flex flex-col items-center w-full gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute flex justify-center items-center top-4 right-4 z-50 p-2 bg-black/40 rounded-full hover:bg-black/60"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="h-full w-full border-t border-b border-base-300 sm:max-w-sm max-w-md aspect-square flex items-center justify-center relative bg-gradient-to-br from-base-300/20 to-base-100/20 rounded-[64px] overflow-hidden">
          {/* Skeleton hiển thị lúc chờ load ảnh/video */}
          {!isImageReady && !isVideoReady && (
            <div className="absolute inset-0 w-full h-full skeleton rounded-[64px] z-0" />
          )}

          {/* 1️⃣ Thumbnail luôn hiển thị trước */}
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={moment?.caption || "Moment"}
              className={`absolute inset-0 w-full h-full object-cover rounded-[64px] transition-opacity duration-300 z-10 ${
                isVideoReady ? "opacity-0" : "opacity-100"
              }`}
              onLoad={() => setIsImageReady(true)}
            />
          )}

          {/* 2️⃣ Video load ngầm */}
          {videoUrl && (
            <video
              src={videoUrl}
              className={`absolute inset-0 w-full h-full object-cover rounded-[64px] transition-opacity duration-300 z-20 ${
                isVideoReady ? "opacity-100" : "opacity-0"
              }`}
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={() => setIsVideoReady(true)}
            />
          )}

          {/* Caption / music / poll luôn nằm trên ảnh-video */}
          <div className="absolute inset-0 z-30">
            <OverlayRenderer
              overlayData={overlayData}
              momentId={moment?.id}
              pollCounts={pollCounts}
              pollVariant={isOwnMoment ? "owner" : "friend"}
            />
          </div>
        </div>

        <MomentOwnerInfo
          user={moment?.user}
          date={moment?.createTime ?? moment?.date}
          groupId={moment?.group_id}
        />
      </div>
    </div>
  );
};

export default MomentViewer;
