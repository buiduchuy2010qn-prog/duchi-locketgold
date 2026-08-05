import React, { lazy, useEffect } from "react";
import { useTranslation } from "react-i18next";
const StreaksCalender = lazy(() => import("./StreaksCalender"));
import BottomStreak from "./BottomStreak";
import { logWebUserAction } from "@/services/UserActivityService";

function StreakLocket({ recentPosts }) {
  const { t } = useTranslation("main");

  useEffect(() => {
    logWebUserAction({
      actionType: "STREAKS_VIEW",
      actionTitle: "Truy cập mục Lịch Sử & Kỷ Niệm (Streaks)",
      details: `Đang xem lịch sử với ${recentPosts?.length || 0} bài đăng kỷ niệm`,
    });
  }, []);

  return (
    <>
      <div className="p-4 w-full flex flex-col gap-4">
        <p>{t("left.calendar_note_1")}</p>

        <p>{t("left.calendar_note_2")}</p>

        <p className="mb-6">{t("left.calendar_note_3")}</p>

        <StreaksCalender recentPosts={recentPosts} />
        <BottomStreak recentPosts={recentPosts} />
        
        {/* Placeholder for empty space so it doesn't feel like a bug */}
        <div className="flex flex-col items-center justify-center opacity-50 mt-4 pb-10">
          <p className="text-sm font-medium">Bạn chưa có Locket nào dưới đây.</p>
          <p className="text-xs mt-1">Hãy chụp thêm để lưu giữ kỷ niệm nhé!</p>
        </div>
      </div>
    </>
  );
}

export default StreakLocket;
