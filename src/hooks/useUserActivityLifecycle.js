import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  startUserActivityLifecycle,
  stopUserActivityLifecycle,
  logWebUserAction,
} from "@/services/UserActivityService";

const PATH_NAME_MAP = {
  "/": "Truy cập Màn hình chính (Camera & Bảng tin Locket)",
  "/camera": "Truy cập Màn hình Camera Locket",
  "/login": "Truy cập Trang Đăng Nhập",
  "/settings": "Mở Trang Cài Đặt Hệ Thống & Tài Khoản",
  "/admin-users": "Truy cập Bảng Điều Khiển Quản Trị Viên (Admin)",
  "/admin-google-drive": "Truy cập Bảng Quản lý Google Drive Backup",
  "/pricing": "Xem Trang Gói Thành Viên & Ủng Hộ",
  "/about": "Xem Trang Giới Thiệu Huy Locket",
  "/timeline": "Xem Dòng Thời Gian Kỷ Niệm (Timeline)",
  "/white-page": "Truy cập Màn Hình Ghi Sáng (White Page)",
};

export function useUserActivityLifecycle(isAuthenticated) {
  const location = useLocation();
  const lastPathRef = useRef("");

  useEffect(() => {
    if (!isAuthenticated) {
      stopUserActivityLifecycle();
      return undefined;
    }
    return startUserActivityLifecycle();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !location.pathname) return;
    if (lastPathRef.current === location.pathname) return;
    lastPathRef.current = location.pathname;

    const actionTitle = PATH_NAME_MAP[location.pathname] || `Truy cập trang: ${location.pathname}`;
    logWebUserAction({
      actionType: "NAVIGATION",
      actionTitle,
      details: `Đường dẫn truy cập: ${location.pathname}`,
    });
  }, [isAuthenticated, location.pathname]);
}
