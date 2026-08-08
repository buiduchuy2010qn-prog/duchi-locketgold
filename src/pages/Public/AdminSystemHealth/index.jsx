import React from "react";
import AdminCelebCenter from "@/features/SlotMonitor/AdminCelebCenter";
import LegacyAdminSystemHealth from "./Legacy";

export default function AdminSystemHealth() {
  return (
    <div className="space-y-2">
      <AdminCelebCenter />
      <LegacyAdminSystemHealth />
    </div>
  );
}
