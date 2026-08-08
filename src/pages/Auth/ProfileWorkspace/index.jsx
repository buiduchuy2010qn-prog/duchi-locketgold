import React, { lazy, Suspense, useState } from "react";
import { Activity, UserRound } from "lucide-react";
import Profile from "../Profile";

const ActivityDashboard = lazy(
  () => import("@/features/ActivityDashboard/ActivityDashboard"),
);

export default function ProfileWorkspace() {
  const [tab, setTab] = useState("profile");
  return (
    <div className="min-h-screen bg-base-200">
      <div className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 px-3 py-2 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl gap-1 rounded-2xl bg-base-200/60 p-1">
          <button
            type="button"
            className={`btn btn-sm flex-1 rounded-xl ${tab === "profile" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("profile")}
          >
            <UserRound className="h-4 w-4" /> Hồ sơ
          </button>
          <button
            type="button"
            className={`btn btn-sm flex-1 rounded-xl ${tab === "activity" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("activity")}
          >
            <Activity className="h-4 w-4" /> Thống kê cá nhân
          </button>
        </div>
      </div>
      {tab === "profile" ? (
        <Profile />
      ) : (
        <Suspense
          fallback={
            <div className="flex min-h-48 items-center justify-center">
              <span className="loading loading-spinner loading-md" aria-label="Đang tải" />
            </div>
          }
        >
          <ActivityDashboard />
        </Suspense>
      )}
    </div>
  );
}
