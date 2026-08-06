import { CalendarHeart, LayoutGrid, Share } from "lucide-react";
import { useMomentActivityStore, useSelectedStore } from "@/stores";
import MomentInteraction from "./MomentInteraction";
import { useTranslation } from "react-i18next";

const circleButtonClass =
  "btn btn-circle btn-lg transform-gpu touch-manipulation backdrop-blur-xs bg-base-100/30 text-base-content cursor-pointer rounded-full transition-all duration-150 ease-out hover:scale-105 hover:bg-base-200/50 active:scale-90 active:opacity-80 active:shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none";

const BottomMenu = ({
  setIsBottomOpen,
  setOptionModalOpen,
  setIsProfileOpen,
}) => {
  const { t } = useTranslation("main");
  const selectedMoment = useSelectedStore((s) => s.selectedMoment);
  const selectedQueue = useSelectedStore((s) => s.selectedQueue);

  const setSelectedMoment = useSelectedStore((s) => s.setSelectedMoment);
  const setSelectedQueue = useSelectedStore((s) => s.setSelectedQueue);

  const setSelectedMomentId = useSelectedStore((s) => s.setSelectedMomentId);
  const setSelectedQueueId = useSelectedStore((s) => s.setSelectedQueueId);

  const clearActivity = useMomentActivityStore((s) => s.clearActive);

  const resetSelection = () => {
    setSelectedMoment(null);
    setSelectedQueue(null);
    setSelectedMomentId(null);
    setSelectedQueueId(null);
    clearActivity();
  };

  const handleReturnHome = () => {
    resetSelection();
    setIsBottomOpen(false);
  };

  const handleClose = () => {
    resetSelection();
  };

  /** Mở lịch streak / Locket calendar (màn profile trái) */
  const handleOpenCalendar = () => {
    resetSelection();
    setIsBottomOpen?.(false);
    setIsProfileOpen?.(true);
  };

  return (
    <>
      <div className="fixed z-70 w-full bottom-0 px-5 pb-10 md:pb-5 text-base-content space-y-3">
        {typeof selectedMoment === "number" && <MomentInteraction />}

        <div className="grid grid-cols-3 items-center">
          <div className="flex justify-start select-none">
            {(selectedMoment !== null || selectedQueue !== null) && (
              <button
                type="button"
                aria-label={t("bottom.back_to_grid", {
                  defaultValue: "Quay lại lưới bài đăng",
                })}
                className={`${circleButtonClass} p-2`}
                onClick={handleClose}
              >
                <LayoutGrid size={28} />
              </button>
            )}
          </div>

          <div className="flex justify-center select-none">
            <button
              type="button"
              aria-label={t("bottom.return_home", {
                defaultValue: "Trở về camera",
              })}
              onClick={handleReturnHome}
              className="group relative flex h-11 w-11 transform-gpu touch-manipulation items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-105 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <div className="absolute z-5 h-11 w-11 rounded-full bg-base-100/10 text-primary ring-4 backdrop-blur-xs transition-all duration-150 group-active:scale-110 group-active:opacity-70 motion-reduce:transition-none" />
              <div className="absolute z-10 h-10 w-10 rounded-full border border-base-300 bg-base-100 shadow-sm transition-transform duration-150 group-active:scale-75 motion-reduce:transform-none motion-reduce:transition-none" />
            </button>
          </div>

          <div className="flex justify-end">
            {(selectedMoment !== null || selectedQueue !== null) && (
              <button
                type="button"
                aria-label={t("bottom.share_moment", {
                  defaultValue: "Chia sẻ bài đăng",
                })}
                onClick={() => setOptionModalOpen(true)}
                className={`${circleButtonClass} p-2`}
              >
                <Share size={28} />
              </button>
            )}
            {/* CALENDAR – mở lịch chuỗi / streak Lockets */}
            {selectedMoment === null && selectedQueue === null && (
              <button
                type="button"
                onClick={handleOpenCalendar}
                aria-label={t("bottom.open_calendar", {
                  defaultValue: "Mở lịch chuỗi",
                })}
                title={t("bottom.open_calendar", {
                  defaultValue: "Lịch chuỗi Locket",
                })}
                className={circleButtonClass}
              >
                <CalendarHeart size={28} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BottomMenu;
