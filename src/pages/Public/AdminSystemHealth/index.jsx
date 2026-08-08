import React, { useState } from "react";
import AccountHealth from "@/features/SlotMonitor/AccountHealth";
import AdminCelebCenter from "@/features/SlotMonitor/AdminCelebCenter";
import SystemStatus from "@/features/SlotMonitor/SystemStatus";
import LegacyAdminSystemHealth from "./Legacy";

export default function AdminSystemHealth({
  showCelebCenter = true,
  showAccountHealth = true,
  showSystemStatus = true,
}) {
  const [activeTab, setActiveTab] = useState("celeb");

  return (
    <div className="w-full">
      <div role="tablist" className="tabs tabs-boxed flex-wrap gap-1 bg-base-200/50 p-1 mb-4">
        {showCelebCenter && (
          <a
            role="tab"
            className={`tab font-medium ${activeTab === "celeb" ? "tab-active !bg-primary !text-white" : ""}`}
            onClick={() => setActiveTab("celeb")}
          >
            Celeb Center
          </a>
        )}
        {showAccountHealth && (
          <a
            role="tab"
            className={`tab font-medium ${activeTab === "account" ? "tab-active !bg-primary !text-white" : ""}`}
            onClick={() => setActiveTab("account")}
          >
            Account Health
          </a>
        )}
        {showSystemStatus && (
          <a
            role="tab"
            className={`tab font-medium ${activeTab === "system" ? "tab-active !bg-primary !text-white" : ""}`}
            onClick={() => setActiveTab("system")}
          >
            System Status
          </a>
        )}
        <a
          role="tab"
          className={`tab font-medium ${activeTab === "legacy" ? "tab-active !bg-primary !text-white" : ""}`}
          onClick={() => setActiveTab("legacy")}
        >
          Legacy Health
        </a>
      </div>

      <div className="w-full">
        {activeTab === "celeb" && showCelebCenter && <AdminCelebCenter />}
        {activeTab === "account" && showAccountHealth && <AccountHealth />}
        {activeTab === "system" && showSystemStatus && <SystemStatus />}
        {activeTab === "legacy" && <LegacyAdminSystemHealth />}
      </div>
    </div>
  );
}
