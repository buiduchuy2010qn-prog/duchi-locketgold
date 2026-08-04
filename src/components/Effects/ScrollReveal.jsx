import React from 'react';
import { motion } from 'framer-motion';

/**
 * A wrapper component that applies a fade-in and slide-up animation
 * when the element scrolls into view.
 */
export const ScrollReveal = ({
  children,
  className = '',
  delay = 0,
  duration = 0.5,
  yOffset = 30,
  once = true,
  amount = 0.2, // amount of element that must be visible
  as = 'div',
  ...props
}) => {
  const MotionComponent = motion[as] || motion.div;

  return (
    <MotionComponent
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{
        duration,
        delay,
        ease: 'easeOut'
      }}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};

export default ScrollReveal;
