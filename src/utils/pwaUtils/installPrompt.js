let deferredPrompt = null;
let initialized = false;

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("huy-locket-pwa-install-change", {
      detail: { available: Boolean(deferredPrompt) },
    }),
  );
}

export function initPWAInstallPrompt() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    emitChange();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emitChange();
  });
}

export function hasPWAInstallPrompt() {
  return Boolean(deferredPrompt);
}

export async function promptPWAInstall() {
  if (!deferredPrompt) return { available: false, outcome: null };
  const prompt = deferredPrompt;
  deferredPrompt = null;
  emitChange();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return {
    available: true,
    outcome: choice?.outcome || null,
    platform: choice?.platform || null,
  };
}

export function isStandalonePWA() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true
  );
}
