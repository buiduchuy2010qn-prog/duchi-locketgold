import React from "react";
import AccountHealth from "@/features/SlotMonitor/AccountHealth";
import AdminCelebCenter from "@/features/SlotMonitor/AdminCelebCenter";
import SystemStatus from "@/features/SlotMonitor/SystemStatus";
import LegacyAdminSystemHealth from "./Legacy";

export default function AdminSystemHealth({
  showCelebCenter = true,
  showAccountHealth = true,
  showSystemStatus = true,
}) {
  return (
    <div className="space-y-2">
      {showCelebCenter && <AdminCelebCenter />}
      {showAccountHealth && <AccountHealth />}
      {showSystemStatus && <SystemStatus />}
      <LegacyAdminSystemHealth />
    </div>
  );
}
