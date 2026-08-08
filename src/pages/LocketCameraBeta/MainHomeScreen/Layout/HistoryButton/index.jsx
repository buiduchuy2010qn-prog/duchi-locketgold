import React from "react";
import { useTranslation } from "react-i18next";

const HistoryArrow = ({ setIsBottomOpen }) => {
  const { t } = useTranslation("main");

  const handleClick = () => {
    setIsBottomOpen(true);
  };

  return (
    <div className="flex flex-col items-center select-none" data-history-button="true">
      <button
        className="flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
        onClick={handleClick}
      >
        <span
          data-mobile-activity-pill="true"
          className="hidden items-center gap-2 rounded-full bg-base-300/70 px-5 py-3 text-lg font-semibold backdrop-blur-xl"
        >
          <span aria-hidden="true">✦</span>
          {t("home.activity", { defaultValue: "Hoạt động" })}
        </span>

        <span data-desktop-history-button="true" className="flex flex-col items-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <span className="text-xl font-semibold text-base-content">
              {t("home.history")}
            </span>
          </div>
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 8l17 7l17-7"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    </div>
  );
};

export default HistoryArrow;
