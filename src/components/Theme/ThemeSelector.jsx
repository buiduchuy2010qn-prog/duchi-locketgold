import { CONFIG } from "@/config";
import { useTheme } from "@/hooks/useTheme";
import {
  getThemeLabel,
  hasSnowEffect,
  INTERFACE_DEFAULT,
  INTERFACE_IOS,
} from "@/utils/theme/themeUtils";

const ThemeSelector = () => {
  const {
    theme,
    changeTheme,
    colorMode,
    changeColorMode,
    perfMode,
    changePerfMode,
    interfaceMode,
    changeInterfaceMode,
  } = useTheme();

  return (
    <div className="w-full flex justify-center">
      <div className="w-full">
        <h1 className="font-lovehouse text-base-content text-center text-3xl font-semibold">
          Giao diện & Màu sắc
        </h1>

        <fieldset className="border rounded-2xl shadow-md w-full py-3">
          <legend className="font-semibold text-base-content text-lg text-left ml-5">
            🧩 Kiểu Giao Diện:
          </legend>
          <div className="grid grid-cols-2 gap-3 px-4 py-3">
            {[
              {
                id: INTERFACE_DEFAULT,
                label: "Mặc định",
                description: "Bố cục Huy Locket hiện tại",
              },
              {
                id: INTERFACE_IOS,
                label: "iOS",
                description: "Bố cục kiểu Locket iPhone",
              },
            ].map((item) => {
              const active = interfaceMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeInterfaceMode(item.id)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-base-300 bg-base-100 hover:bg-base-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-base-content">{item.label}</span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 ${
                        active
                          ? "border-primary bg-primary"
                          : "border-base-content/30 bg-transparent"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-base-content/60 mt-1">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="px-4 pb-2 text-xs text-base-content/60">
            Kiểu giao diện và màu theme hoạt động độc lập. Ví dụ: iOS + Hồng Tuyết hoặc iOS + Đại Dương Xanh.
          </p>
        </fieldset>

        <fieldset className="border rounded-2xl shadow-md w-full py-3 mt-4">
          <legend className="font-semibold text-base-content text-lg text-left ml-5">
            🎨 Màu / Theme:
          </legend>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto px-4 py-3">
            {CONFIG.ui.themes.map((t) => {
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
