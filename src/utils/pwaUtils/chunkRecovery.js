const RELOAD_KEY = "__app_reload_once__";
const DOM_RELOAD_KEY = "hl_dom_recover_v2";
const STABLE_LOAD_MS = 30 * 1000;
let resetTimer = null;
let resetScheduled = false;

// Chỉ mở lại quyền recovery sau khi trang đã chạy ổn định.
// Không xóa guard ngay lúc load vì lỗi chunk/DOM có thể tái diễn sau đó.
export function initReloadState() {
  if (resetScheduled) return;
  resetScheduled = true;

  const scheduleStableReset = () => {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      sessionStorage.removeItem(RELOAD_KEY);
      sessionStorage.removeItem(DOM_RELOAD_KEY);
      resetTimer = null;
    }, STABLE_LOAD_MS);
  };

  if (document.readyState === "complete") {
    scheduleStableReset();
  } else {
    window.addEventListener("load", scheduleStableReset, { once: true });
  }
}

// recovery UI
function showRecoveryButton() {
  if (document.getElementById("recovery-app-btn")) {
    return;
  }

  const btn = document.createElement("button");

  btn.id = "recovery-app-btn";

  btn.innerText = "⚠️ Ứng dụng lỗi - Bấm để sửa";

  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "999999",
    padding: "12px 18px",
    borderRadius: "12px",
    border: "none",
    background: "#ff3b30",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
  });

  btn.onclick = async () => {
    try {
      console.log("[RECOVERY] Clear SW + Cache");

      const regs =
        await navigator.serviceWorker.getRegistrations();

      for (const reg of regs) {
        await reg.unregister();
      }

      const cacheKeys = await caches.keys();

      for (const key of cacheKeys) {
        await caches.delete(key);
      }

      sessionStorage.removeItem(RELOAD_KEY);

      window.location.href = window.location.origin;
    } catch (err) {
      console.error(err);

      alert("Không thể recovery app");
    }
  };

  document.body.appendChild(btn);
}

function handleChunkError(msg = "") {
  const isChunkError =
    msg.includes("Loading chunk") ||
    msg.includes(
      "Failed to fetch dynamically imported module",
    );

  if (!isChunkError) {
    return;
  }

  const alreadyReloaded =
    sessionStorage.getItem(RELOAD_KEY);

  if (!alreadyReloaded) {
    console.log("[APP] Chunk failed -> reload once");

    sessionStorage.setItem(RELOAD_KEY, "1");

    window.location.reload();

    return;
  }

  console.log("[APP] Reload failed -> recovery mode");

  showRecoveryButton();
}

// init listeners
export function initChunkRecovery() {
  window.addEventListener("error", (event) => {
    handleChunkError(event?.message || "");
  });

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      handleChunkError(String(event?.reason || ""));
    },
  );
}
