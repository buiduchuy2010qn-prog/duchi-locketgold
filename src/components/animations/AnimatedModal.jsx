import React, { useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

/**
 * AnimatedModal - Bọc các Popup / Modal (2FA, Confirm)
 * 
 * Usage Example:
 * <AnimatePresence>
 *   {isOpen && (
 *     <AnimatedModal onClose={() => setIsOpen(false)}>
 *       <div className="bg-white p-6 rounded-xl shadow-lg">
 *         <h2>Xác nhận xóa</h2>
 *       </div>
 *     </AnimatedModal>
 *   )}
 * </AnimatePresence>
 */
const AnimatedModal = ({ children, onClose, className = '', zIndex = 50 }) => {
  // Khóa cuộn trang khi mở modal
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <motion.div
      className={`fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[${zIndex}]`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose} // Click ra ngoài nền đen để đóng
    >
      <motion.dialog
        open
        className={`relative z-10 m-0 bg-transparent p-0 ${className}`}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()} // Chặn click xuyên thấu làm đóng modal
      >
        {children}
      </motion.dialog>
    </motion.div>
  );
};

export default AnimatedModal;
