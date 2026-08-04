import React from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import { useAnimation } from "@/context/AnimationContext";
import { UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function DragDropOverlay({ isDragging }) {
  const { isAnimationEnabled } = useAnimation();
  const { t } = useTranslation("main");

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none rounded-xl mx-2 my-2 border-4 border-dashed border-primary"
          initial={isAnimationEnabled ? { opacity: 0, scale: 0.95 } : { opacity: 1 }}
          animate={isAnimationEnabled ? { opacity: 1, scale: 1 } : { opacity: 1 }}
          exit={isAnimationEnabled ? { opacity: 0, scale: 0.95 } : { opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            animate={
              isAnimationEnabled
                ? { y: [0, -10, 0] }
                : {}
            }
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center justify-center text-white"
          >
            <UploadCloud size={64} className="mb-4 text-primary" />
            <h2 className="text-2xl font-bold text-center px-4">
              {t("home.drag_drop_title", { defaultValue: "Thả ảnh vào đây" })}
            </h2>
            <p className="text-gray-300 mt-2 text-center px-4">
              {t("home.drag_drop_subtitle", { defaultValue: "Để tạo Locket ngay lập tức!" })}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
