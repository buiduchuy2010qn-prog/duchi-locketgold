import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { OverlayRenderer } from "@/components/Overlay";
import {
  useAuthStore,
  useMomentActivityStore,
  resolveMomentOwnerUid,
  resolveMyUid,
} from "@/stores";
import MomentOwnerInfo from "../../Layout/MomentOwnerInfo";

function resolveMomentOverlay(moment) {
  if (!moment || typeof moment !== "object") return null;

  const legacyCaption =
    (Array.isArray(moment.captions)
      ? moment.captions.find((item) => item?.text || item?.caption)
      : null) || null;

  const captionText =
    moment.caption || legacyCaption?.text || legacyCaption?.caption || "";

  if (Array.isArray(moment.overlays)) {
    if (moment.overlays.length > 0) return moment.overlays;
  } else if (moment.overlays && typeof moment.overlays === "object") {
    const overlay = moment.overlays;
    const overlayText = overlay.text || overlay.caption || captionText || "";

    // Không dùng `moment.overlays || captions[0]`: object overlay rỗng vẫn truthy
    // và từng làm caption alt_text trên app bị mất ở web.
    return {
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

  const { user } = useAuthStore();
  const myUid = resolveMyUid(user);
  const ownerUid = resolveMomentOwnerUid(moment);
  const isOwnMoment = Boolean(myUid && ownerUid && myUid === ownerUid);

  const pollCounts = useMomentActivityStore((s) =>
    isOwnMoment && moment?.id ? s.byMomentId[moment.id]?.pollCounts : null,
  );

  const thumbnailUrl =
    moment?.thumbnailUrl || moment?.thumbnail_url || moment?.image_url;
  const videoUrl = moment?.videoUrl || moment?.video_url;
  const overlayData = useMemo(() => resolveMomentOverlay(moment), [moment]);

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
