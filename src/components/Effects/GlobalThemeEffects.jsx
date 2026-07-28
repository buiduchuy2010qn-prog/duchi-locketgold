import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import SnowEffect from "./SnowEffect";
import {
  hasSnowEffect,
  isPinkSnowTheme,
  isPinkSnowAiTheme,
  getSnowIntensity,
} from "@/utils/theme/themeUtils";
import { getPerfProfile } from "@/utils/device/perfProfile";

/**
 * Tuyết canvas — không che camera gesture (pointer-events: none).
 * Intensity: off | light | normal (localStorage huy-locket-snow-intensity).
 */
const GlobalThemeEffects = () => {
  const { theme, snowIntensity } = useTheme();
  const location = useLocation();
  const [hidden, setHidden] = useState(
    typeof document !== "undefined" ? document.hidden : false,
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const applyMq = () => setReduceMotion(Boolean(mq?.matches));
    applyMq();
    mq?.addEventListener?.("change", applyMq);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
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
    const p = getPerfProfile();
    const isPink = isPinkSnowTheme(theme);
    const isAi = isPinkSnowAiTheme(theme);

    // reduced motion — few static flakes only, EXCEPT for pink/ai mode which just slows down/reduces flakes
    if (reduceMotion) {
      return { 
        enabled: true, 
        maxFlakes: isAi ? 15 : (isPink ? 15 : 8), 
        staticOnly: !(isPink || isAi), 
        pinkMode: isPink,
        aiMode: isAi
      };
    }

    let max = intensity === "normal" ? (isPink ? 120 : 42) : (isPink ? 70 : 24);
    if (p.isMobile) max = intensity === "normal" ? (isPink ? 50 : 26) : (isPink ? 30 : 20);
    if (p.isLowEnd || p.isAndroid) max = intensity === "normal" ? (isPink ? 35 : 18) : (isPink ? 20 : 14);
    if (onCameraRoute) {
      // Keep camera smooth — more snow for pink, lighter for others
      max = Math.min(max, p.isLowEnd || p.isAndroid ? (isPink ? 20 : 12) : (isPink ? 45 : 18));
    }
    // hard cap
    max = Math.min(150, Math.max(10, max));

    return {
      enabled: true,
      maxFlakes: max,
      staticOnly: false,
      pinkMode: isPink,
      aiMode: isAi,
      reduceMotion,
    };
  }, [snowTheme, intensity, theme, reduceMotion, onCameraRoute]);

  if (!cfg.enabled || hidden) return null;

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
