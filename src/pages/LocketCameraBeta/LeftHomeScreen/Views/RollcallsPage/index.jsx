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

function getRollcallErrorMessage(error) {
  const status = error?.response?.status;

  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử tiếp.";
  }
  if (status === 403) {
    return "Locket từ chối yêu cầu Rollcalls của tài khoản này.";
  }
  if (status === 429) {
    return "Locket đang giới hạn yêu cầu. Chờ một lát rồi thử lại.";
  }
  if (status >= 500) {
    return "Máy chủ Rollcalls đang bận. Hãy thử lại sau ít phút.";
  }
  if (!error?.response) {
    return "Không kết nối được máy chủ Rollcalls. Hãy kiểm tra mạng rồi thử lại.";
  }

  return `Tải dữ liệu thất bại${status ? ` (mã ${status})` : ""}.`;
}

function RollcallsPost({ active, posts, setPosts, isProfileOpen }) {
  const { week: currentWeek, year: currentYear } = getISOWeek();

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [visibleCount, setVisibleCount] = useState(5);
  // Status: 'loading' | 'success' | 'empty' | 'error'
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  const hasAutoFellback = useRef(false);

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

  const fetchPosts = useCallback(
    async (isRetry = false) => {
      const week = selectedWeek;
      const year = selectedYear;
      const fetchKey = getListFetchKey(week, year);

      // Cancel previous week's in-flight work
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setErrorMessage("");

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
      const run =
        existing ||
        setInflightListFetch(
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
                if (
                  controller.signal.aborted ||
                  err?.name === "CanceledError" ||
                  err?.code === "ERR_CANCELED"
                ) {
                  throw err;
                }

                // Retry logic
                const code = err?.response?.status;
                const isRetryable = !code || code === 429 || code >= 500;

                if (isRetryable && retryCount < 2) {
                  const delay = retryCount === 0 ? 500 : 1500;
                  await new Promise((resolve) => setTimeout(resolve, delay));
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
          })(),
        );

      try {
        const list = await run;
        if (controller.signal.aborted || !mountedRef.current) return;

        if (week === selectedWeek && year === selectedYear) {
          if (list && list.length > 0) {
            setPosts(list);
            setStatus("success");
            setErrorMessage("");
          } else {
            // Chỉ tự lùi tuần khi API trả thành công nhưng tuần hiện tại thật sự rỗng.
            // Không lùi tuần khi lỗi mạng/401 vì sẽ làm người dùng hiểu nhầm.
            if (
              week === currentWeek &&
              year === currentYear &&
              !hasAutoFellback.current
            ) {
              hasAutoFellback.current = true;
              let prevWeek = week - 1;
              let prevYear = year;
              if (prevWeek < 1) {
                prevYear -= 1;
                prevWeek = getISOWeek(new Date(prevYear, 11, 28)).week;
              }
              setSelectedWeek(prevWeek);
              setSelectedYear(prevYear);
              return;
            }
            setPosts([]);
            setStatus("empty");
            setErrorMessage("");
          }
        }
      } catch (err) {
        if (controller.signal.aborted || !mountedRef.current) return;
        console.error("Failed to load rollcall posts:", err);

        // Giữ nguyên tuần đang chọn khi request lỗi.
        setPosts((currentPosts) => {
          if (currentPosts.length === 0) {
            setErrorMessage(getRollcallErrorMessage(err));
            setStatus("error");
          }
          return currentPosts;
        });
      }
    },
    [
      currentWeek,
      currentYear,
      selectedWeek,
      selectedYear,
      setPosts,
    ],
  );

  // Fetch when week / year changes (and on mount)
  useEffect(() => {
    fetchPosts();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchPosts]);

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
          setErrorMessage("");
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
        <div className="flex flex-col items-center justify-center p-8 opacity-60 space-y-3 text-center">
          <div>{errorMessage || "Tải dữ liệu thất bại."}</div>
          <button
            type="button"
            onClick={() => fetchPosts(true)}
            className="btn btn-sm btn-outline"
          >
            Thử lại
          </button>
        </div>
      )}

      {posts.slice(0, visibleCount).map((post) => (
        <RollcallCard key={post.uid} post={post} />
      ))}
    </div>
  );
}

export default RollcallsPost;
