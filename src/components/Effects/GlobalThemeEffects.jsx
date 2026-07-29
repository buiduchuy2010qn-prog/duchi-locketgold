import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import SnowEffect from "./SnowEffect";
import OceanEffect from "./OceanEffect";
import {
  hasSnowEffect,
  isPinkSnowTheme,
  isPinkSnowAiTheme,
  isOceanBlueTheme,
  getSnowIntensity,
} from "@/utils/theme/themeUtils";
import { getPerfProfile } from "@/utils/device/perfProfile";

/**
 * Persistent decorative theme effects. Each renderer owns visibility pausing
 * so the canvas survives route changes and hidden tabs without duplicate RAFs.
 */
const GlobalThemeEffects = () => {
  const { theme, snowIntensity } = useTheme();
  const location = useLocation();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const applyMq = () => setReduceMotion(Boolean(mq?.matches));
    applyMq();
    mq?.addEventListener?.("change", applyMq);

    return () => {
      mq?.removeEventListener?.("change", applyMq);
    };
  }, []);

  const intensity = snowIntensity || getSnowIntensity();
  const snowTheme = hasSnowEffect(theme);
  const onCameraRoute =
    location.pathname.startsWith("/locket") ||
    location.pathname.startsWith("/camera");

  const cfg = useMemo(() => {
    if (!snowTheme || intensity === "off") {
      return { enabled: false, maxFlakes: 0, staticOnly: false };
    }

    const profile = getPerfProfile();
    const isPink = isPinkSnowTheme(theme);
    const isAi = isPinkSnowAiTheme(theme);

    if (reduceMotion) {
      return {
        enabled: true,
        maxFlakes: isAi ? 15 : isPink ? 22 : 8,
        staticOnly: !(isPink || isAi),
        pinkMode: isPink,
        aiMode: isAi,
        reduceMotion: true,
      };
    }

    let max =
      intensity === "normal" ? (isPink ? 108 : 42) : isPink ? 72 : 24;

    if (profile.isMobile) {
      max =
        intensity === "normal" ? (isPink ? 66 : 26) : isPink ? 46 : 20;
    }

    if (profile.isLowEnd || profile.isAndroid) {
      max =
        intensity === "normal" ? (isPink ? 40 : 18) : isPink ? 28 : 14;
    }

    if (onCameraRoute) {
      max = Math.min(
        max,
        profile.isLowEnd || profile.isAndroid
          ? isPink
            ? 26
            : 12
          : isPink
            ? 48
            : 18,
      );
    }

    return {
      enabled: true,
      maxFlakes: Math.min(120, Math.max(10, max)),
      staticOnly: false,
      pinkMode: isPink,
      aiMode: isAi,
      reduceMotion: false,
    };
  }, [intensity, onCameraRoute, reduceMotion, snowTheme, theme]);

  if (isOceanBlueTheme(theme)) {
    return <OceanEffect reduceMotion={reduceMotion} />;
  }

  if (!cfg.enabled) return null;

  return (
    <SnowEffect
      maxFlakes={cfg.maxFlakes}
      pinkMode={cfg.pinkMode}
      aiMode={cfg.aiMode}
      staticOnly={cfg.staticOnly}
      reduceMotion={cfg.reduceMotion}
      className={cfg.pinkMode ? "snow-layer--pink" : ""}
    />
  );
};

export default GlobalThemeEffects;
