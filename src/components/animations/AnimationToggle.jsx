import React from 'react';
import { useAnimation } from '../../context/AnimationContext';

/**
 * AnimationToggle - Nút gạt Bật/Tắt hiệu ứng toàn trang
 * 
 * Usage Example: Đặt trên thanh Header hoặc trang Settings
 * <AnimationToggle />
 */
const AnimationToggle = ({ className = '' }) => {
  const { isAnimationEnabled, toggleAnimation } = useAnimation();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isAnimationEnabled}
      onClick={toggleAnimation}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        isAnimationEnabled ? 'bg-blue-600' : 'bg-gray-300'
      } ${className}`}
    >
      <span className="sr-only">Bật tắt hiệu ứng chuyển động</span>
      
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
          isAnimationEnabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export default AnimationToggle;
