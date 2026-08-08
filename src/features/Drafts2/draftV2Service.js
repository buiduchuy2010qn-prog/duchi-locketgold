import momentDraftDB from "@/cache/momentDraftDB";
import { updateDraftMeta } from "@/utils/momentDraft";

const MAX_VERSION_SNAPSHOTS = 12;

function cleanOptions(optionsData = {}) {
  const { _versionHistory, ...rest } = optionsData || {};
  return rest;
}

export function draftFolder(draft) {
  return String(draft?.optionsData?.draftFolder || "Chung").trim() || "Chung";
}

export function draftTags(draft) {
  return Array.isArray(draft?.optionsData?.draftTags)
    ? draft.optionsData.draftTags.filter(Boolean).map(String)
    : [];
}

export function isDraftTrashed(draft) {
  return Boolean(draft?.optionsData?.trashAt);
}

export function versionHistory(draft) {
  return Array.isArray(draft?.optionsData?._versionHistory)
    ? draft.optionsData._versionHistory
    : [];
}

function snapshotOf(draft, label = "") {
  if (!draft) return null;
  return {
    id: `${draft.id}:${draft.revision || 1}:${Date.now()}`,
    revision: Number(draft.revision || 1),
    savedAt: Date.now(),
    label: String(label || "").slice(0, 80),
    caption: draft.caption || "",
    captionStyle: draft.captionStyle || null,
    music: draft.music || null,
    overlays: draft.overlays || null,
    audience: draft.audience || "all",
    selectedFriendIds: Array.isArray(draft.selectedFriendIds)
      ? draft.selectedFriendIds
      : [],
    optionsData: cleanOptions(draft.optionsData),
    status: draft.status || "ready",
  };
}

export async function saveDraftVersion(draft, label = "") {
  const snapshot = snapshotOf(draft, label);
  if (!snapshot) return { error: "missing" };
  const history = [snapshot, ...versionHistory(draft)].slice(
    0,
    MAX_VERSION_SNAPSHOTS,
  );
  return updateDraftMeta(draft.id, {
    optionsData: {
      ...(draft.optionsData || {}),
      _versionHistory: history,
    },
  });
}

export async function restoreDraftVersion(draft, snapshot) {
  if (!draft?.id || !snapshot) return { error: "missing" };
  const currentSnapshot = snapshotOf(draft, "Trước khi khôi phục");
  const history = [currentSnapshot, ...versionHistory(draft)]
    .filter(Boolean)
    .slice(0, MAX_VERSION_SNAPSHOTS);

  return updateDraftMeta(draft.id, {
    caption: snapshot.caption || "",
    captionStyle: snapshot.captionStyle || null,
    music: snapshot.music || null,
    overlays: snapshot.overlays || null,
    audience: snapshot.audience || "all",
    selectedFriendIds: Array.isArray(snapshot.selectedFriendIds)
      ? snapshot.selectedFriendIds
      : [],
    status: snapshot.status || "ready",
    optionsData: {
      ...(snapshot.optionsData || {}),
      _versionHistory: history,
      trashAt: null,
    },
  });
}

export async function updateDraftOrganization(draft, { folder, tags }) {
  if (!draft?.id) return { error: "missing" };
  const currentFolder = draftFolder(draft);
  const currentTags = draftTags(draft);
  const normalizedFolder = String(folder || "Chung").trim() || "Chung";
  const normalizedTags = Array.from(
    new Set(
      (Array.isArray(tags) ? tags : String(tags || "").split(","))
        .map((tag) => String(tag).trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);

  if (
    currentFolder !== normalizedFolder ||
    JSON.stringify(currentTags) !== JSON.stringify(normalizedTags)
  ) {
    await saveDraftVersion(draft, "Trước khi đổi thư mục/tag");
  }

  return updateDraftMeta(draft.id, {
    optionsData: {
      ...(draft.optionsData || {}),
      draftFolder: normalizedFolder,
      draftTags: normalizedTags,
    },
  });
}

export async function moveDraftToTrash(draft) {
  if (!draft?.id) return { error: "missing" };
  await saveDraftVersion(draft, "Trước khi chuyển vào thùng rác");
  return updateDraftMeta(draft.id, {
    optionsData: {
      ...(draft.optionsData || {}),
      trashAt: Date.now(),
    },
  });
}

export async function restoreDraftFromTrash(draft) {
  if (!draft?.id) return { error: "missing" };
  return updateDraftMeta(draft.id, {
    optionsData: {
      ...(draft.optionsData || {}),
      trashAt: null,
    },
  });
}

export async function listAllDraftRows(ownerUid) {
  if (!ownerUid) return [];
  try {
    const rows = await momentDraftDB.drafts
      .where("ownerUid")
      .equals(String(ownerUid))
      .toArray();
    return rows.sort(
      (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
    );
  } catch {
    return [];
  }
}
