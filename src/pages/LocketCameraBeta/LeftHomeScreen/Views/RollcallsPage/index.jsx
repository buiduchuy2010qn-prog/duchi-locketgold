import React, { useState, useEffect, useCallback, useRef } from "react";
import { getRollcallPosts } from "@/services";
import RollcallCard from "./RollcallCard";
import { saveRollcalls, getRollcallsByWeek } from "@/cache/rollcallDb";
import { getISOWeek, getWeekRange } from "@/utils";
import WeekNavigator from "./WeekNavigator";
import {
  logRollcallNet,
  getListFetchKey,
  getInflightListFetch,
  setInflightListFetch,
} from "@/utils/rollcallMedia";

function RollcallsPost({ active, posts, setPosts, isProfileOpen }) {
  const { week: currentWeek, year: currentYear } = getISOWeek();

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [visibleCount, setVisibleCount] = useState(5);
  // Status: 'loading' | 'success' | 'empty' | 'error'
  const [status, setStatus] = useState("loading");
  
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // reset visible khi đổi tab
  useEffect(() => {
    if (active === "lockets") setVisibleCount(5);
  }, [active]);

  // reset visible khi đổi tuần
  useEffect(() => {
    setVisibleCount(2);
  }, [selectedWeek, selectedYear, isProfileOpen]);

  const fetchPosts = useCallback(async (isRetry = false) => {
    const week = selectedWeek;
    const year = selectedYear;
    const fetchKey = getListFetchKey(week, year);

    // Cancel previous week's in-flight work
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Only clear if not retrying to avoid blinking existing cache
    if (!isRetry) {
      try {
        const cached = await getRollcallsByWeek(week, year);
        if (controller.signal.aborted || !mountedRef.current) return;
        if (cached?.length) {
          setPosts(cached);
          setStatus("success");
          logRollcallNet({
            type: "getRollcallPosts",
            status: "cache",
            ms: 0,
            count: cached.length,
            week,
            year,
            fromCache: true,
          });
        } else {
          setPosts([]);
          setStatus("loading");
        }
      } catch {
        if (mountedRef.current && !controller.signal.aborted) {
          setPosts([]);
          setStatus("loading");
        }
      }
    } else {
      setStatus("loading");
    }

    // Network (dedupe concurrent same week)
    const existing = getInflightListFetch(fetchKey);
    const run = existing || setInflightListFetch(
      fetchKey,
      (async () => {
        const attemptFetch = async (retryCount = 0) => {
          const t0 = performance.now();
          try {
            const data = await getRollcallPosts({
              selectWeek: week,
              selectYear: year,
              signal: controller.signal,
            });
            const ms = Math.round(performance.now() - t0);
            
            if (!Array.isArray(data) || data.length === 0) {
              logRollcallNet({
                type: "getRollcallPosts",
                status: "empty",
                ms,
                count: 0,
                week,
                year,
                fromCache: false,
              });
              return [];
            }
            logRollcallNet({
              type: "getRollcallPosts",
              status: 200,
              ms,
              count: data.length,
              week,
              year,
              fromCache: false,
            });
            // Persist without blocking paint
            saveRollcalls(data, { week, year }).catch(() => {});
            return data;
          } catch (err) {
            // Re-throw if aborted
            if (controller.signal.aborted || err?.name === "CanceledError") {
              throw err;
            }
            
            // Retry logic
            const code = err?.response?.status;
            const isRetryable = !code || code === 429 || code >= 500;
            
            if (isRetryable && retryCount < 2) {
              const delay = retryCount === 0 ? 500 : 1500;
              await new Promise(r => setTimeout(r, delay));
              if (controller.signal.aborted) throw err;
              return attemptFetch(retryCount + 1);
            }
            
            logRollcallNet({
              type: "getRollcallPosts",
              status: "error",
              ms: Math.round(performance.now() - t0),
              week,
              year,
              fromCache: false,
            });
            throw err;
          }
        };
        
        return attemptFetch(0);
      })()
    );

    try {
      const list = await run;
      if (controller.signal.aborted || !mountedRef.current) return;
      
      if (week === selectedWeek && year === selectedYear) {
        if (list && list.length > 0) {
          setPosts(list);
          setStatus("success");
        } else {
          setPosts([]);
          setStatus("empty");
        }
      }
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return;
      console.error("Failed to load rollcall posts:", err);
      setPosts((currentPosts) => {
        if (currentPosts.length === 0) {
          setStatus("error");
        }
        return currentPosts;
      });
    }
  }, [selectedWeek, selectedYear, setPosts, posts.length]);

  // Fetch when week / year changes (and on mount)
  useEffect(() => {
    fetchPosts();
    return () => {
      abortRef.current?.abort();
    };
  }, [selectedWeek, selectedYear]); // only re-fetch on date change, rely on stale data

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setVisibleCount((prev) => Math.min(prev + 5, posts.length));
    }
  };

  return (
    <div
      className="h-full p-4 w-full flex flex-col gap-4 overflow-y-auto pb-24"
      onScroll={handleScroll}
    >
      {/* Week navigator */}
      <WeekNavigator
        week={selectedWeek}
        year={selectedYear}
        onChange={(w, y) => {
          setSelectedWeek(w);
          setSelectedYear(y);
        }}
      />

      <h2 className="text-xl font-bold">
        Rollcalls – {getWeekRange(selectedWeek, selectedYear)}
      </h2>

      {status === "loading" && !posts?.length && (
        <div className="flex flex-col items-center justify-center p-8 opacity-60">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-base-content mb-4"></div>
          <div>Đang tải...</div>
        </div>
      )}

      {status === "empty" && !posts?.length && (
        <div className="flex flex-col items-center justify-center p-8 opacity-60">
          <div>Không có Rollcalls nào trong tuần này.</div>
        </div>
      )}

      {status === "error" && !posts?.length && (
        <div className="flex flex-col items-center justify-center p-8 opacity-60 space-y-3">
          <div>Tải dữ liệu thất bại.</div>
          <button 
            onClick={() => fetchPosts(true)}
            className="btn btn-sm btn-outline"
          >
            Thử lại
          </button>
        </div>
      )}

      {posts
        .slice(0, visibleCount)
        .map((post) => (
          <RollcallCard key={post.uid} post={post} />
        ))}
    </div>
  );
}

export default RollcallsPost;
