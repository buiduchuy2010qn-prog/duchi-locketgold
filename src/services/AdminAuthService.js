import { CONFIG } from "@/config";

function endpoint(path) {
  const baseUrl = String(CONFIG.api.baseUrl || "").replace(/\/$/, "");
  return `${baseUrl}/api/admin${path}`;
}

function getLocketToken() {
  return localStorage.getItem("idToken") || sessionStorage.getItem("idToken") || "";
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Admin request failed");
    error.status = response.status;
    error.code = data.code || "ADMIN_REQUEST_FAILED";
    throw error;
  }
  return data;
}

export async function adminRequest(path, options = {}) {
  const token = getLocketToken();
  if (!token) {
    const error = new Error("Bạn cần đăng nhập Huy Locket");
    error.status = 401;
    throw error;
  }

  const response = await fetch(endpoint(path), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  return parseResponse(response);
}

export async function verifyAdminSession() {
  const result = await adminRequest("/verify");
  return result.isAdmin === true;
}

export function hasAdminSession() {
  return Boolean(getLocketToken());
}
