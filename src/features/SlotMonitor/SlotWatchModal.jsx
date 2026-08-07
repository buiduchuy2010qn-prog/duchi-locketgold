import React, { useEffect, useRef } from 'react';
import { useSlotMonitor } from './useSlotMonitor';
import { X, Play, Pause, Trash2, Bell, RefreshCw } from 'lucide-react';
import { SLOT_STATUS, clearAllWatch } from './slotMonitorStorage';
import { useNavigate } from 'react-router-dom';

export default function SlotWatchModal({ isOpen, onClose }) {
  const { watchedCelebs, unwatchCeleb, pauseWatch, resumeWatch, checkNow } = useSlotMonitor();
  const navigate = useNavigate();

  // Đóng modal khi nhấn Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getStatusText = (status) => {
    switch(status) {
      case SLOT_STATUS.WATCHING: return '🔔 Đang canh';
      case SLOT_STATUS.CHECKING: return '⏳ Đang kiểm tra...';
      case SLOT_STATUS.SLOT_OPEN: return '🔥 Đã mở slot';
      case SLOT_STATUS.PAUSED: return '⏸ Tạm dừng';
      case SLOT_STATUS.ERROR: return '❌ Lỗi kết nối';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case SLOT_STATUS.WATCHING: return 'text-blue-500';
      case SLOT_STATUS.CHECKING: return 'text-warning';
      case SLOT_STATUS.SLOT_OPEN: return 'text-error font-bold';
      case SLOT_STATUS.PAUSED: return 'text-base-content/50';
      case SLOT_STATUS.ERROR: return 'text-error';
      default: return 'text-base-content';
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Chưa kiểm tra';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds} giây trước`;
    const mins = Math.floor(seconds / 60);
    return `${mins} phút trước`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all duration-300">
      <div 
        className="bg-base-100 w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-base-200">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" /> 
            Danh sách canh slot
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-base-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {watchedCelebs.length === 0 ? (
            <div className="text-center py-10 text-base-content/50">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Bạn chưa canh slot tài khoản nào.</p>
              <p className="text-sm mt-1">Hãy tìm kiếm Celeb đã đầy bạn và bấm "Canh Slot".</p>
            </div>
          ) : (
            watchedCelebs.map((celeb) => (
              <div key={celeb.uid} className="flex items-center gap-3 p-3 bg-base-200/50 rounded-xl">
                <img 
                  src={celeb.avatar || '/images/default_profile.png'} 
                  alt={celeb.displayName}
                  className="w-12 h-12 rounded-full object-cover"
                />
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{celeb.displayName}</h3>
                  <p className="text-xs text-base-content/60 truncate">@{celeb.username}</p>
                  
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs ${getStatusColor(celeb.status)}`}>
                      {getStatusText(celeb.status)}
                    </span>
                    <span className="text-[10px] text-base-content/40">
                      {formatTimeAgo(celeb.lastCheckedAt)}
                    </span>
                  </div>
                  
                  <div className="text-[10px] font-mono mt-0.5 text-base-content/50">
                    {celeb.friendCount?.toLocaleString()} / {celeb.maxFriends?.toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-col gap-1 items-end ml-2">
                  {celeb.status === SLOT_STATUS.SLOT_OPEN ? (
                    <button 
                      onClick={() => {
                        onClose();
                        navigate('/friends');
                      }}
                      className="btn btn-sm btn-error text-white h-7 min-h-7 px-3 text-xs"
                    >
                      Kết bạn ngay
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => checkNow(celeb.uid)}
                        className="p-1.5 bg-base-300 hover:bg-base-300/80 rounded-md transition-colors"
                        title="Kiểm tra ngay"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${celeb.status === SLOT_STATUS.CHECKING ? 'animate-spin' : ''}`} />
                      </button>
                      
                      {celeb.status === SLOT_STATUS.PAUSED ? (
                        <button 
                          onClick={() => resumeWatch(celeb.uid)}
                          className="p-1.5 bg-base-300 hover:bg-base-300/80 rounded-md transition-colors text-success"
                          title="Tiếp tục canh"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => pauseWatch(celeb.uid)}
                          className="p-1.5 bg-base-300 hover:bg-base-300/80 rounded-md transition-colors text-warning"
                          title="Tạm dừng canh"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  
                  <button 
                    onClick={() => {
                      if (confirm(`Bạn muốn hủy canh slot ${celeb.displayName}?`)) {
                        unwatchCeleb(celeb.uid);
                      }
                    }}
                    className="p-1 mt-1 text-base-content/40 hover:text-error transition-colors"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {watchedCelebs.length > 0 && (
          <div className="p-3 border-t border-base-200 bg-base-200/30 flex justify-between items-center text-xs">
            <span className="text-base-content/60">{watchedCelebs.length} / 20 tài khoản</span>
            <button 
              onClick={() => {
                if (confirm('Bạn có chắc chắn muốn hủy tất cả không?')) {
                  clearAllWatch();
                  window.location.reload(); // Cách nhanh nhất để sync
                }
              }}
              className="text-error hover:underline font-medium"
            >
              Hủy tất cả
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
