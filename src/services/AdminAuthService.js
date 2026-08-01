import { CONFIG } from "@/config";

const TOKEN_KEY = "huyAdminIdToken";
const REFRESH_TOKEN_KEY = "huyAdminRefreshToken";
const EXPIRES_AT_KEY = "huyAdminExpiresAt";
const SESSION_EVENT = "huy-admin-session-change";
let refreshPromise = null;

function endpoint(path) {
  const baseUrl = String(CONFIG.api.baseUrl || "").replace(/\/$/, "");
  return `${baseUrl}/api/admin${path}`;
}

function notifySessionChange() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function saveSession(session, announce = true) {
  const expiresIn = Math.max(Number(session.expiresIn) || 0, 60);
  sessionStorage.setItem(TOKEN_KEY, session.idToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  sessionStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + expiresIn * 1000));
  if (announce) notifySessionChange();
}

export function clearAdminSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_AT_KEY);
  notifySessionChange();
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Admin request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function refreshAdminSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error("Admin session is unavailable");

      const response = await fetch(endpoint("/session/refresh"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const session = await parseResponse(response);
      saveSession(session, false);
      return session.idToken;
    })();
  }

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function getAdminToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(EXPIRES_AT_KEY) || 0);
  if (token && expiresAt - Date.now() > 60_000) return token;
  return refreshAdminSession();
}

export async function signInAdmin(email, password) {
  const response = await fetch(endpoint("/session/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await parseResponse(response);
  saveSession(session);

  try {
    return await verifyAdminSession();
  } catch (error) {
    clearAdminSession();
    throw error;
  }
}

export async function adminRequest(path, options = {}, allowRefresh = true) {
  const token = await getAdminToken();
  const response = await fetch(endpoint(path), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 && allowRefresh) {
    await refreshAdminSession();
    return adminRequest(path, options, false);
  }
  return parseResponse(response);
}

export async function verifyAdminSession() {
  try {
    const result = await adminRequest("/verify");
    return result.isAdmin === true;
  } catch (error) {
    if (error.status === 401 || error.status === 403) clearAdminSession();
    throw error;
  }
}

export function hasAdminSession() {
  return Boolean(sessionStorage.getItem(TOKEN_KEY));
}

export function subscribeAdminSession(listener) {
  window.addEventListener(SESSION_EVENT, listener);
  return () => window.removeEventListener(SESSION_EVENT, listener);
}
