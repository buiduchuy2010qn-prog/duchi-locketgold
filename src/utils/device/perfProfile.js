/**
 * Profile hiệu năng thiết bị — tối ưu Android / máy yếu.
 * Dùng cho camera, tuyết, blur, poll.
 */

let cached = null;

function detect() {
  if (typeof navigator === "undefined") {
    return {
      isAndroid: false,
      isIOS: false,
      isMobile: false,
      isLowEnd: false,
      cores: 4,
      memGB: 4,
    };
  }

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile =
    isAndroid ||
    isIOS ||
    /Mobile|webOS|BlackBerry/i.test(ua) ||
    (typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)")?.matches);

  const cores = navigator.hardwareConcurrency || 4;
  const memGB = navigator.deviceMemory || 4;

  const saveData = navigator.connection?.saveData === true;
  const reduceMotion =
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  // Low-end affects UI/FX only. It must never lower still-photo quality.
  const isLowEnd =
    saveData ||
    (isAndroid && (cores <= 4 || memGB <= 2)) ||
    (isMobile && cores <= 2) ||
    memGB <= 2;

  return {
    isAndroid,
    isIOS,
    isMobile,
    isLowEnd,
    cores,
    memGB,
    saveData,
    reduceMotion,
  };
}

export function getPerfProfile() {
  if (!cached) cached = detect();
  return cached;
}

/** Gắn class lên <html> để CSS giảm blur / effect */
export function applyPerfClasses() {
  if (typeof document === "undefined") return;
  const p = getPerfProfile();
  const root = document.documentElement;
  root.classList.toggle("perf-android", p.isAndroid);
  root.classList.toggle("perf-mobile", p.isMobile);
  root.classList.toggle("perf-lite", p.isLowEnd || p.isAndroid);
  root.classList.toggle("perf-reduce-motion", Boolean(p.reduceMotion));

  if (!root.dataset.tabVisBound) {
    root.dataset.tabVisBound = "1";
    const sync = () => {
      root.classList.toggle("tab-hidden", document.hidden);
    };
    document.addEventListener("visibilitychange", sync);
    sync();
  }
}

/**
 * Camera preview constraints.
 *
 * Still capture now prefers ImageCapture.takePhoto(), so preview FPS can stay at
 * a stable 30 while we ask for a high-resolution 4:3 stream as the universal
 * Safari/iOS fallback. `ideal` is intentionally used instead of `exact`: older
 * or weaker devices remain free to negotiate a lower supported mode rather
 * than failing camera startup.
 *
 * IMPORTANT: performance-lite/save-data never intentionally lowers photo
 * resolution. Lite mode is UI/FX only.
 */
export function getCameraPreviewConstraints(base = {}) {
  return {
    ...base,
    width: { ideal: 2560 },
    height: { ideal: 1920 },
    frameRate: { ideal: 30 },
  };
}

/**
 * After getUserMedia succeeds, opportunistically improve a low-resolution
 * track without ever forcing an unsupported mode. If the browser already gave
 * us a higher mode, leave it untouched.
 * @param {MediaStream} stream
 * @returns {Promise<MediaStream>}
 */
export async function upgradeStreamQuality(stream) {
  const track = stream?.getVideoTracks?.()?.[0];
  if (!track || typeof track.getCapabilities !== "function") return stream;
  if (typeof track.applyConstraints !== "function") return stream;

  try {
    const caps = track.getCapabilities() || {};
    const settings = track.getSettings?.() || {};

    const maxW = caps.width?.max;
    const maxH = caps.height?.max;
    const maxFps = caps.frameRate?.max;

    const targetW = 2560;
    const targetH = 1920;
    const targetFps = 30;

    const wantW =
      typeof maxW === "number" && maxW > 0
        ? Math.min(maxW, targetW)
        : targetW;
    const wantH =
      typeof maxH === "number" && maxH > 0
        ? Math.min(maxH, targetH)
        : targetH;
    const wantFps =
      typeof maxFps === "number" && maxFps > 0
        ? Math.min(maxFps, targetFps)
        : targetFps;

    const curW = settings.width || 0;
    const curH = settings.height || 0;
    const curFps = settings.frameRate || 0;

    // Never reconfigure/downshift a stream that already meets or exceeds the
    // desired capture fallback resolution.
    if (
      curW >= wantW * 0.92 &&
      curH >= wantH * 0.92 &&
      curFps >= Math.min(wantFps, 24) * 0.9
    ) {
      return stream;
    }

    await track.applyConstraints({
      width: { ideal: wantW },
      height: { ideal: wantH },
      frameRate: { ideal: wantFps },
    });
  } catch {
    /* giữ stream hiện tại — không phá cam */
  }
  return stream;
}

/**
 * Cấu hình tuyết theo thiết bị + route
 */
export function getSnowPerfConfig({ onCameraRoute, isPinkSnow, isPink }) {
  const p = getPerfProfile();

  if ((p.isAndroid || p.isLowEnd) && onCameraRoute) {
    return { enabled: true, intervalMs: 320, maxFlakes: 8, lite: true };
  }
  if (p.isAndroid || p.isLowEnd) {
    return {
      enabled: true,
      intervalMs: isPinkSnow ? 180 : 280,
      maxFlakes: isPinkSnow ? 14 : 8,
      lite: true,
    };
  }
  if (p.isMobile && onCameraRoute) {
    return { enabled: true, intervalMs: 200, maxFlakes: 16, lite: true };
  }

  if (onCameraRoute) {
    return {
      enabled: true,
      intervalMs: isPinkSnow ? 120 : 180,
      maxFlakes: isPinkSnow ? 28 : 16,
      lite: false,
    };
  }
  return {
    enabled: true,
    intervalMs: isPinkSnow ? 55 : isPink ? 100 : 130,
    maxFlakes: isPinkSnow ? 68 : isPink ? 36 : 28,
    lite: false,
  };
}
