import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
    filter: "blur(10px)",
  },
  in: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
  },
  out: {
    opacity: 0,
    y: -10,
    filter: "blur(10px)",
  },
};

const pageTransition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.3,
};

export const PageTransition = ({ children, className = "w-full h-full" }) => {
  const { perfMode } = useTheme();

  // Máy yếu: không chạy blur/transform khi đổi trang.
  if (perfMode === "lite") {
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
