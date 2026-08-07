const STORAGE_KEY = 'huy_locket_slot_watch_v1';
const MAX_WATCH_LIMIT = 20;

export const SLOT_STATUS = {
  WATCHING: 'WATCHING',
  CHECKING: 'CHECKING',
  SLOT_OPEN: 'SLOT_OPEN',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
};

export const getWatchedCelebs = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to parse slot watch data', error);
    return [];
  }
};

export const saveWatchedCelebs = (celebs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(celebs));
  } catch (error) {
    console.error('Failed to save slot watch data', error);
  }
};

export const addWatch = (celeb) => {
  const celebs = getWatchedCelebs();
  
  if (celebs.length >= MAX_WATCH_LIMIT) {
    throw new Error(`Bạn chỉ có thể canh tối đa ${MAX_WATCH_LIMIT} tài khoản cùng lúc.`);
  }

  const existingIndex = celebs.findIndex((c) => c.uid === celeb.uid);
  if (existingIndex !== -1) {
    // Nếu đã tồn tại, reset lại trạng thái thành WATCHING
    celebs[existingIndex] = {
      ...celebs[existingIndex],
      status: SLOT_STATUS.WATCHING,
      friendCount: celeb.friendCount,
      maxFriends: celeb.maxFriends,
      avatar: celeb.avatar,
      displayName: celeb.displayName,
      username: celeb.username,
      errorCount: 0,
      createdAt: Date.now(),
    };
  } else {
    celebs.push({
      uid: celeb.uid,
      username: celeb.username,
      displayName: celeb.displayName,
      avatar: celeb.avatar,
      friendCount: celeb.friendCount,
      maxFriends: celeb.maxFriends,
      status: SLOT_STATUS.WATCHING,
      createdAt: Date.now(),
      lastCheckedAt: null,
      notifiedAt: null,
      errorCount: 0,
    });
  }
  
  saveWatchedCelebs(celebs);
  return celebs;
};

export const removeWatch = (uid) => {
  let celebs = getWatchedCelebs();
  celebs = celebs.filter((c) => c.uid !== uid);
  saveWatchedCelebs(celebs);
  return celebs;
};

export const updateWatchStatus = (uid, updates) => {
  const celebs = getWatchedCelebs();
  const index = celebs.findIndex((c) => c.uid === uid);
  
  if (index !== -1) {
    celebs[index] = { ...celebs[index], ...updates };
    saveWatchedCelebs(celebs);
  }
  
  return celebs;
};

export const clearAllWatch = () => {
  saveWatchedCelebs([]);
  return [];
};
