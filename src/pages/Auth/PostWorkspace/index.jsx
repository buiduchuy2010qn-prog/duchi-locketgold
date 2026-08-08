import React, { lazy, Suspense, useState } from "react";
import { FileClock, Send, UploadCloud } from "lucide-react";
import PostMoments from "../PostMoments";

const Drafts2Panel = lazy(() => import("@/features/Drafts2/Drafts2Panel"));
const UploadQueuePanel = lazy(
  () => import("@/features/Upload2/UploadQueuePanel"),
);

function WorkspaceFallback() {
  return (
    <div className="flex min-h-48 items-center justify-center">
      <span className="loading loading-spinner loading-md" aria-label="Đang tải" />
    </div>
  );
}

const TABS = [
  { id: "compose", label: "Đăng Moment", icon: Send },
  { id: "drafts", label: "Bản nháp", icon: FileClock },
  { id: "queue", label: "Upload & hàng đợi", icon: UploadCloud },
];

export default function PostWorkspace() {
  const [tab, setTab] = useState("compose");

  return (
    <div className="min-h-screen bg-base-200">
      <div className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 px-3 py-2 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto rounded-2xl bg-base-200/60 p-1">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`btn btn-sm flex-1 whitespace-nowrap rounded-xl ${
                tab === id ? "btn-primary" : "btn-ghost"
              }`}
            >
              {React.createElement(icon, { className: "h-4 w-4" })} {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "compose" && <PostMoments />}
      <Suspense fallback={<WorkspaceFallback />}>
        {tab === "drafts" && (
          <Drafts2Panel onOpenEditor={() => setTab("compose")} />
        )}
        {tab === "queue" && (
          <UploadQueuePanel onOpenDrafts={() => setTab("drafts")} />
        )}
      </Suspense>
    </div>
  );
}
