import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -6,
  },
};

const pageTransition = {
  type: "tween",
  ease: [0.22, 1, 0.36, 1],
  duration: 0.2,
};

export const PageTransition = ({ children, className = "w-full h-full" }) => {
  const { perfMode } = useTheme();
  const reduceMotion = useReducedMotion();

  // Máy yếu / người dùng giảm chuyển động: render ngay, không tạo compositing thừa.
  if (perfMode === "lite" || reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
