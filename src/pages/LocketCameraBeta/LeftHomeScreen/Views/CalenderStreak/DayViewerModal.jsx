import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, Video, ImageIcon } from "lucide-react";

export default function DayViewerModal({ posts = [], onClose, titleDate = "" }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!posts || posts.length === 0) return null;

  const currentPost = posts[currentIndex];
  const isVideo =
    currentPost?.contentType === "video" || currentPost?.video_url;
  
  // Use video_url if video, otherwise image_url or thumbnail_url.
  const mediaUrl = isVideo
    ? currentPost?.video_url
    : currentPost?.image_url || currentPost?.thumbnail_url;
  const fallbackUrl = currentPost?.thumbnail_url || currentPost?.image_url;

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentIndex < posts.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Header */}
      <div className="absolute top-0 w-full flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="text-white font-semibold text-lg drop-shadow-md">{titleDate}</div>
        <button
          onClick={onClose}
          className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Content Area */}
      <div 
        className="relative w-full h-full md:w-auto md:h-auto md:max-w-md md:aspect-[3/4] md:rounded-3xl flex items-center justify-center bg-black overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaUrl ? (
          isVideo ? (
            <video
              src={mediaUrl}
              autoPlay
              loop
              playsInline
              poster={fallbackUrl}
              className="w-full h-full object-cover md:object-contain"
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Locket Post"
              className="w-full h-full object-cover md:object-contain"
            />
          )
        ) : (
          <div className="flex flex-col items-center text-white/50 space-y-3">
            {isVideo ? <Video size={48} /> : <ImageIcon size={48} />}
            <p className="font-medium">Không có dữ liệu media</p>
          </div>
        )}

        {/* Navigation Overlays */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
        )}
        
        {currentIndex < posts.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
          >
            <ChevronRight size={28} />
          </button>
        )}

        {/* Pagination Indicator */}
        {posts.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10 drop-shadow-md">
            {posts.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
