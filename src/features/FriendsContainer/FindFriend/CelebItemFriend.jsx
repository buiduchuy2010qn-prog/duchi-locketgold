import React from "react";
import { Bell, BellOff, Flame, Plus, UserRoundCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSlotMonitor } from "../../SlotMonitor/useSlotMonitor";
import { SLOT_STATUS } from "../../SlotMonitor/slotMonitorCore";

export default function CelebItemFriend({
  friend,
  handleAddFriend,
  loading = false,
  disabled = false,
}) {
  const { t } = useTranslation("features");
  const { getWatch, watchCeleb, unwatchCeleb } = useSlotMonitor();
  const friendCount = friend?.celebrity_data?.friend_count ?? 0;
  const maxFriends = friend?.celebrity_data?.max_friends ?? 0;

  const isSlotFull = maxFriends > 0 && friendCount >= maxFriends;
  const watch = getWatch(friend.uid);
  const isAlreadyFriend = friend?.friendship_status === "friends";
  const canShowWatch = !isAlreadyFriend && (isSlotFull || Boolean(watch));

  const progressPercent =
    maxFriends > 0 ? Math.min((friendCount / maxFriends) * 100, 100) : 0;

  const handleWatchToggle = async (event) => {
    event.stopPropagation();
    if (watch) {
      unwatchCeleb(friend.uid);
      return;
    }
    await watchCeleb({
      uid: friend.uid,
      username: friend.username,
      displayName: `${friend.first_name || ""} ${friend.last_name || ""}`.trim() || friend.username,
      avatar: friend.profile_picture_url,
      friendCount,
      maxFriends,
    });
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-16 h-16 flex-shrink-0">
            <img
              src={friend.profile_picture_url || "/images/default_profile.png"}
              alt={`${friend?.first_name} ${friend?.last_name}`}
              className="w-16 h-16 rounded-full border-[3.5px] p-0.5 border-amber-400 object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/images/default_profile.png";
              }}
            />
            <img
              src="https://cdn.locket-dio.com/v1/caption/caption-icon/celebrity_badge.png"
              alt="Celebrity"
              className="absolute bottom-0 right-0 w-6 h-6 p-0.5 bg-base-100 rounded-full"
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold truncate">
              {friend?.first_name} {friend?.last_name}
            </h2>
            <p className="text-sm text-base-content/60 truncate">
              @{friend.username || t("friends.no_username")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end flex-shrink-0">
          <FriendActionButton
            friend={friend}
            isFullSlot={isSlotFull}
            onAdd={handleAddFriend}
            loading={loading}
            disabled={disabled}
          />

          {canShowWatch && (
            <button
              type="button"
              onClick={handleWatchToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                watch?.status === SLOT_STATUS.SLOT_OPEN
                  ? "bg-error/15 text-error"
                  : watch
                    ? "bg-base-200 text-base-content hover:bg-base-300"
                    : "bg-primary/15 text-primary hover:bg-primary/25"
              }`}
              aria-pressed={Boolean(watch)}
            >
              {watch?.status === SLOT_STATUS.SLOT_OPEN ? (
                <Flame className="w-3.5 h-3.5" />
              ) : watch ? (
                <BellOff className="w-3.5 h-3.5" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              {watch?.status === SLOT_STATUS.SLOT_OPEN
                ? "Slot đã mở"
                : watch
                  ? "Hủy Canh"
                  : "Canh Slot"}
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {(isSlotFull || watch) && maxFriends > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-base-content/60">
            <span>
              {t("friends.celeb.friends_count_progress", {
                count: friendCount.toLocaleString(),
                max: maxFriends.toLocaleString(),
              })}
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>

          <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FriendActionButton({
  friend,
  isFullSlot = false,
  onAdd,
  loading = false,
  disabled = false,
}) {
  const { t } = useTranslation("features");
  const status = friend?.friendship_status;

  const baseClass =
    "flex items-center gap-1 px-4 py-2 rounded-full font-semibold transition-all";

  if (status === "friends") {
    return (
      <div className={`${baseClass} bg-primary text-primary-content`}>
        <UserRoundCheck className="w-5 h-5" />
        {t("friends.action.friends")}
      </div>
    );
  }

  if (status === "follower-waitlist") {
    return (
      <button
        disabled={isFullSlot || disabled || loading}
        onClick={(e) => {
          e.stopPropagation();
          if (isFullSlot || disabled || loading) return;
          onAdd?.(friend.uid);
        }}
        className={`${baseClass} ${
          isFullSlot
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-yellow-500 text-black hover:bg-yellow-400"
        }`}
      >
        {isFullSlot
          ? t("friends.celeb.in_queue")
          : t("friends.celeb.resend_request")}
      </button>
    );
  }

  if (status === "outgoing-follow-request") {
    return (
      <div className={`${baseClass} bg-base-200 text-base-content`}>
        {t("friends.celeb.waiting_accept")}
      </div>
    );
  }

  return (
    <button
      disabled={isFullSlot || disabled || loading}
      onClick={(e) => {
        e.stopPropagation();
        if (isFullSlot || disabled || loading) return;
        onAdd?.(friend.uid);
      }}
      className={`${baseClass} ${
        isFullSlot || disabled || loading
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-yellow-500 text-black hover:bg-yellow-400"
      }`}
    >
      {loading ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <Plus className="w-5 h-5" />
      )}
      {loading
        ? t("friends.find.sending_request", "Đang gửi...")
        : t("friends.celeb.follow")}
    </button>
  );
}
