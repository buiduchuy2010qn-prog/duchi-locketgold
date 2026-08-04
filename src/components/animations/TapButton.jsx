import React from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

/**
 * TapButton - Nút bấm có hiệu ứng lún và phát sáng nhẹ
 * 
 * Usage Example:
 * <TapButton 
 *   type="submit" 
 *   className="bg-blue-600 text-white px-4 py-2 rounded-lg"
 *   onClick={handleSubmit}
 * >
 *   Xác nhận
 * </TapButton>
 */
const TapButton = ({ children, className = '', ...props }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ 
        scale: 1.02,
        filter: "brightness(1.15)" // Hiệu ứng sáng nhẹ khi hover
      }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`focus:outline-none active:outline-none ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default TapButton;
