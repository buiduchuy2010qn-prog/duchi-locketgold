import React, { createContext, useEffect, useState, useCallback } from "react";
import "@/styles/iosTheme.css";
import {
  applyTheme,
  resolveStoredTheme,
  getSnowIntensity,
  setSnowIntensity as persistSnowIntensity,
  getColorMode,
  getPerfMode,
  getInterfaceMode,
  setInterfaceMode as persistInterfaceMode,
  PINK_SNOW_THEME,
} from "@/utils/theme/themeUtils";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => resolveStoredTheme() || PINK_SNOW_THEME);
  const [snowIntensity, setSnowIntensityState] = useState(() => getSnowIntensity());
  const [colorMode, setColorModeState] = useState(() => getColorMode());
  const [perfMode, setPerfModeState] = useState(() => getPerfMode());
  const [interfaceMode, setInterfaceModeState] = useState(() => getInterfaceMode());

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

  const changeInterfaceMode = useCallback((newMode) => {
    const v = persistInterfaceMode(newMode);
    setInterfaceModeState(v);
  }, []);

  useEffect(() => {
    applyTheme(theme, colorMode, perfMode, interfaceMode);
  }, [theme, colorMode, perfMode, interfaceMode]);

  // Lắng nghe thay đổi theme hệ thống nếu đang ở chế độ 'system'
  useEffect(() => {
    if (colorMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme(theme, colorMode, perfMode, interfaceMode);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [colorMode, theme, perfMode, interfaceMode]);

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
        interfaceMode,
        changeInterfaceMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
