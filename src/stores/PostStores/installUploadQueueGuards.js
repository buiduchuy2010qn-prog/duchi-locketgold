import { SonnerWarning } from "@/components/uikit/SonnerToast";
import {
  deleteUploadItemFromDB,
  getPostedMoments,
  loadAllUploadItems,
  updateUploadItemInDB,
} from "@/cache/uploadMomentDB";
import {
  STATUS_UPLOAD_MOMENT,
  useUploadQueueStore,
} from "./useUploadPostStore";

const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
let installed = false;

function isRateLimitedItem(item) {
  const text = String(item?.errorMessage || "").toLowerCase();
  return (
    item?.errorCode === "RATE_LIMITED" ||
    text.includes("429") ||
    text.includes("quá nhiều yêu cầu") ||
    text.includes("thao tác quá nhanh")
  );
}

function formatRemaining(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.ceil(seconds / 60)} phút`;
}

/**
 * Existing queue code was designed to resume automatically. That is unsafe for
 * persisted failed uploads: opening the website could silently post again.
 * Install narrow runtime guards without changing the normal current-session
 * enqueue/upload flow.
 */
export function installUploadQueueGuards() {
  if (installed) return;
  installed = true;

  const originalRetryUploadItem =
    useUploadQueueStore.getState().retryUploadItem;

  useUploadQueueStore.setState({
    hydrateUploadQueue: async () => {
      const [storedItems, postedMoments] = await Promise.all([
        loadAllUploadItems(),
        getPostedMoments(),
      ]);

      const safeItems = [];

      for (const stored of storedItems) {
        if (!stored?.id) continue;

        if (stored.status === STATUS_UPLOAD_MOMENT.DONE) {
          await deleteUploadItemFromDB(stored.id);
          continue;
        }

        if (
          stored.status === STATUS_UPLOAD_MOMENT.QUEUED ||
          stored.status === STATUS_UPLOAD_MOMENT.UPLOADING
        ) {
          const patch = {
            status: STATUS_UPLOAD_MOMENT.FAILED,
            errorCode: "PAUSED_AFTER_RELOAD",
            errorMessage:
              "Bài đăng đã được tạm dừng sau khi tải lại trang. Mở Bản nháp để đăng lại.",
          };
          await updateUploadItemInDB(stored.id, patch);
          safeItems.push({ ...stored, ...patch });
          continue;
        }

        safeItems.push(stored);
      }

      safeItems.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );

      useUploadQueueStore.setState({
        uploadItems: safeItems,
        postedMoments,
        isQueueRunning: false,
      });
    },

    retryUploadItem: async (itemId) => {
      const current = useUploadQueueStore
        .getState()
        .uploadItems.find((item) => item.id === itemId);

      if (isRateLimitedItem(current)) {
        const lastAttempt = Date.parse(
          current?.lastTried || current?.createdAt || "",
        );
        const elapsed = Number.isFinite(lastAttempt)
          ? Date.now() - lastAttempt
          : 0;
        const remaining = RATE_LIMIT_COOLDOWN_MS - elapsed;

        if (remaining > 0) {
          SonnerWarning(
            "Đang tạm dừng đăng bài",
            `Máy chủ đang giới hạn yêu cầu. Thử lại sau ${formatRemaining(remaining)}.`,
          );
          return false;
        }
      }

      return originalRetryUploadItem(itemId);
    },
  });
}
