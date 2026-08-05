import React, { useState, useEffect } from "react";
import { useAppNavigation } from "@/context/AppContext";
import HeaderOne from "./Layout/HeaderOne";
import InfoUser from "./Layout/InfoUser";
import WatermarkMenuItem from "./Layout/WatermarkMenuItem";
import SegmentedToggle from "./Layout/SegmentedToggle";
import RollcallsPost from "./Views/RollcallsPage";
import StreakLocket from "./Views/CalenderStreak";
import { useAuthStore, useMomentsStoreV2 } from "@/stores";
import { getToken } from "@/utils/storage";
import { logWebUserAction } from "@/services/UserActivityService";

const LeftHomeScreen = ({ setIsProfileOpen }) => {
  const { user } = useAuthStore();
  const navigation = useAppNavigation();
  const { isProfileOpen } = navigation;
  const [posts, setPosts] = useState([]);

  const [active, setActive] = useState("lockets"); // 'rollcall' | 'lockets'

  // useEffect(() => {
  //   document.body.classList.toggle("overflow-hidden", isProfileOpen);
  //   return () => document.body.classList.remove("overflow-hidden");
  // }, [isProfileOpen]);

  const { localId } = getToken() || {};
  const myId = user?.uid || localId;
  const bucket = useMomentsStoreV2((s) => s.momentsByUser[myId]);
  const myMoments = bucket?.moments || [];
  const isLoadingHistory = bucket?.isLoadingMore || false;

  useEffect(() => {
    if (isProfileOpen && myId) {
      useMomentsStoreV2.getState().fetchMoments(null, myId);
      logWebUserAction({
        actionType: "MENU_OPEN",
        actionTitle: "Mở Menu tính năng & Quản lý cá nhân",
        details: "Mở ngăn menu bên trái màn hình (Hồ sơ, Lịch sử, Cài đặt)",
      });
    }
  }, [isProfileOpen, myId]);

  // handle toggle bằng true/false
  const handleToggle = (tab) => {
    setActive(tab);
  };

  return (
    <div
      className={`fixed top-0 left-0 w-full h-[100dvh] z-50 bg-base-100 text-base-content transition-transform duration-500 overflow-hidden ${
        isProfileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* ==== Header (absolute top) ==== */}
      <div className="absolute top-0 left-0 w-full bg-base-100 z-20 shadow-sm border-b border-base-300">
        <HeaderOne setIsProfileOpen={setIsProfileOpen} />
        <InfoUser user={user} />
        {/* Mục menu riêng: Watermark on/off */}
        <WatermarkMenuItem />
        {isLoadingHistory && (
          <p className="text-center text-xs text-base-content/50 pb-1">
            Đang tải dữ liệu...
          </p>
        )}
      </div>

      {/* ==== Nội dung chính (scrollable area strictly below header) ==== */}
      <div className="absolute top-[130px] bottom-0 left-0 w-full bg-base-200 overflow-y-auto pb-24">
        {active === "rollcall" && (
          <RollcallsPost
            active={active}
            posts={posts}
            setPosts={setPosts}
            isProfileOpen={isProfileOpen}
          />
        )}
        {active === "lockets" && <StreakLocket recentPosts={myMoments} />}
      </div>
      {/* ==== Bottom Segmented Toggle ==== */}
      <div className="absolute z-60 bottom-4 w-full select-none">
        <SegmentedToggle active={active} setActive={handleToggle} />
      </div>
    </div>
  );
};

export default LeftHomeScreen;
