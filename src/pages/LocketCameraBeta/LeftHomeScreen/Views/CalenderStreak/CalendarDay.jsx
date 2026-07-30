import React from "react";
import { Plus, Video, ImageIcon } from "lucide-react";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import { usePostStore } from "@/stores";
import clsx from "clsx";
import { dateToYYYYMMDD } from "./streakUtils";
import { useAppNavigation } from "@/context/AppContext";
import { useTranslation } from "react-i18next";

export default function CalendarDay({
  day,
  posts = [],
  isInCurrentStreak = false,
  isInPastStreak = false,
  isInCurrentRecover = false,
  isInPastRecover = false,
  isRestoreCurrentIcon = false,
  isRestorePastIcon = false,
  currentStreak = null,
  pastStreak = null,
  showPlusIcon = false,
  onDayClick,
}) {
  const setRestoreStreakData = usePostStore((s) => s.setRestoreStreakData);
  const { setIsProfileOpen } = useAppNavigation();
  const { t } = useTranslation("main");

  if (!day) return null;

  const dayKey = `${day.getFullYear()}-${(day.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${day.getDate().toString().padStart(2, "0")}`;

  const handleRestoreClick = (e) => {
    e.stopPropagation();
    const formattedDate = day.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Display the sonnerToast
    SonnerInfo(
      t("left.restore_streak_title", { date: formattedDate }),
      t("left.restore_streak_desc"),
    );

    // Set the recovery mode details in store
    setRestoreStreakData({
      data: dateToYYYYMMDD(day),
      mode: "restore",
      name: t("left.restore_streak_mode"),
    });

    // Close profile open state to return to camera home screen
    if (setIsProfileOpen) {
      setIsProfileOpen(false);
    }
  };

  const showRestoreIcon = isRestoreCurrentIcon || isRestorePastIcon;

  // Lấy bài mới nhất trong ngày (ở cuối mảng nếu mảng xếp theo thời gian tăng dần, hoặc tuỳ cấu trúc)
  // posts từ DB thường được sắp xếp. Ta lấy post cuối cùng làm ảnh đại diện.
  const displayPost = posts.length > 0 ? posts[posts.length - 1] : null;
  const isVideo = displayPost?.contentType === "video" || displayPost?.video_url;
  const displayUrl = displayPost?.thumbnail_url || displayPost?.image_url;

  const handleClick = (e) => {
    if (posts.length > 0 && onDayClick) {
      onDayClick(posts, day);
    }
  };

  return (
    <div
      className={clsx(
        "aspect-square rounded-xl border flex flex-col overflow-hidden cursor-pointer group relative",
        {
          // Current streak highlights
          "border-yellow-400 border-3 bg-base-200": isInCurrentStreak || showPlusIcon,
          // Past streak highlights
          "border-gray-400 border-3 bg-base-200": isInPastStreak,
          // Current recovery dashed border
          "border-yellow-400 border-2 border-dashed bg-base-200/50":
            isInCurrentRecover,
          // Past recovery dashed border
          "border-gray-400 border-2 border-dashed bg-base-200/50":
            isInPastRecover,
          // Normal days with no streak or recovery active
          "border-base-content/10 hover:border-base-content/30":
            !isInCurrentStreak &&
            !isInPastStreak &&
            !isInCurrentRecover &&
            !isInPastRecover &&
            !showPlusIcon,
        },
      )}
      title={
        posts.length > 0
          ? posts[0].createdAt // Original creation time for tooltip
          : dayKey
      }
      onClick={handleClick}
    >
      {/* Day number */}
      <div
        className={clsx(
          "absolute mt-1 ml-1 z-20 text-[10px] font-semibold mb-1 select-none",
          {
            "text-white drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)]":
              posts.length !== 0,
            "text-base-content/70": posts.length === 0,
          },
        )}
      >
        {day.getDate()}
      </div>

      {/* Restore Icon */}
      {showRestoreIcon && (
        <div
          className="absolute z-30 inset-0 flex justify-center items-center select-none bg-amber-500/10 backdrop-blur-[1px] hover:bg-amber-500/20 transition-colors"
          aria-hidden="true"
          onClick={handleRestoreClick}
        >
          <img
            src="https://cdn.locket-dio.com/v1/caption/caption-icon/streak_restore.png"
            alt="Restore Streak"
            className="w-6 h-6 object-contain animate-pulse"
          />
        </div>
      )}

      {/* Plus icon on today if no post and streak is active */}
      {showPlusIcon && (
        <div
          className="absolute z-30 inset-0 flex justify-center items-center text-green-600 select-none bg-amber-50/70 hover:bg-amber-50 transition-colors"
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            SonnerInfo(t("left.continue_streak_prompt"));
          }}
        >
          <Plus strokeWidth={4} size={20} />
        </div>
      )}

      {/* Post thumbnail (if any) */}
      {posts.length === 0 ? (
        <div className="flex-1" />
      ) : (
        <div className="flex-1 overflow-hidden relative">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Locket thumbnail"
              className="object-cover w-full h-full"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-300 text-base-content/30">
              {isVideo ? <Video size={16} /> : <ImageIcon size={16} />}
            </div>
          )}
          {isVideo && (
            <div className="absolute top-1 right-1 z-20 drop-shadow-md text-white">
              <Video size={12} className="fill-white/80" />
            </div>
          )}
        </div>
      )}

      {/* Current streak number badge at the end of current streak range */}
      {currentStreak && day.getTime() === currentStreak.end.getTime() && (
        <div className="absolute z-20 bg-yellow-400 text-yellow-800 text-[10px] px-1 font-bold bottom-0 right-0 rounded-tl-md">
          {currentStreak.count}
        </div>
      )}

      {/* Past streak number badge at the end of past streak range */}
      {pastStreak && day.getTime() === pastStreak.end.getTime() && (
        <div className="absolute z-20 bg-gray-400 text-black text-[10px] px-1 font-bold bottom-0 right-0 rounded-tl-md">
          {pastStreak.count}
        </div>
      )}
      
      {/* Badge for multiple posts */}
      {posts.length > 1 && (
        <div className="absolute z-20 bg-blue-500 text-white text-[10px] px-1 font-bold bottom-0 right-0 rounded-tl-md">
          {posts.length}
        </div>
      )}
    </div>
  );
}

