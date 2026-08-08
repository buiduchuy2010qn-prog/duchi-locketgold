// utils/themeUtils.js
import { CONFIG } from "@/config/webConfig";

/** DaisyUI / data-theme ids */
export const PINK_SNOW_THEME = "pinksnow";
export const GLASS_THEME = "glass";
export const PINK_SAKURA_GLASS_THEME = "pink-sakura-glass";
export const PINK_LITE_THEME = "pink-lite";
export const PINK_SNOW_AI_THEME = "pink-snow-ai";
export const OCEAN_BLUE_THEME = "ocean-blue";
export const IOS_THEME = "ios";

/** User-facing storage key values */
export const HUY_THEME_KEY = "huy-locket-theme";
export const HUY_SNOW_KEY = "huy-locket-snow-intensity";
export const HUY_COLOR_MODE_KEY = "huy-locket-color-mode";
export const HUY_PERF_MODE_KEY = "huy-locket-perf-mode";
export const HUY_IOS_ACCENT_KEY = "huy-locket-ios-accent";

export const HUY_THEME_DEFAULT = "default";
export const HUY_THEME_PINK_SNOW = "pink-snow";
export const HUY_THEME_GLASS = "glass";
export const HUY_THEME_PINK_SAKURA = "pink-sakura-glass";
export const HUY_THEME_PINK_LITE = "pink-lite";
export const HUY_THEME_PINK_SNOW_AI = "pink-snow-ai";
export const HUY_THEME_OCEAN_BLUE = "ocean-blue";
export const HUY_THEME_IOS = "ios";

export const IOS_DEFAULT_ACCENT = "#f5b700";

/** Theme bật hiệu ứng tuyết rơi — Glass/iOS do NOT include snow */
export const SNOW_THEME_IDS = new Set([
  "pinksnow",
  "pink-snow",
  "valentine",
  "winter",
  "pink-snow-ai",
]);

export const isPinkSnowTheme = (theme) =>
  theme === PINK_SNOW_THEME ||
  theme === HUY_THEME_PINK_SNOW ||
  theme === "valentine";

export const isGlassTheme = (theme) =>
  theme === GLASS_THEME || theme === HUY_THEME_GLASS;

export const isPinkSakuraGlassTheme = (theme) =>
  theme === PINK_SAKURA_GLASS_THEME || theme === HUY_THEME_PINK_SAKURA;

export const isPinkLiteTheme = () => false; // Deprecated, mapped to pink-snow + lite

export const isPinkSnowAiTheme = (theme) =>
  theme === PINK_SNOW_AI_THEME || theme === HUY_THEME_PINK_SNOW_AI;

export const isOceanBlueTheme = (theme) =>
  theme === OCEAN_BLUE_THEME || theme === HUY_THEME_OCEAN_BLUE;

export const isIosTheme = (theme) =>
  theme === IOS_THEME || theme === HUY_THEME_IOS;

export const hasSnowEffect = (theme) => SNOW_THEME_IDS.has(theme);

function normalizeHexColor(value, fallback = IOS_DEFAULT_ACCENT) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .slice(1)
      .split("")
      .map((c) => `${c}${c}`)
      .join("")}`.toLowerCase();
  }
  return fallback;
}

export function getIosAccent() {
  try {
    return normalizeHexColor(localStorage.getItem(HUY_IOS_ACCENT_KEY));
  } catch {
    return IOS_DEFAULT_ACCENT;
  }
}

export function setIosAccent(color) {
  const next = normalizeHexColor(color);
  try {
    localStorage.setItem(HUY_IOS_ACCENT_KEY, next);
  } catch {
    /* ignore */
  }
  try {
    document.documentElement.style.setProperty("--ios-user-accent", next);
  } catch {
    /* ignore */
  }

  const root = document.documentElement;
  if (root?.classList?.contains("theme-ios")) {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    metaTheme?.setAttribute("content", next);
  }
  return next;
}

/** Map any theme id → huy-locket-theme storage value */
export function toHuyThemeKey(themeId) {
  if (isPinkSnowTheme(themeId) && themeId !== "valentine" && themeId !== "winter") {
    return HUY_THEME_PINK_SNOW;
  }
  if (isGlassTheme(themeId)) return HUY_THEME_GLASS;
  if (isPinkSakuraGlassTheme(themeId)) return HUY_THEME_PINK_SAKURA;
  if (isPinkSnowAiTheme(themeId)) return HUY_THEME_PINK_SNOW_AI;
  if (isOceanBlueTheme(themeId)) return HUY_THEME_OCEAN_BLUE;
  if (isIosTheme(themeId)) return HUY_THEME_IOS;
  return HUY_THEME_DEFAULT;
}

/** off | light | normal — default light */
export function getSnowIntensity() {
  try {
    const v = localStorage.getItem(HUY_SNOW_KEY);
    if (v === "off" || v === "light" || v === "normal") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

export function setSnowIntensity(level) {
  const v =
    level === "off" || level === "normal" || level === "light" ? level : "light";
  try {
    localStorage.setItem(HUY_SNOW_KEY, v);
  } catch {
    /* ignore */
  }
  try {
    document.documentElement.dataset.snowIntensity = v;
  } catch {
    /* ignore */
  }
  return v;
}

export function getColorMode() {
  try {
    const v = localStorage.getItem(HUY_COLOR_MODE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export function getPerfMode() {
  try {
    const v = localStorage.getItem(HUY_PERF_MODE_KEY);
    if (v === "normal" || v === "lite") return v;

    // Auto-migrate old pink-lite
    const oldTheme = localStorage.getItem(HUY_THEME_KEY);
    if (oldTheme === "pink-lite") {
      localStorage.setItem(HUY_PERF_MODE_KEY, "lite");
      return "lite";
    }
  } catch {
    /* ignore */
  }
  return "normal";
}

/** Resolve data-theme id from storage */
export function resolveStoredTheme() {
  try {
    const huy = localStorage.getItem(HUY_THEME_KEY);
    if (huy === HUY_THEME_PINK_SNOW || huy === "pinksnow") {
      return PINK_SNOW_THEME;
    }
    if (huy === HUY_THEME_GLASS || huy === "glass") {
      return GLASS_THEME;
    }
    if (huy === HUY_THEME_PINK_SAKURA || huy === "pink-sakura-glass") {
      return PINK_SAKURA_GLASS_THEME;
    }
    if (huy === HUY_THEME_PINK_LITE || huy === "pink-lite") {
      // Migrate to pink-snow
      localStorage.setItem(HUY_THEME_KEY, HUY_THEME_PINK_SNOW);
      return PINK_SNOW_THEME;
    }
    if (huy === HUY_THEME_PINK_SNOW_AI || huy === "pink-snow-ai") {
      return PINK_SNOW_AI_THEME;
    }
    if (huy === HUY_THEME_OCEAN_BLUE || huy === "ocean-blue") {
      return OCEAN_BLUE_THEME;
    }
    if (huy === HUY_THEME_IOS || huy === IOS_THEME) {
      return IOS_THEME;
    }
    if (huy === HUY_THEME_DEFAULT) {
      const legacy = localStorage.getItem("theme");
      if (
        legacy &&
        !isPinkSnowTheme(legacy) &&
        !isGlassTheme(legacy) &&
        legacy !== "pinksnow"
      ) {
        return legacy;
      }
      return "light";
    }
    const legacy = localStorage.getItem("theme");
    if (legacy === "pink-snow") return PINK_SNOW_THEME;
    if (legacy) return legacy;
  } catch {
    /* ignore */
  }
  return PINK_SNOW_THEME;
}

export function getThemeLabel(themeId) {
  const labels = CONFIG?.ui?.themeLabels || {};
  if (labels[themeId]) return labels[themeId];
  if (themeId === HUY_THEME_PINK_SNOW || themeId === PINK_SNOW_THEME) {
    return labels.pinksnow || "Hồng Tuyết";
  }
  if (isGlassTheme(themeId)) return labels.glass || "Glass";
  if (isIosTheme(themeId)) return labels.ios || "iOS";
  return themeId;
}

/**
 * Apply theme to document before/after React paint.
 * Snow only when theme is in SNOW_THEME_IDS (not glass/iOS).
 */
export const applyTheme = (theme, overrideColorMode, overridePerfMode) => {
  const t = theme || resolveStoredTheme() || PINK_SNOW_THEME;
  const colorMode = overrideColorMode || getColorMode();
  const perfMode = overridePerfMode || getPerfMode();
  const root = document.documentElement;

  // Normalize aliases
  const dataTheme =
    t === "pink-snow" ? PINK_SNOW_THEME : t === HUY_THEME_GLASS ? GLASS_THEME : t;

  root.setAttribute("data-theme", dataTheme);
  root.dataset.huyTheme = toHuyThemeKey(dataTheme);

  // Resolve system color scheme if needed
  let activeColorMode = colorMode;
  if (colorMode === "system") {
    activeColorMode =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }

  root.setAttribute("data-color-mode", activeColorMode);
  root.setAttribute("data-performance-mode", perfMode);

  const classMap = {
    "theme-pink-snow": isPinkSnowTheme(dataTheme),
    "theme-glass": isGlassTheme(dataTheme),
    "theme-pink-sakura-glass": isPinkSakuraGlassTheme(dataTheme),
    "theme-pink-snow-ai": isPinkSnowAiTheme(dataTheme),
    "theme-ocean-blue": isOceanBlueTheme(dataTheme),
    "theme-ios": isIosTheme(dataTheme),
  };

  for (const [className, enabled] of Object.entries(classMap)) {
    root.classList.toggle(className, enabled);
    document.body?.classList.toggle(className, enabled);
  }

  // This custom variable is harmless for other themes and lets iOS color update live.
  setIosAccent(getIosAccent());

  try {
    localStorage.setItem("theme", dataTheme);
    localStorage.setItem(HUY_THEME_KEY, toHuyThemeKey(dataTheme));
    localStorage.setItem(HUY_COLOR_MODE_KEY, colorMode);
    localStorage.setItem(HUY_PERF_MODE_KEY, perfMode);
  } catch {
    /* ignore */
  }

  const intensity = getSnowIntensity();
  root.dataset.snowIntensity = intensity;

  let baseColor = "#edf2f8";
  try {
    const computedStyle = getComputedStyle(root);
    baseColor =
      computedStyle.getPropertyValue("--color-base-100")?.trim() || baseColor;
  } catch {
    /* ignore */
  }

  if (dataTheme === PINK_SNOW_THEME) {
    baseColor = "#c2185b";
  } else if (dataTheme === "valentine") {
    baseColor = "#ff6b9d";
  } else if (isGlassTheme(dataTheme)) {
    baseColor = "#edf2f8";
  } else if (isPinkSakuraGlassTheme(dataTheme)) {
    baseColor = "#ff4f9a";
  } else if (isPinkLiteTheme(dataTheme)) {
    baseColor = "#ec407a";
  } else if (isPinkSnowAiTheme(dataTheme)) {
    baseColor = "#ff3385";
  } else if (isOceanBlueTheme(dataTheme)) {
    baseColor = "#0284c7";
  } else if (isIosTheme(dataTheme)) {
    baseColor = getIosAccent();
  }

  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute("content", baseColor || "#edf2f8");
};

export function bootThemeEarly() {
  try {
    applyTheme(resolveStoredTheme());
  } catch {
    /* ignore */
  }
}
