import React, { useState } from "react";
import { Settings2, Smartphone } from "lucide-react";
import Settings from "../Settings";
import PwaAppPanel from "@/features/PWA/PwaAppPanel";

export default function SettingsWorkspace() {
  const [tab, setTab] = useState("general");

  return (
    <div className="min-h-screen bg-base-200">
      <div className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 px-3 py-2 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl gap-1 rounded-2xl bg-base-200/60 p-1">
          <button
            className={`btn btn-sm flex-1 rounded-xl ${tab === "general" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("general")}
          >
            <Settings2 className="h-4 w-4" /> Cài đặt chung
          </button>
          <button
            className={`btn btn-sm flex-1 rounded-xl ${tab === "pwa" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("pwa")}
          >
            <Smartphone className="h-4 w-4" /> Ứng dụng / PWA
          </button>
        </div>
      </div>
      {tab === "general" ? <Settings /> : <PwaAppPanel />}
    </div>
  );
}
