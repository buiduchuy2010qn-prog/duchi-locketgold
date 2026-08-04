import React, { createContext, useContext, useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';

// Tạo Context
const AnimationContext = createContext({
  isAnimationEnabled: true,
  toggleAnimation: () => {},
});

// Custom Hook để tái sử dụng nhanh
export const useAnimation = () => useContext(AnimationContext);

/**
 * AnimationProvider - Bọc ở cấp cao nhất (App.js hoặc index.js)
 */
export const AnimationProvider = ({ children }) => {
  // Lấy trạng thái từ localStorage, mặc định là true nếu chưa từng set
  const [isAnimationEnabled, setIsAnimationEnabled] = useState(() => {
    const saved = localStorage.getItem('global_animation_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Đồng bộ với localStorage mỗi khi state thay đổi
  useEffect(() => {
    localStorage.setItem('global_animation_enabled', JSON.stringify(isAnimationEnabled));
  }, [isAnimationEnabled]);

  const toggleAnimation = () => setIsAnimationEnabled(prev => !prev);

  return (
    <AnimationContext.Provider value={{ isAnimationEnabled, toggleAnimation }}>
      {/* 
        ĐÂY LÀ CHÌA KHÓA:
        - "user": Tôn trọng cài đặt hệ điều hành (Reduce Motion của Windows/MacOS). Nếu OS tắt, nó cũng tắt.
        - "always": Tắt TOÀN BỘ hiệu ứng Framer Motion ngay lập tức (Duration = 0).
      */}
      <MotionConfig reducedMotion={isAnimationEnabled ? "user" : "always"}>
        {children}
      </MotionConfig>
    </AnimationContext.Provider>
  );
};
