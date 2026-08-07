// Chủ yếu dùng cho các yêu cầu API chính của Huy Locket
import { CONFIG } from "@/config";
import { getToken, saveToken } from "@/utils";
import axios from "axios";
import { instanceAuth } from "./instanceAuth";

const BASE_URL = CONFIG.api.baseUrl;

// meta tĩnh của app
const APP_META = {
  "x-app-author": CONFIG.app.author,
  "x-app-name": CONFIG.app.shortname,
  "x-app-client": CONFIG.app.clientVersion,
  "x-app-api": CONFIG.app.apiVersion,
  "x-app-env": CONFIG.app.env,
};

// Chỉ cho phép một lần refresh token chạy tại một thời điểm.
// Nếu nhiều request cùng nhận 401, tất cả sẽ chờ cùng promise rồi retry.
let refreshPromise = null;

async function refreshMainIdToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const current = getToken();
    if (!current.refreshToken) {
      const error = new Error("REFRESH_TOKEN_REQUIRED");
      error.code = "REFRESH_TOKEN_REQUIRED";
      throw error;
    }

    const response = await instanceAuth.post("locket/refresh-token", {
      refreshToken: current.refreshToken,
    });
    const data = response?.data?.data || {};
    const idToken = data.id_token || data.idToken;
    const localId = data.user_id || data.localId || current.localId;
    const refreshToken =
      data.refresh_token || data.refreshToken || current.refreshToken;

    if (!idToken) {
      const error = new Error("TOKEN_REFRESH_FAILED");
      error.code = "TOKEN_REFRESH_FAILED";
      throw error;
    }

    // saveToken tự giữ đúng localStorage/sessionStorage theo rememberMe hiện tại.
    saveToken({ idToken, localId, refreshToken });
    return idToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// Tạo axios instance
export const instanceMain = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": CONFIG.keys.apiKey,
    ...APP_META,
  },
});

// Luôn lấy token mới nhất trước mỗi request.
instanceMain.interceptors.request.use(
  (config) => {
    const { idToken } = getToken();
    if (idToken) {
      config.headers["Authorization"] = `Bearer ${idToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Các API dùng instanceMain (đặc biệt Canh Slot 24/7) trước đây chỉ gắn
// idToken cũ nên sau khi token Firebase hết hạn sẽ nhận 401 cho tới khi reload/login.
// Từ giờ gặp 401 sẽ dùng refreshToken, lưu token mới và tự retry request đúng 1 lần.
instanceMain.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (status !== 401 || !originalRequest || originalRequest._mainAuthRetry) {
      return Promise.reject(error);
    }

    originalRequest._mainAuthRetry = true;

    try {
      const newToken = await refreshMainIdToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return instanceMain(originalRequest);
    } catch (refreshError) {
      // Không xóa phiên ở đây: interceptor auth chung của app vẫn chịu trách nhiệm
      // đăng xuất nếu refresh token thực sự bị thu hồi/hết hiệu lực.
      refreshError.originalError = error;
      return Promise.reject(refreshError);
    }
  },
);
