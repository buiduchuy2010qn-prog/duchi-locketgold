import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getWatchedCelebs,
  addWatch,
  removeWatch,
  updateWatchStatus,
  SLOT_STATUS,
} from './slotMonitorStorage';
import { FindFriendByUserName } from '@/services/LocketDioServices/FriendsServices';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export const SlotMonitorContext = createContext(null);

const CHANNEL_NAME = 'huy-locket-slot-monitor';
const HEARTBEAT_INTERVAL = 10000; // 10s
const LEADER_TIMEOUT = 15000; // 15s
const BASE_POLL_INTERVAL = 180000; // 3 phút
const COOLDOWN_PERIOD = 60000; // 60s cooldown khi visibilitychange

export const SlotMonitorProvider = ({ children }) => {
  const [watchedCelebs, setWatchedCelebs] = useState([]);
  const [isLeader, setIsLeader] = useState(false);
  
  const channelRef = useRef(null);
  const lastHeartbeatRef = useRef(Date.now());
  const heartbeatIntervalRef = useRef(null);
  const leaderTimeoutRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const lastPollTimeRef = useRef(0);
  
  const navigate = useNavigate();

  // Load initial data
  useEffect(() => {
    setWatchedCelebs(getWatchedCelebs());
  }, []);

  // Broadcast Channel & Leader Election
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      // Fallback cho trình duyệt không hỗ trợ (đơn giản hóa: tự làm leader, có thể spam API nếu mở nhiều tab, nhưng ít trình duyệt hiện đại nào không hỗ trợ)
      setIsLeader(true);
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const becomeLeader = () => {
      setIsLeader(true);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(() => {
        channel.postMessage({ type: 'I_AM_LEADER' });
      }, HEARTBEAT_INTERVAL);
    };

    const resetLeaderTimeout = () => {
      if (leaderTimeoutRef.current) clearTimeout(leaderTimeoutRef.current);
      leaderTimeoutRef.current = setTimeout(() => {
        becomeLeader();
      }, LEADER_TIMEOUT);
    };

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'WHO_IS_LEADER':
          if (isLeader) {
            channel.postMessage({ type: 'I_AM_LEADER' });
          }
          break;
        case 'I_AM_LEADER':
          setIsLeader(false);
          lastHeartbeatRef.current = Date.now();
          resetLeaderTimeout();
          break;
        case 'SYNC_STATE':
          setWatchedCelebs(getWatchedCelebs());
          break;
        case 'NOTIFY_SLOT':
          handleNotifySlot(payload.celeb, payload.availableSlots, false); // Không show browser notif từ tab phụ
          break;
        default:
          break;
      }
    };

    // Ask who is leader
    channel.postMessage({ type: 'WHO_IS_LEADER' });
    resetLeaderTimeout();

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (leaderTimeoutRef.current) clearTimeout(leaderTimeoutRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      channel.close();
    };
  }, [isLeader]);

  const notifyStateChange = useCallback(() => {
    setWatchedCelebs(getWatchedCelebs());
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'SYNC_STATE' });
    }
  }, []);

  const showBrowserNotification = (title, options, onClick) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        onClick?.();
        notification.close();
      };
    }
  };

  const handleNotifySlot = useCallback((celeb, availableSlots, isLeaderTab = false) => {
    const title = `🔥 Slot vừa mở!`;
    const body = `@${celeb.username} vừa mở ${availableSlots} slot. Vào kết bạn ngay!`;
    
    // Toast trên tất cả các tab
    toast.success(
      <div className="flex flex-col gap-1 cursor-pointer" onClick={() => navigate('/friends')}>
        <p className="font-bold text-md">🔥 @{celeb.username} vừa mở slot!</p>
        <p className="text-sm">Click để kết bạn ngay.</p>
      </div>, 
      { duration: 10000 }
    );

    // Chỉ Leader tab mới gửi Browser Notification để tránh bị double
    if (isLeaderTab && Notification.permission === 'granted') {
      showBrowserNotification(title, {
        body,
        icon: celeb.avatar || '/images/default_profile.png'
      }, () => {
        navigate('/friends');
      });
    }
  }, [navigate]);

  const pollCelebs = useCallback(async () => {
    if (!isLeader) return;
    
    const currentCelebs = getWatchedCelebs();
    const watchingCelebs = currentCelebs.filter(c => c.status === SLOT_STATUS.WATCHING);
    
    if (watchingCelebs.length === 0) return;

    lastPollTimeRef.current = Date.now();

    for (let i = 0; i < watchingCelebs.length; i += 2) {
      const batch = watchingCelebs.slice(i, i + 2);
      
      await Promise.all(batch.map(async (celeb) => {
        try {
          const res = await FindFriendByUserName(celeb.username);
          const data = res?.data;
          
          if (data && data.celebrity_data) {
            const friendCount = data.celebrity_data.friend_count || 0;
            const maxFriends = data.celebrity_data.max_friends || 0;
            
            updateWatchStatus(celeb.uid, {
              friendCount,
              maxFriends,
              lastCheckedAt: Date.now(),
              errorCount: 0
            });

            if (maxFriends > 0 && friendCount < maxFriends) {
              const availableSlots = maxFriends - friendCount;
              
              // Phát hiện mở slot
              updateWatchStatus(celeb.uid, {
                status: SLOT_STATUS.SLOT_OPEN,
                notifiedAt: Date.now()
              });

              handleNotifySlot(celeb, availableSlots, true);

              if (channelRef.current) {
                channelRef.current.postMessage({ 
                  type: 'NOTIFY_SLOT', 
                  payload: { celeb, availableSlots } 
                });
                channelRef.current.postMessage({ type: 'SYNC_STATE' });
              }
            }
          }
        } catch (error) {
          console.error(`[SlotMonitor] Error polling ${celeb.username}:`, error);
          const currentErrorCount = (celeb.errorCount || 0) + 1;
          updateWatchStatus(celeb.uid, {
            errorCount: currentErrorCount,
            status: currentErrorCount >= 3 ? SLOT_STATUS.ERROR : SLOT_STATUS.WATCHING
          });
        }
      }));

      // Delay between batches to avoid burst API
      if (i + 2 < watchingCelebs.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    setWatchedCelebs(getWatchedCelebs());
  }, [isLeader, handleNotifySlot]);

  // Scheduler
  useEffect(() => {
    if (!isLeader) return;

    const scheduleNextPoll = () => {
      const jitter = Math.floor(Math.random() * 30000) - 15000; // ±15s
      const nextInterval = BASE_POLL_INTERVAL + jitter;
      
      pollTimeoutRef.current = setTimeout(async () => {
        await pollCelebs();
        scheduleNextPoll();
      }, nextInterval);
    };

    scheduleNextPoll();

    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [isLeader, pollCelebs]);

  // Visibility Change / Fast Check
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLeader) {
        const timeSinceLastPoll = Date.now() - lastPollTimeRef.current;
        if (timeSinceLastPoll > COOLDOWN_PERIOD) {
          pollCelebs();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLeader, pollCelebs]);

  // API Methods
  const watchCeleb = useCallback((celeb) => {
    try {
      addWatch(celeb);
      notifyStateChange();
      
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [notifyStateChange]);

  const unwatchCeleb = useCallback((uid) => {
    removeWatch(uid);
    notifyStateChange();
  }, [notifyStateChange]);

  const pauseWatch = useCallback((uid) => {
    updateWatchStatus(uid, { status: SLOT_STATUS.PAUSED });
    notifyStateChange();
  }, [notifyStateChange]);

  const resumeWatch = useCallback((uid) => {
    updateWatchStatus(uid, { status: SLOT_STATUS.WATCHING });
    notifyStateChange();
  }, [notifyStateChange]);

  const checkNow = useCallback(async (uid) => {
    // Implement check specific celeb now
    const celeb = watchedCelebs.find(c => c.uid === uid);
    if (!celeb) return;
    
    updateWatchStatus(uid, { status: SLOT_STATUS.CHECKING });
    notifyStateChange();

    try {
      const res = await FindFriendByUserName(celeb.username);
      const data = res?.data;
      if (data && data.celebrity_data) {
        const friendCount = data.celebrity_data.friend_count || 0;
        const maxFriends = data.celebrity_data.max_friends || 0;
        
        let newStatus = SLOT_STATUS.WATCHING;
        if (maxFriends > 0 && friendCount < maxFriends) {
          newStatus = SLOT_STATUS.SLOT_OPEN;
        }

        updateWatchStatus(uid, {
          friendCount,
          maxFriends,
          lastCheckedAt: Date.now(),
          status: newStatus,
          errorCount: 0
        });

        if (newStatus === SLOT_STATUS.SLOT_OPEN) {
           handleNotifySlot(celeb, maxFriends - friendCount, isLeader);
           if (channelRef.current) {
             channelRef.current.postMessage({ type: 'SYNC_STATE' });
           }
        }
      }
    } catch (error) {
      updateWatchStatus(uid, { status: SLOT_STATUS.ERROR });
    }
    notifyStateChange();
  }, [watchedCelebs, notifyStateChange, handleNotifySlot, isLeader]);

  const isWatching = useCallback((uid) => {
    return watchedCelebs.some(c => c.uid === uid);
  }, [watchedCelebs]);

  const value = {
    watchedCelebs,
    watchCeleb,
    unwatchCeleb,
    pauseWatch,
    resumeWatch,
    checkNow,
    isWatching,
    isLeader
  };

  return (
    <SlotMonitorContext.Provider value={value}>
      {children}
    </SlotMonitorContext.Provider>
  );
};
