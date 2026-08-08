import React from "react";
import AdminCelebCenter from "@/features/SlotMonitor/AdminCelebCenter";
import LegacyAdminSystemHealth from "./Legacy";

export default function AdminSystemHealth({ showCelebCenter = true }) {
  return (
    <div className="space-y-2">
      {showCelebCenter && <AdminCelebCenter />}
      <LegacyAdminSystemHealth />
    </div>
  );
}
