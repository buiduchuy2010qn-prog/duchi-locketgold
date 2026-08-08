import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore,
  Copy,
  Folder,
  History,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useMomentDraftStore } from "@/stores";
import {
  getDraftThumbnailBlob,
  resolveDraftUid,
  syncStatusLabel,
} from "@/utils/momentDraft";
import {
  draftFolder,
  draftTags,
  isDraftTrashed,
  listAllDraftRows,
  moveDraftToTrash,
  restoreDraftFromTrash,
  restoreDraftVersion,
  saveDraftVersion,
  updateDraftOrganization,
  versionHistory,
} from "./draftV2Service";

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function DraftThumb({ draft }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    let url = "";
    getDraftThumbnailBlob(draft.id).then((blob) => {
      if (!active || !(blob instanceof Blob)) return;
      url = URL.createObjectURL(blob);
      setSrc(url);
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft.id, draft.updatedAt]);

  return (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-base-200">
      {src ? (
        <img src={src} alt="Draft" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-base-content/45">
          {draft.mediaType === "video" ? "VIDEO" : "ẢNH"}
        </div>
      )}
    </div>
  );
}

export default function Drafts2Panel({ onOpenEditor }) {
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [view, setView] = useState("active");
  const [editingId, setEditingId] = useState("");
  const [folderInput, setFolderInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [versionDraftId, setVersionDraftId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [syncing, setSyncing] = useState(false);

  const {
    saveCurrentAsDraft,
    syncDraftsNow,
    restoreDraftIntoStudio,
    postDraftById,
    duplicateDraft,
    confirmDeleteDraft,
    postingDraftId,
    refreshList,
  } = useMomentDraftStore();

  const refreshRows = useCallback(async () => {
    const uid = resolveDraftUid();
    if (!uid) {
      setRows([]);
      setLoadingRows(false);
      return;
    }
    await refreshList(uid);
    setRows(await listAllDraftRows(uid));
    setLoadingRows(false);
  }, [refreshList]);

  useEffect(() => {
    refreshRows();
  }, [refreshRows]);

  const folders = useMemo(() => {
    const names = new Set(
      rows.filter((row) => !isDraftTrashed(row)).map((row) => draftFolder(row)),
    );
    return [...names].sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((draft) => {
      const trashed = isDraftTrashed(draft);
      if (view === "trash" ? !trashed : trashed) return false;
      if (folderFilter !== "all" && draftFolder(draft) !== folderFilter) return false;
      if (!text) return true;
      return [
        draft.caption,
        draft.fileName,
        draftFolder(draft),
        ...draftTags(draft),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [folderFilter, query, rows, view]);

  const activeCount = rows.filter((row) => !isDraftTrashed(row)).length;
  const trashCount = rows.length - activeCount;

  const run = async (draft, action) => {
    if (busyId) return;
    setBusyId(draft?.id || "global");
    try {
      await action();
      await refreshRows();
    } finally {
      setBusyId("");
    }
  };

  const handleOpen = (draft) =>
    run(draft, async () => {
      const ok = await restoreDraftIntoStudio(draft.id);
      if (ok) onOpenEditor?.();
    });

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncDraftsNow(false);
      await refreshRows();
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveCurrent = async () => {
    setBusyId("save-current");
    try {
      await saveCurrentAsDraft({ asNew: true, clearAfter: false });
      await refreshRows();
    } finally {
      setBusyId("");
    }
  };

  const saveOrganization = (draft) =>
    run(draft, async () => {
      await updateDraftOrganization(draft, {
        folder: folderInput,
        tags: tagsInput,
      });
      setEditingId("");
      toast.success("Đã lưu thư mục và tag");
    });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 text-base-content">
      <div className="rounded-3xl border border-base-300 bg-base-100 shadow-lg">
        <div className="border-b border-base-300 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Bản nháp 2.0</h2>
              <p className="mt-1 text-sm text-base-content/60">
                Đồng bộ tài khoản, autosave, thư mục/tag, lịch sử phiên bản và thùng rác khôi phục.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={syncing}
                onClick={handleSync}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Đồng bộ
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busyId === "save-current"}
                onClick={handleSaveCurrent}
              >
                <Plus className="h-4 w-4" /> Lưu bản đang sửa
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-sm ${view === "active" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setView("active")}
            >
              <Folder className="h-4 w-4" /> Bản nháp ({activeCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${view === "trash" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setView("trash")}
            >
              <Trash2 className="h-4 w-4" /> Thùng rác ({trashCount})
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_220px]">
            <label className="input input-bordered flex items-center gap-2">
              <Search className="h-4 w-4 text-base-content/45" />
              <input
                className="grow"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm caption, file, thư mục hoặc tag..."
              />
            </label>
            <select
              className="select select-bordered"
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
            >
              <option value="all">Tất cả thư mục</option>
              {folders.map((folder) => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loadingRows ? (
            <div className="flex justify-center py-14"><span className="loading loading-spinner loading-md" /></div>
          ) : visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-base-300 px-4 py-14 text-center text-sm text-base-content/50">
              {view === "trash" ? "Thùng rác đang trống." : "Chưa có bản nháp phù hợp."}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleRows.map((draft) => {
                const history = versionHistory(draft);
                const editing = editingId === draft.id;
                const showVersions = versionDraftId === draft.id;
                const busy = busyId === draft.id || postingDraftId === draft.id;
                return (
                  <article key={draft.id} className="rounded-2xl border border-base-300 bg-base-200/25 p-3 sm:p-4">
                    <div className="flex gap-3">
                      <DraftThumb draft={draft} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge badge-sm badge-outline">{draft.mediaType === "video" ? "VIDEO" : "ẢNH"}</span>
                          <span className="badge badge-sm badge-ghost">r{draft.revision || 1}</span>
                          <span className="text-[11px] text-base-content/50">{syncStatusLabel(draft.syncStatus)}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-semibold">
                          {draft.caption || draft.fileName || "Bản nháp chưa có caption"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-base-content/55">
                          <span className="badge badge-xs badge-ghost">📁 {draftFolder(draft)}</span>
                          {draftTags(draft).map((tag) => (
                            <span key={tag} className="badge badge-xs badge-outline">#{tag}</span>
                          ))}
                        </div>
                        <p className="mt-2 text-[11px] text-base-content/45">
                          Sửa {formatTime(draft.updatedAt)} · {history.length} phiên bản đã lưu
                        </p>
                      </div>
                    </div>

                    {editing && (
                      <div className="mt-3 grid gap-2 rounded-xl border border-base-300 bg-base-100/70 p-3 sm:grid-cols-2">
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs"><Folder className="mr-1 inline h-3 w-3" />Thư mục</span>
                          <input className="input input-sm input-bordered" value={folderInput} onChange={(e) => setFolderInput(e.target.value)} placeholder="Chung" />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs"><Tags className="mr-1 inline h-3 w-3" />Tag, cách nhau bởi dấu phẩy</span>
                          <input className="input input-sm input-bordered" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="du-lich, ban-be" />
                        </label>
                        <div className="sm:col-span-2 flex justify-end gap-2">
                          <button className="btn btn-xs btn-ghost" onClick={() => setEditingId("")}>Hủy</button>
                          <button className="btn btn-xs btn-primary" disabled={busy} onClick={() => saveOrganization(draft)}>Lưu</button>
                        </div>
                      </div>
                    )}

                    {showVersions && (
                      <div className="mt-3 rounded-xl border border-base-300 bg-base-100/70 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold">Lịch sử phiên bản</span>
                          <button
                            className="btn btn-xs btn-outline"
                            disabled={busy}
                            onClick={() => run(draft, async () => {
                              await saveDraftVersion(draft, "Lưu thủ công");
                              toast.success("Đã chụp phiên bản hiện tại");
                            })}
                          >
                            Lưu phiên bản
                          </button>
                        </div>
                        {history.length === 0 ? (
                          <p className="text-xs text-base-content/50">Chưa có snapshot. Autosave vẫn đang hoạt động; bấm “Lưu phiên bản” để tạo mốc có thể quay lại.</p>
                        ) : (
                          <div className="max-h-44 space-y-2 overflow-y-auto">
                            {history.map((version) => (
                              <div key={version.id} className="flex items-center justify-between gap-2 rounded-lg bg-base-200/50 px-2 py-2 text-xs">
                                <div className="min-w-0">
                                  <div className="font-semibold">r{version.revision} · {version.label || "Phiên bản"}</div>
                                  <div className="text-base-content/45">{formatTime(version.savedAt)}</div>
                                </div>
                                <button
                                  className="btn btn-xs btn-ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    if (!window.confirm(`Khôi phục metadata về phiên bản r${version.revision}? Media hiện tại sẽ được giữ nguyên.`)) return;
                                    run(draft, async () => {
                                      await restoreDraftVersion(draft, version);
                                      toast.success("Đã khôi phục phiên bản");
                                    });
                                  }}
                                >
                                  Khôi phục
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {view === "active" ? (
                        <>
                          <button className="btn btn-xs btn-primary" disabled={busy} onClick={() => handleOpen(draft)}><Pencil size={12} /> Mở sửa</button>
                          <button className="btn btn-xs btn-outline" disabled={busy} onClick={() => run(draft, () => postDraftById(draft.id))}><Send size={12} /> Đăng</button>
                          <button
                            className="btn btn-xs btn-ghost"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(draft.id);
                              setFolderInput(draftFolder(draft));
                              setTagsInput(draftTags(draft).join(", "));
                            }}
                          >
                            <Folder size={12} /> Phân loại
                          </button>
                          <button className="btn btn-xs btn-ghost" onClick={() => setVersionDraftId(showVersions ? "" : draft.id)}><History size={12} /> Phiên bản</button>
                          <button className="btn btn-xs btn-ghost" disabled={busy} onClick={() => run(draft, () => duplicateDraft(draft.id))}><Copy size={12} /> Nhân bản</button>
                          <button className="btn btn-xs btn-ghost text-error" disabled={busy} onClick={() => run(draft, () => moveDraftToTrash(draft))}><Trash2 size={12} /> Thùng rác</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-xs btn-primary" disabled={busy} onClick={() => run(draft, () => restoreDraftFromTrash(draft))}><ArchiveRestore size={12} /> Khôi phục</button>
                          <button
                            className="btn btn-xs btn-ghost text-error"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm("Xóa vĩnh viễn bản nháp và media này?")) return;
                              run(draft, () => confirmDeleteDraft(draft.id));
                            }}
                          >
                            <Trash2 size={12} /> Xóa vĩnh viễn
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
