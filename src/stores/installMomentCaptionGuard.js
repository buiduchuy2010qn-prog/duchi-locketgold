import { bulkAddMoments } from "@/cache/momentDB";
import {
  createMomentCaptionSnapshot,
  getMomentCaptionIdentityKeys,
  getMomentCaptionText,
  restoreMomentCaption,
} from "@/utils/moment/preserveMomentCaption";
import { useMomentsStoreV2 } from "./MomentStores";
import { useUploadQueueStore } from "./PostStores/useUploadPostStore";

let installed = false;
let applyingRepair = false;
const captionSnapshots = new Map();

function rememberMoment(moment) {
  const snapshot = createMomentCaptionSnapshot(moment);
  if (!snapshot) return;

  for (const key of getMomentCaptionIdentityKeys(moment)) {
    captionSnapshots.set(key, snapshot);
  }
}

function rememberBuckets(momentsByUser) {
  if (!momentsByUser || typeof momentsByUser !== "object") return;
  for (const bucket of Object.values(momentsByUser)) {
    for (const moment of bucket?.moments || []) rememberMoment(moment);
  }
}

function findSnapshot(moment) {
  for (const key of getMomentCaptionIdentityKeys(moment)) {
    const snapshot = captionSnapshots.get(key);
    if (snapshot) return snapshot;
  }
  return null;
}

function repairBuckets(momentsByUser) {
  let changed = false;
  const repairedForCache = [];
  const next = { ...momentsByUser };

  for (const [key, bucket] of Object.entries(momentsByUser || {})) {
    let bucketChanged = false;
    const moments = (bucket?.moments || []).map((moment) => {
      if (!moment || getMomentCaptionText(moment)) {
        rememberMoment(moment);
        return moment;
      }

      const snapshot = findSnapshot(moment);
      if (!snapshot) return moment;

      const repaired = restoreMomentCaption(moment, snapshot);
      if (repaired === moment) return moment;

      bucketChanged = true;
      changed = true;
      repairedForCache.push(repaired);
      rememberMoment(repaired);
      return repaired;
    });

    if (bucketChanged) next[key] = { ...bucket, moments };
  }

  return { changed, momentsByUser: next, repairedForCache };
}

/**
 * Realtime/REST snapshots can briefly contain the correct post id and media but
 * an empty caption overlay. Zustand's old merge treated {} and [] as valid, so
 * that incomplete snapshot replaced the visible local caption after ~0.5 s.
 * Keep the last meaningful caption for the same id/media until the server sends
 * a complete caption.
 */
export function installMomentCaptionGuard() {
  if (installed) return;
  installed = true;

  rememberBuckets(useMomentsStoreV2.getState().momentsByUser);

  useUploadQueueStore.subscribe((state) => {
    for (const moment of state?.postedMoments || []) rememberMoment(moment);
  });

  useMomentsStoreV2.subscribe((state, previousState) => {
    if (applyingRepair) return;

    // Capture the valid optimistic caption before an incomplete sync replaces it.
    rememberBuckets(previousState?.momentsByUser);
    rememberBuckets(state?.momentsByUser);

    const repaired = repairBuckets(state?.momentsByUser || {});
    if (!repaired.changed) return;

    applyingRepair = true;
    useMomentsStoreV2.setState({ momentsByUser: repaired.momentsByUser });
    applyingRepair = false;

    if (repaired.repairedForCache.length) {
      bulkAddMoments(repaired.repairedForCache).catch((error) => {
        console.warn("caption guard cache repair failed:", error);
      });
    }
  });
}
