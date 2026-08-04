import React from 'react';
import { motion } from 'framer-motion';

/**
 * PageTransition - Bọc toàn bộ nội dung của trang
 * 
 * Usage Example:
 * <PageTransition as="main" className="p-4 bg-gray-50 min-h-screen">
 *   <h1>Trang chủ</h1>
 * </PageTransition>
 */
const PageTransition = ({ children, className = '', as = 'div', ...props }) => {
  // Lấy thẻ HTML tương ứng từ framer-motion, mặc định là motion.div
  const Component = motion[as] || motion.div;

  return (
    <Component
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }} // Dành cho AnimatePresence ở root (nếu có)
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
};

export default PageTransition;
