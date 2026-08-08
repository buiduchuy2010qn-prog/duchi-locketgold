import React, { createContext, useEffect, useState, useCallback } from "react";
import "@/styles/iosTheme.css";
import {
  applyTheme,
  resolveStoredTheme,
  getSnowIntensity,
  setSnowIntensity as persistSnowIntensity,
  getColorMode,
  getPerfMode,
  PINK_SNOW_THEME,
} from "@/utils/theme/themeUtils";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => resolveStoredTheme() || PINK_SNOW_THEME);
  const [snowIntensity, setSnowIntensityState] = useState(() => getSnowIntensity());
  const [colorMode, setColorModeState] = useState(() => getColorMode());
  const [perfMode, setPerfModeState] = useState(() => getPerfMode());

  const changeTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
  }, []);

  const changeSnowIntensity = useCallback((level) => {
    const v = persistSnowIntensity(level);
    setSnowIntensityState(v);
  }, []);

  const changeColorMode = useCallback((newMode) => {
    setColorModeState(newMode);
  }, []);

  const changePerfMode = useCallback((newMode) => {
    setPerfModeState(newMode);
  }, []);

  useEffect(() => {
    applyTheme(theme, colorMode, perfMode);
  }, [theme, colorMode, perfMode]);

  // Lắng nghe thay đổi theme hệ thống nếu đang ở chế độ 'system'
  useEffect(() => {
    if (colorMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      // Re-apply theme to trigger DOM attribute update
      applyTheme(theme, colorMode, perfMode);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [colorMode, theme, perfMode]);

  useEffect(() => {
    persistSnowIntensity(snowIntensity);
  }, [snowIntensity]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        changeTheme,
        snowIntensity,
        changeSnowIntensity,
        colorMode,
        changeColorMode,
        perfMode,
        changePerfMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
