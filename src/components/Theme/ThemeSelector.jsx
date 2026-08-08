import { useState } from "react";
import { CONFIG } from "@/config";
import { useTheme } from "@/hooks/useTheme";
import {
  getIosAccent,
  getThemeLabel,
  hasSnowEffect,
  IOS_THEME,
  isIosTheme,
  setIosAccent,
} from "@/utils/theme/themeUtils";

const IOS_PRESETS = [
  "#f5b700",
  "#0a84ff",
  "#ff2d55",
  "#af52de",
  "#34c759",
  "#ff9500",
  "#64d2ff",
  "#ffffff",
];

const ThemeSelector = () => {
  const {
    theme,
    changeTheme,
    colorMode,
    changeColorMode,
    perfMode,
    changePerfMode,
  } = useTheme();
  const [iosAccent, setIosAccentState] = useState(() => getIosAccent());
  const themeOptions = CONFIG.ui.themes.includes(IOS_THEME)
    ? CONFIG.ui.themes
    : [IOS_THEME, ...CONFIG.ui.themes];

  const changeIosAccent = (value) => {
    const next = setIosAccent(value);
    setIosAccentState(next);
  };

  return (
    <div className="w-full flex justify-center">
      <div className="w-full">
        <h1 className="font-lovehouse text-base-content text-center text-3xl font-semibold">
          Setting Theme
        </h1>

        <fieldset className="border rounded-2xl shadow-md w-full py-3">
          <legend className="font-semibold text-base-content text-lg text-left ml-5">
            🎨 Chọn Giao Diện:
          </legend>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto px-4 py-3">
            {themeOptions.map((t) => {
              const label = getThemeLabel(t);
              const snow = hasSnowEffect(t);
              return (
                <label
                  key={t}
                  className={`flex flex-col items-center gap-2 p-2 rounded-lg shadow-sm transition-all duration-300
                  bg-base-100 hover:bg-base-300
                  ${
                    theme === t
                      ? "outline-3 scale-80 outline-dotted outline-primary opacity-70"
                      : "cursor-pointer"
                  }`}
                  data-theme={t}
                >
                  <div className="grid grid-cols-5 grid-rows-3 w-30 h-12 rounded-lg overflow-hidden border border-gray-300 relative">
                    <div className="bg-base-200 col-start-1 row-span-2 row-start-1"></div>
                    <div className="bg-base-300 col-start-1 row-start-3"></div>
                    <div className="bg-base-100 col-span-4 col-start-2 row-span-3 row-start-1 flex flex-col gap-1 p-1">
                      <div className="font-bold text-[10px] leading-tight truncate">
                        {label}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <div className="bg-primary flex aspect-square w-3 items-center justify-center rounded">
                          <div className="text-primary-content text-xs font-bold">A</div>
                        </div>
                        <div className="bg-secondary flex aspect-square w-3 items-center justify-center rounded">
                          <div className="text-secondary-content text-xs font-bold">A</div>
                        </div>
                        <div className="bg-accent flex aspect-square w-3 items-center justify-center rounded">
                          <div className="text-accent-content text-xs font-bold">A</div>
                        </div>
                      </div>
                    </div>
                    {snow && (
                      <span className="absolute top-0.5 right-0.5 text-[10px] leading-none">
                        ❄
                      </span>
                    )}
                    {isIosTheme(t) && (
                      <span className="absolute top-0.5 right-0.5 text-[9px] font-black leading-none">
                        iOS
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">
                    {label}
                  </span>
                  <input
                    type="radio"
                    name="theme-radios"
                    className="radio radio-sm hidden"
                    value={t}
                    checked={theme === t}
                    onChange={() => changeTheme(t)}
                  />
                </label>
              );
            })}
          </div>
        </fieldset>

        {isIosTheme(theme) && (
          <fieldset className="border rounded-2xl shadow-md w-full py-3 mt-4">
            <legend className="font-semibold text-base-content text-lg text-left ml-5">
              Màu theme iOS
            </legend>
            <div className="px-4 py-2 space-y-3">
              <p className="text-xs text-base-content/60">
                Đổi màu viền, nút, pill và ánh sáng của giao diện iOS. Thay đổi áp dụng ngay.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 rounded-full bg-base-200 px-3 py-2 border border-base-300">
                  <input
                    type="color"
                    value={iosAccent}
                    onChange={(e) => changeIosAccent(e.target.value)}
                    className="w-8 h-8 rounded-full overflow-hidden cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Chọn màu theme iOS"
                  />
                  <span className="font-mono text-sm uppercase">{iosAccent}</span>
                </label>
                <button
                  type="button"
                  onClick={() => changeIosAccent("#f5b700")}
                  className="btn btn-sm rounded-full"
                >
                  Màu Locket
                </button>
              </div>
              <div className="flex gap-2 flex-wrap" aria-label="Màu iOS gợi ý">
                {IOS_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Chọn màu ${color}`}
                    title={color}
                    onClick={() => changeIosAccent(color)}
                    className={`w-9 h-9 rounded-full border-2 transition-transform active:scale-90 ${
                      iosAccent === color.toLowerCase()
                        ? "border-base-content scale-110"
                        : "border-base-300"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </fieldset>
        )}

        <fieldset className="border rounded-2xl shadow-md w-full py-3 mt-4">
          <legend className="font-semibold text-base-content text-lg text-left ml-5">
            🌗 Chế độ Màu:
          </legend>
          <div className="flex gap-2 flex-wrap justify-center px-4 py-2">
            {[
              { id: "light", label: "Sáng" },
              { id: "dark", label: "Tối" },
              { id: "system", label: "Hệ thống" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => changeColorMode(mode.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                  colorMode === mode.id
                    ? "bg-primary text-primary-content border-primary"
                    : "bg-base-200 border-base-300 text-base-content"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="border rounded-2xl shadow-md w-full py-3 mt-4 mb-4 flex justify-between items-center px-5">
          <div>
            <p className="font-semibold text-base-content text-lg">
              🚀 Máy cấu hình yếu
            </p>
            <p className="text-xs text-base-content/60 mt-1">
              Tắt hiệu ứng nặng, giảm giật lag, tăng FPS
            </p>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-lg"
            checked={perfMode === "lite"}
            onChange={(e) => changePerfMode(e.target.checked ? "lite" : "normal")}
          />
        </fieldset>
      </div>
    </div>
  );
};

export default ThemeSelector;
