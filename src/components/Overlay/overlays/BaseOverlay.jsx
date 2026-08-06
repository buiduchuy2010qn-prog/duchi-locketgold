import React from "react";
import IconRenderer from "../icons/IconRenderer";
import { getCaptionStyle } from "@/helpers/styleHelpers";

function BaseOverlay({ overlayData }) {
  const textColor =
    overlayData?.textColor || overlayData?.text_color || "#ffffff";
  const background = overlayData?.background || {};
  const Icon = IconRenderer({ icon: overlayData?.icon });
  const text = overlayData?.text || overlayData?.caption || "";

  if (!text) return null;

  return (
    <div
      className="absolute left-1/2 bottom-4 z-[100] w-fit max-w-[80%] -translate-x-1/2 rounded-3xl px-2.5 py-2 backdrop-blur-sm"
      style={{
        // Keep the caption in a higher stacking layer than the image/video.
        // Inline z-index is intentional: the recording showed the caption while
        // the placeholder was visible, then the loaded image covered it.
        zIndex: 100,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        ...getCaptionStyle(background, textColor),
      }}
    >
      <div className="flex flex-row items-center justify-center gap-1.5 text-md font-bold">
        {Icon}
        <span>{text}</span>
      </div>
    </div>
  );
}

export default BaseOverlay;
