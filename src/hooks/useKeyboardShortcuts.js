import { useEffect } from 'react';
import { usePostStore, useSelectedStore } from '@/stores';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Bỏ qua nếu đang gõ phím trong ô input hoặc textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const { selectedFile, preview } = usePostStore.getState();
      const hasCaptured = !!(selectedFile || preview);
      const selectedMoment = useSelectedStore.getState().selectedMoment;
      const isViewingMoment = selectedMoment !== null;

      if (e.code === 'Space') {
        // Chỉ chụp khi không có modal nào đang mở và chưa chụp ảnh
        if (!hasCaptured && !isViewingMoment) {
          e.preventDefault();
          const btn = document.getElementById('camera-shutter-button');
          if (btn) {
            btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          }
        }
      } else if (e.code === 'Enter') {
        if (hasCaptured) {
          e.preventDefault();
          const btn = document.querySelector('[data-send-button="true"]');
          if (btn && !btn.disabled) {
            btn.click();
          }
        }
      } else if (e.code === 'Escape') {
        if (hasCaptured) {
          e.preventDefault();
          const btn = document.getElementById('camera-del-button');
          if (btn && !btn.disabled) {
            btn.click();
          }
        } else if (isViewingMoment) {
          e.preventDefault();
          useSelectedStore.getState().setSelectedMoment(null);
          useSelectedStore.getState().setSelectedMomentId(null);
        }
      } else if (e.code === 'ArrowLeft') {
        if (isViewingMoment) {
          e.preventDefault();
          // Vuốt sang trái (slide previous) vì ArrowLeft = Previous, nhưng swiper hiện tại là vertical.
          // Mình giả lập nhấn slide lên trên
          const swiperEl = document.querySelector('.swiper')?.swiper;
          if (swiperEl) {
            swiperEl.slidePrev();
          }
        }
      } else if (e.code === 'ArrowRight') {
        if (isViewingMoment) {
          e.preventDefault();
          const swiperEl = document.querySelector('.swiper')?.swiper;
          if (swiperEl) {
            swiperEl.slideNext();
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        const btn = document.getElementById('camera-shutter-button');
        if (btn) {
          btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}
