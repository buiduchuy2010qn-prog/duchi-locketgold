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
      </div>
    </>
  );
}

export default StreakLocket;
