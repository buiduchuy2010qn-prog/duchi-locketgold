import React, { useState } from "react";
import { FileClock, Send, UploadCloud } from "lucide-react";
import PostMoments from "../PostMoments";
import Drafts2Panel from "@/features/Drafts2/Drafts2Panel";
import UploadQueuePanel from "@/features/Upload2/UploadQueuePanel";

const TABS = [
  { id: "compose", label: "Đăng mới", icon: Send },
  { id: "drafts", label: "Bản nháp", icon: FileClock },
  { id: "queue", label: "Hàng đợi upload", icon: UploadCloud },
];

export default function PostWorkspace() {
  const [tab, setTab] = useState("compose");

  return (
    <div className="min-h-screen bg-base-200">
      <div className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 px-3 py-2 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto rounded-2xl bg-base-200/60 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`btn btn-sm flex-1 whitespace-nowrap rounded-xl ${
                tab === id ? "btn-primary" : "btn-ghost"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "compose" && <PostMoments />}
      {tab === "drafts" && <Drafts2Panel onOpenEditor={() => setTab("compose")} />}
      {tab === "queue" && <UploadQueuePanel onOpenDrafts={() => setTab("drafts")} />}
    </div>
  );
}
