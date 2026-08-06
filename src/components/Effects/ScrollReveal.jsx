import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

/**
 * A wrapper component that applies a fade-in and slide-up animation
 * when the element scrolls into view.
 */
export const ScrollReveal = ({
  children,
  className = "",
  delay = 0,
  duration = 0.5,
  yOffset = 30,
  once = true,
  amount = 0.2,
  as = "div",
  ...props
}) => {
  const { perfMode } = useTheme();
  const MotionComponent = motion[as] || motion.div;

  // Máy yếu: bỏ IntersectionObserver + Framer Motion cho danh sách dài.
  if (perfMode === "lite") {
    return React.createElement(as, { className, ...props }, children);
  }

  return (
    <MotionComponent
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{
        duration,
        delay,
        ease: "easeOut",
      }}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};

export default ScrollReveal;
