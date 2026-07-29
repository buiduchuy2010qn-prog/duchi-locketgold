import { CONFIG } from "@/config";
import React from "react";
// import CameraCaptureBeta from "../pages/LocketCameraBeta";
import CameraCaptureBeta from "../pages/LocketCameraBeta";

// const CameraCapture = React.lazy(() => import("../pages/LocketCamera"));
// Camera is critical, eagerly load it to avoid loading spinner on mount

const APP_NAME = CONFIG.app.fullName;

export const locketRoutes = [
  { path: "/locket", component: CameraCaptureBeta, title: `Locket Camera | ${APP_NAME}` },
  // { path: "/locket/history", component: HistorysPage, title: `Lịch sử | ${APP_NAME}` },
  // { path: "/locket/settings", component: SettingsPage, title: `Cài đặt Locket | ${APP_NAME}` },
];
