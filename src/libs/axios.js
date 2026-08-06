import { clearLocalData, getToken, removeToken, removeUser } from "../utils";
import { CONFIG } from "@/config";
import { parseJwt } from "@/utils/auth";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import { instanceAuth } from "./instanceAuth";
import { createUploadClient } from "./createBase";

let cachedExp = null;
function isTokenExpired(token) {
  if (!token) return true;

  const now = Math.floor(Date.now() / 1000);

  if (!cachedExp) {
    const payload = parseJwt(token);
    if (!payload) return true;
    cachedExp = payload.exp;
  }

  const timeLeft = cachedExp - now;
  return timeLeft < 300;
}

let isRefreshing = false;
let refreshPromise = null;

async function refreshIdToken() {
  try {
    const { refreshToken } = getToken();

    const res = await instanceAuth.post("locket/refresh-token", {
      refreshToken,
    });
    const newToken = res?.data?.data?.id_token;
    const newLocalId = res?.data?.data?.user_id;

    if (newToken) {
      localStorage.setItem("idToken", newToken);
      localStorage.setItem("localId", newLocalId);
      cachedExp = null;
      return newToken;
    }

    return null;
  } catch (err) {
    const status = err?.response?.status;

    if (status === 401) {
      handleLogout();
    } else if (status === 429) {
      SonnerInfo("Bạn đang thao tác quá nhanh. Vui lòng thử lại sau.");
    } else {
      SonnerInfo("Lỗi máy chủ. Vui lòng thử lại sau.");
    }

    console.error("Không thể refresh idToken:", err);
    return null;
  }
}

function handleLogout() {
  isRefreshing = false;
  refreshPromise = null;
  cachedExp = null;

  clearLocalData();
  removeUser();
  removeToken();
  localStorage.removeItem("idToken");
  localStorage.removeItem("localId");

  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

const api = createUploadClient(CONFIG.api.baseUrl);

api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem("idToken");

  if (!token) {
    return Promise.reject({
      status: 401,
      message: "Not authenticated",
    });
  }

  if (isTokenExpired(token)) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshIdToken();
    }

    token = await refreshPromise;

    isRefreshing = false;
    refreshPromise = null;

    if (!token) {
      handleLogout();
      return Promise.reject(new Error("Token refresh failed"));
    }
  }

  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status || error.status;
    const responseData = error.response?.data;
    const stringError =
      typeof responseData?.error === "string" ? responseData.error : null;
    const message =
      responseData?.message ||
      responseData?.error?.message ||
      stringError ||
      error.message ||
      "Có lỗi xảy ra";

    // Downstream upload queue reads response.data.message. Normalize APIs that
    // return { error: "..." } so they do not fall back to Axios' English text.
    if (
      responseData &&
      typeof responseData === "object" &&
      !Array.isArray(responseData) &&
      !responseData.message &&
      stringError
    ) {
      responseData.message = stringError;
    }

    const originalRequest = error.config;

    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (status === 401) {
      originalRequest._retry = true;

      if (
        !originalRequest.url?.includes("refresh-token") &&
        !isRefreshing &&
        !originalRequest.skipAuthRefresh
      ) {
        isRefreshing = true;
        refreshPromise = refreshIdToken();

        try {
          const newToken = await refreshPromise;
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }

          handleLogout();
          return Promise.reject(error);
        } catch (refreshError) {
          handleLogout();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      }

      handleLogout();
      SonnerInfo("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");
      return Promise.reject(error);
    }

    if (status === 403) {
      const errorCode = responseData?.error || responseData?.code;
      if (
        errorCode === "ACCOUNT_LOCKED" ||
        errorCode === "SESSION_REVOKED" ||
        String(message).toLowerCase().includes("locked")
      ) {
        SonnerInfo(
          "⛔ Tài khoản của bạn đã bị Quản Trị Viên khóa và cấm truy cập!",
        );
        handleLogout();
        return Promise.reject(error);
      }
      SonnerInfo(message || "Bạn không có quyền truy cập!");
    }

    if (status === 404 && !originalRequest?.skipErrorToast) {
      SonnerInfo(message || "Không tìm thấy nội dung yêu cầu.");
    }

    if (status === 429) {
      const retryAfterRaw = error.response?.headers?.["retry-after"];
      const retryAfterSeconds = Number.parseInt(retryAfterRaw, 10);
      error.noAutoRetry = true;
      error.retryAfterSeconds = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : 15 * 60;

      const waitText =
        error.retryAfterSeconds >= 60
          ? `${Math.ceil(error.retryAfterSeconds / 60)} phút`
          : `${error.retryAfterSeconds} giây`;

      SonnerInfo(
        message && !/^request failed with status code/i.test(message)
          ? `${message} Thử lại sau ${waitText}.`
          : `Bạn đã gửi quá nhiều yêu cầu. Thử lại sau ${waitText}.`,
      );
    }

    const isOptionalConfigMsg =
      typeof message === "string" &&
      (/supabase/i.test(message) ||
        /SUPABASE_/i.test(message) ||
        /chưa cấu hình/i.test(message));

    if (status === 500 && !isOptionalConfigMsg) {
      SonnerInfo(message || "Lỗi máy chủ. Vui lòng thử lại sau.");
    }

    if (status === 502 || status === 503) {
      SonnerInfo(
        "API đang khởi động (Render free). Đang thử lại — chờ thêm 20–40 giây.",
      );
    }

    if (status === 504) {
      SonnerInfo(
        message || "Hết thời gian phản hồi từ máy chủ. Vui lòng thử lại sau.",
      );
    }

    if (!error.response && originalRequest?._gatewayRetry >= 6) {
      SonnerInfo(
        "Không kết nối được API (có thể đang khởi động). Thử lại sau 20 giây.",
      );
    }

    return Promise.reject(error);
  },
);

export default api;
