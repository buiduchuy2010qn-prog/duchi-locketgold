import React from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

const LoadingPageMain = ({ isLoading }) => {
  const { t } = useTranslation("public");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={isLoading}
      aria-hidden={!isLoading}
      className={clsx(
        "fixed inset-0 z-50 flex items-center justify-center bg-base-100 text-base-content transition-opacity duration-300",
        {
          "opacity-100": isLoading,
          "pointer-events-none opacity-0": !isLoading,
        },
      )}
    >
      <span className="sr-only">
        {t("loading_page.description", { defaultValue: "Đang tải dữ liệu" })}
      </span>

      <div className="w-full max-w-md animate-pulse px-5 motion-reduce:animate-none">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-full bg-base-300" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/5 rounded-full bg-base-300" />
            <div className="h-3 w-1/4 rounded-full bg-base-200" />
          </div>
          <div className="h-10 w-10 rounded-full bg-base-200" />
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-[36px] bg-base-200">
          <div className="absolute inset-0 bg-gradient-to-br from-base-300/70 via-base-200 to-base-300/40" />
          <div className="absolute bottom-5 left-1/2 h-10 w-2/3 -translate-x-1/2 rounded-3xl bg-base-300/80" />
        </div>

        <div className="mt-5 space-y-3">
          <div className="h-4 w-3/5 rounded-full bg-base-300" />
          <div className="h-3 w-2/5 rounded-full bg-base-200" />
        </div>

        <div className="mt-8 grid grid-cols-3 items-center">
          <div className="h-12 w-12 justify-self-start rounded-full bg-base-200" />
          <div className="h-12 w-12 justify-self-center rounded-full bg-base-300" />
          <div className="h-12 w-12 justify-self-end rounded-full bg-base-200" />
        </div>
      </div>
    </div>
  );
};

export default LoadingPageMain;
