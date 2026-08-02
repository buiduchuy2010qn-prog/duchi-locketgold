/**
 * Shared Google Drive backup — 1 Drive cho cả web.
 * Chỉ admin (gmail) thấy UI liên kết trong Settings.
 */

const STATUS_CACHE_KEY = "gdrive_server_status";
const STATUS_CACHE_AT = "gdrive_server_status_at";

/** Gmail + Locket ID admin mặc định (có thể bổ sung qua env) */
const DEFAULT_ADMIN_EMAILS = ["buiduchuy2010qn@gmail.com"];
/** Locket ID thật (localId / user_uid) của admin */
const DEFAULT_ADMIN_LOCKET_IDS = ["y82fIv1QyDXLrMZ012MKYoYmAVz2"];

function normalizeEmail(v) {
  if (!v) return "";
  return String(v).trim().toLowerCase().replace(/\s+/g, "");
}

function parseList(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Danh sách email admin (env + mặc định) — KHÔNG lấy LOCAL_IDS / localStorage */
export function getAdminEmails() {
  const fromEnv = parseList(import.meta.env.VITE_ADMIN_EMAILS || "").map(
    normalizeEmail,
  );
  return Array.from(
    new Set([...DEFAULT_ADMIN_EMAILS.map(normalizeEmail), ...fromEnv]),
  );
}

/** Locket localId admin (env + mặc định) */
export function getAdminLocketIds() {
  return Array.from(
    new Set([
      ...DEFAULT_ADMIN_LOCKET_IDS,
      ...parseList(import.meta.env.VITE_ADMIN_LOCAL_IDS || ""),
    ]),
  );
}

/**
 * Chỉ admin (email hoặc Locket localId trong whitelist).
 * User thường → luôn false → không thấy menu Drive.
 *
 * @param {string|object|null} idOrUser - localId string HOẶC user object
 * @param {object|null} user - optional { email, localId, uid, ... }
 */
export function isAdminUser(idOrUser = null, user = null) {
  const u =
    user ||
    (idOrUser && typeof idOrUser === "object" ? idOrUser : null);

  const emails = getAdminEmails();
  const ids = getAdminLocketIds();

  // Chỉ lấy identity của session hiện tại — không đọc ADMIN_* từ localStorage
  const candidates = [];
  if (typeof idOrUser === "string" || typeof idOrUser === "number") {
    const s = String(idOrUser).trim();
    if (s) candidates.push(s);
  }
  if (u && typeof u === "object") {
    for (const k of [
      "email",
      "Email",
      "mail",
      "localId",
      "uid",
      "user_id",
      "user_uid",
      "userUid",
    ]) {
      if (u[k]) candidates.push(String(u[k]).trim());
    }
  }

  // Fallback storage CHỈ khi không có user object (session token)
  if (!u) {
    try {
      const em = localStorage.getItem("email") || sessionStorage.getItem("email");
      const lid =
        localStorage.getItem("localId") || sessionStorage.getItem("localId");
      if (em) candidates.push(em);
      if (lid) candidates.push(lid);
    } catch {
      /* ignore */
    }
  }

  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).trim();
    if (!s) continue;
    const em = normalizeEmail(s);

    // Email đầy đủ trong whitelist
    if (em.includes("@") && emails.includes(em)) return true;

    // Locket localId exact
    if (ids.includes(s)) return true;
  }
  return false;
}

/** Status từ server (cache 60s) */
export async function fetchDriveServerStatus(
  force = false,
  localId = null,
  email = null
) {
  try {
    if (!force) {
      const at = Number(localStorage.getItem(STATUS_CACHE_AT) || 0);
      const cached = localStorage.getItem(STATUS_CACHE_KEY);
      if (cached && Date.now() - at < 60_000) {
        return JSON.parse(cached);
      }
    }
    const headers = {};
    if (localId) headers["X-Local-Id"] = String(localId);
    if (email) headers["X-User-Email"] = normalizeEmail(email);

    const res = await fetch("/api/drive-status", { method: "GET", headers });
    const data = await res.json().catch(() => ({}));
    // isAdmin chỉ theo whitelist client — không tin server để hiện UI
    data.isAdmin = isAdminUser(localId, { email, localId });
    localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(STATUS_CACHE_AT, String(Date.now()));
    return data;
  } catch {
    return {
      configured: false,
      enabled: false,
      isAdmin: isAdminUser(localId, { email, localId }),
    };
  }
}

export function isDriveConfigured() {
  try {
    const cached = localStorage.getItem(STATUS_CACHE_KEY);
    if (cached) return Boolean(JSON.parse(cached)?.configured);
  } catch {
    /* ignore */
  }
  return false;
}

export function isDriveAutoBackupEnabled() {
  return isDriveConfigured();
}

export function setDriveAutoBackupEnabled() {
  /* no-op */
}

export function isDriveConnected() {
  return isDriveConfigured();
}

export function getDriveEmail() {
  try {
    const cached = localStorage.getItem(STATUS_CACHE_KEY);
    if (cached) return JSON.parse(cached)?.serviceEmail || "";
  } catch {
    /* ignore */
  }
  return "";
}

export function getGoogleClientId() {
  return "";
}

export function disconnectGoogleDrive() {
  localStorage.removeItem(STATUS_CACHE_KEY);
  localStorage.removeItem(STATUS_CACHE_AT);
}

export async function connectGoogleDrive() {
  const st = await fetchDriveServerStatus(true);
  if (!st?.configured) {
    throw new Error(
      "Admin chưa cấu hình Drive trên Render (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_FOLDER_ID)."
    );
  }
  return true;
}

export async function uploadFileToGoogleDrive(file, options = {}) {
  if (!file) throw new Error("Không có file");

  const { contentTypeFromMedia, extensionFromMedia, normalizeMediaFile } =
    await import("@/utils/mediaFileName");

  const isVideo =
    options.mediaType === "video" ||
    (file.type && String(file.type).startsWith("video/")) ||
    /\.(mp4|webm|mov|m4v|3gp|avi|mkv)$/i.test(file.name || "");

  const hint = isVideo ? "video" : options.mediaType || "image";
  const clean = normalizeMediaFile(file, hint);
  const ext = extensionFromMedia(clean, hint);
  const contentType = contentTypeFromMedia(clean, hint);

  let name =
    options.fileName ||
    clean.name ||
    `huylocket-${Date.now()}.${ext}`;

  // Tự động gắn Tên hiển thị & Email người đăng vào tên file ảnh/video để Admin dễ nhận biết ai đăng
  if (options.useUserProfileName !== false && (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || ext === "gif" || isVideo)) {
    try {
      let user = null;
      try {
        const { useAuthStore } = await import("@/stores");
        user = useAuthStore.getState()?.user;
      } catch (e) {}

      const displayName = user?.displayName || user?.username || "";
      const email = user?.email || localStorage.getItem("email") || sessionStorage.getItem("email") || "";
      let localId = user?.uid || "";
      if (!localId) {
        try {
          const { getToken } = await import("@/utils");
          localId = getToken()?.localId || "";
        } catch (e) {}
      }

      const removeAccents = (str = "") => String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

      let ident = displayName ? removeAccents(String(displayName).trim()) : "";
      if (email) {
        const emailPrefix = removeAccents(String(email).split("@")[0]);
        ident = ident ? `${ident}_(${emailPrefix})` : emailPrefix;
      }
      if (!ident && localId) {
        ident = `user_${String(localId).slice(0, 8)}`;
      }
      ident = ident ? ident.replace(/[^\w\s\-()]/g, "").replace(/\s+/g, "_") : "HuyLocket_Guest";

      const now = new Date();
      const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
      const timeStr = String(now.getHours()).padStart(2, "0") + "h" + String(now.getMinutes()).padStart(2, "0") + "m" + String(now.getSeconds()).padStart(2, "0") + "s";

      name = `[${ident}]_${dateStr}_${timeStr}.${ext}`;
    } catch (e) {
      /* giữ nguyên name gốc nếu lỗi */
    }
  }

  // Đảm bảo đuôi khớp MIME (Drive mới nhận video)
  if (!name.toLowerCase().endsWith(`.${ext}`)) {
    name = `${String(name).replace(/\.[^.]+$/, "")}.${ext}`;
  }

  const buf = await clean.arrayBuffer();
  // Video lớn: timeout dài hơn
  const controller = new AbortController();
  const timeoutMs = isVideo ? 180_000 : 90_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch("/api/drive-backup", {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-Filename": encodeURIComponent(name),
        "X-Upload-Size": String(buf.byteLength),
        "X-Media-Type": isVideo ? "video" : "image",
      },
      body: buf,
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(
        isVideo
          ? "Backup video quá lâu / file quá nặng. Thử video ngắn hơn."
          : "Backup Drive timeout"
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Drive backup failed (${res.status})`);
  }
  return data;
}

const recentUploads = new Map(); // key -> timestamp

export function backupToDriveInBackground(file, meta = {}) {
  if (!file) return;

  const fileKey = [file.name || "file", file.size || 0, file.lastModified || 0, meta.mediaType || ""].join("_");
  const lastTime = recentUploads.get(fileKey) || 0;
  // Bỏ qua nếu cùng một file vừa được đẩy lên Drive trong 5 phút trước đó (tránh lặp giữa hook & StorageServices)
  if (Date.now() - lastTime < 300_000) {
    console.log("[gdrive] ⚡ File đã được sao lưu / đang xử lý ngầm, bỏ qua đẩy trùng lặp:", fileKey);
    if (typeof meta.onSuccess === "function") meta.onSuccess({ deduplicated: true, name: file.name });
    return;
  }
  recentUploads.set(fileKey, Date.now());

  // Dọn dẹp bộ nhớ cache
  for (const [k, v] of recentUploads.entries()) {
    if (Date.now() - v > 600_000) recentUploads.delete(k);
  }

  (async () => {
    try {
      // Sử dụng cache status để tiến trình backup diễn ra tức thì không độ trễ mạng
      const st = await fetchDriveServerStatus(false);
      if (!st?.configured || st?.enabled === false) {
        recentUploads.delete(fileKey); // Xóa khỏi cache để lần sau thử lại
        if (typeof meta.onError === "function") {
          meta.onError(new Error("Drive chưa bật trên server"));
        }
        return;
      }

      const result = await uploadFileToGoogleDrive(file, {
        fileName: meta.fileName,
        mediaType: meta.mediaType,
      });
      console.log(
        "[gdrive] shared backup OK",
        result?.id,
        result?.name,
        "→",
        result?.folder
      );
      if (typeof meta.onSuccess === "function") meta.onSuccess(result);
    } catch (err) {
      recentUploads.delete(fileKey); // Lỗi thì cho phép retry lại
      console.warn("[gdrive] backup failed:", err?.message || err);
      if (typeof meta.onError === "function") meta.onError(err);
    }
  })();
}
