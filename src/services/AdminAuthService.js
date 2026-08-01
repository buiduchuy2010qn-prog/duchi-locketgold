import { CONFIG } from "@/config";

function endpoint(path) {
  const baseUrl = String(CONFIG.api.baseUrl || "").replace(/\/$/, "");
  return `${baseUrl}/api/admin${path}`;
}

function getLocketToken() {
  return localStorage.getItem("idToken") || sessionStorage.getItem("idToken") || "";
}

function getShortAdminSessionToken() {
  try {
    return sessionStorage.getItem("admin_short_session") || "";
  } catch {
    return "";
  }
}

export function setShortAdminSessionToken(token) {
  try {
    if (token) sessionStorage.setItem("admin_short_session", token);
    else sessionStorage.removeItem("admin_short_session");
  } catch {
    /* ignore */
  }
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

  const adminSessionToken = getShortAdminSessionToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  if (adminSessionToken) {
    headers["X-Admin-Session"] = adminSessionToken;
  }

  const response = await fetch(endpoint(path), {
    ...options,
    credentials: "include",
    cache: options.cache || "no-store",
    headers,
  });
  return parseResponse(response);
}

export async function verifyAdminSession() {
  const result = await adminRequest("/verify");
  return result.isAdmin === true && result.role !== "user";
}

export async function getAdminRoleInfo() {
  const result = await adminRequest("/verify");
  return {
    isAdmin: result.isAdmin === true && result.role !== "user",
    role: result.role || "user",
    uid: result.uid,
    email: result.email,
  };
}

export async function startShortAdminSession() {
  const result = await adminRequest("/session/create", { method: "POST" });
  if (result.adminSessionToken) {
    setShortAdminSessionToken(result.adminSessionToken);
  }
  return result;
}

export function hasAdminSession() {
  return Boolean(getLocketToken());
}
