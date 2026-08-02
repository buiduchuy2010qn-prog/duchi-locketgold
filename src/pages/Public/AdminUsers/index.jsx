import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Clock,
  FileText,
  Info,
  Key,
  Lock,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Unlock,
  Users,
  ArrowLeft,
  CheckCircle,
  Zap,
  Volume2,
  ShieldAlert,
} from "lucide-react";
import { SonnerInfo, SonnerSuccess, SonnerWarning } from "@/components/uikit/SonnerToast";
import { updateAndSyncGpsLocation } from "@/services/UserActivityService";
import { CONFIG } from "@/config";
import {
  adminRequest,
  changeAdminPin,
  clearShortAdminSessionToken,
  getAdminRoleInfo,
  hasAdminSession,
  hasShortAdminSession,
  startShortAdminSession,
} from "@/services/AdminAuthService";

const UNKNOWN = "Không xác định";
const LIVE_REFRESH_INTERVAL_MS = 5_000;

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN");
}

function relativeActivity(value) {
  if (!value) return "Chưa ghi nhận hoạt động";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Vừa hoạt động";
  if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hoạt động ${hours} giờ trước`;
  return `Hoạt động ${Math.floor(hours / 24)} ngày trước`;
}

function getFixedNumericUid(uid) {
  if (!uid || uid === "—" || uid === "SYSTEM" || uid === "Không xác định") return uid;
  const cleanUid = String(uid).trim();
  if (/^\d+$/.test(cleanUid)) return `#${cleanUid}`;
  let hash = 0;
  const str = `_huy_locket_immutable_${cleanUid}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) >>> 0;
  }
  const numericId = 10000000 + (hash % 90000000);
  return `UID: #${numericId}`;
}

function sourceLabel(source) {
  if (source === "vercel") return "Vercel";
  if (source === "railway") return "Railway";
  if (source === "local") return "Local";
  return "Vercel / Railway";
}

function loginMethodLabel(method) {
  if (method === "session-resume") return "Khôi phục phiên";
  return method || UNKNOWN;
}

function userName(user) {
  return user.displayName || user.username || "Chưa có tên hồ sơ";
}

function roleBadge(role) {
  const r = (role || "user").toLowerCase();
  if (r === "super_admin") {
    return <span className="badge badge-primary font-black text-xs gap-1 shadow-md px-2.5 py-3 border-2 border-primary-content/30">👑 SUPER ADMIN</span>;
  }
  if (r === "admin") {
    return <span className="badge badge-secondary font-bold text-xs gap-1 shadow-sm px-2.5 py-3">🛡️ ADMIN</span>;
  }
  if (r === "moderator") {
    return <span className="badge badge-accent font-semibold text-xs gap-1 py-2.5 px-2">⚖️ MODERATOR</span>;
  }
  if (r === "support") {
    return <span className="badge badge-info text-xs gap-1 py-2.5 px-2">🎧 SUPPORT</span>;
  }
  return <span className="badge badge-ghost badge-xs font-mono">User</span>;
}

function errorMessage(error) {
  if (error?.code === "DATABASE_NOT_CONFIGURED") {
    return "Database theo dõi người dùng chưa được cấu hình trên Railway API.";
  }
  if (error?.status === 403 || error?.code === "ADMIN_PERMISSION_REQUIRED") {
    return "Tài khoản này không có quyền xem dữ liệu quản trị.";
  }
  if (error?.status === 401 || error?.code === "ADMIN_SESSION_EXPIRED") {
    return "Phiên làm việc nhạy cảm đã hết hạn hoặc cần xác minh Mã PIN số bảo mật.";
  }
  return `Không thể tải dữ liệu. ${error?.message || "Lỗi không xác định"}`;
}

function renderUserLocation(user, latestLogin) {
  const data = latestLogin || user;
  const gpsLoc = data?.gps_coordinates || user.gps_coordinates;
  const ipLoc = [data?.city || user.city, data?.region || user.region, data?.country || user.country]
    .filter((v) => v && v !== UNKNOWN && v !== "Unknown").join(", ") || UNKNOWN;

  if (gpsLoc) {
    return (
      <a
        href={`https://www.google.com/maps?q=${encodeURIComponent(gpsLoc)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-500 hover:text-emerald-400 font-extrabold inline-flex items-center gap-1.5 underline decoration-emerald-500/50 hover:decoration-emerald-400 text-xs"
        title="Tọa độ GPS chính xác (do người dùng đã bật định vị trên thiết bị)"
      >
        <span>📍 Đã bật GPS ({gpsLoc})</span>
      </a>
    );
  }
  return (
    <span className="text-amber-500 font-semibold inline-flex items-center gap-1.5 text-xs" title="Vị trí trạm nhà mạng gần đúng theo IP">
      <span>🌐 Vị trí IP (gần đúng): {ipLoc}</span>
    </span>
  );
}

function VirtualNumPad({ value, onChange, disabled, maxLength = 8 }) {
  const handlePress = (digit) => {
    if (disabled || value.length >= maxLength) return;
    onChange(value + digit);
  };
  const handleClear = () => {
    if (disabled || !value) return;
    onChange(value.slice(0, -1));
  };

  const buttons = [
    { label: "1", val: "1" }, { label: "2", val: "2" }, { label: "3", val: "3" },
    { label: "4", val: "4" }, { label: "5", val: "5" }, { label: "6", val: "6" },
    { label: "7", val: "7" }, { label: "8", val: "8" }, { label: "9", val: "9" },
    { label: "⌫", action: handleClear, bg: "btn-error btn-outline" }, { label: "0", val: "0" }, { label: "C", action: () => !disabled && onChange(""), bg: "btn-warning btn-outline" }
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mt-4 mb-2">
      {buttons.map((btn, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled || (!btn.action && value.length >= maxLength)}
          onClick={btn.action ? btn.action : () => handlePress(btn.val)}
          className={`btn ${btn.bg || "btn-base-200 hover:bg-primary hover:text-primary-content border border-base-300"} h-12 rounded-2xl font-black text-lg shadow-sm transition-all active:scale-95 flex items-center justify-center cursor-pointer`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentRole, setCurrentRole] = useState("user");
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentUserUid, setCurrentUserUid] = useState("");
  const [checkingAdmin, setCheckingAdmin] = useState(hasAdminSession());
  const [activeTab, setActiveTab] = useState("users"); // "users" | "audit" | "reports"

  // Cổng bảo mật Quản trị viên (PIN Gate) right on entering Admin Page
  const [hasPin, setHasPin] = useState(false);
  const [isGateUnlocked, setIsGateUnlocked] = useState(hasShortAdminSession());
  const [gatePassword, setGatePassword] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState(null);

  // Change PIN modal states
  const [changePinModalOpen, setChangePinModalOpen] = useState(false);
  const [changePinOld, setChangePinOld] = useState("");
  const [changePinNew, setChangePinNew] = useState("");
  const [changePinLoading, setChangePinLoading] = useState(false);
  const [changePinError, setChangePinError] = useState(null);

  // User tab states
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [pageToken, setPageToken] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineWindowSeconds, setOnlineWindowSeconds] = useState(150);
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyState, setHistoryState] = useState("idle");
  const [historyError, setHistoryError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [clearHistoryConfirm, setClearHistoryConfirm] = useState(false);
  const [purgingBots, setPurgingBots] = useState(false);
  const rootRefreshInFlight = useRef(false);

  // Audit Logs states
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditFilterAction, setAuditFilterAction] = useState("");
  const [auditFilterAdmin, setAuditFilterAdmin] = useState("");

  // Reports states
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);

  // Advanced Super Admin tools states
  const [advancedSubTab, setAdvancedSubTab] = useState("telemetry"); // "telemetry" | "broadcast" | "blacklist"
  const [serverHealth, setServerHealth] = useState(null);
  const [clientTelemetry, setClientTelemetry] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastActive, setBroadcastActive] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState("ALL");
  const [broadcastList, setBroadcastList] = useState([]);
  const [blacklistedIps, setBlacklistedIps] = useState([]);
  const [banIpInput, setBanIpInput] = useState("");
  const [banReasonInput, setBanReasonInput] = useState("");
  const [passwordStatusModal, setPasswordStatusModal] = useState(null);

  // API Heartbeat monitor states
  const [apiStatuses, setApiStatuses] = useState([]);
  const [testingApis, setTestingApis] = useState(false);
  const [refreshingTelemetry, setRefreshingTelemetry] = useState(false);

  const runApiHealthCheck = useCallback(async () => {
    setTestingApis(true);
    const apiDomain = String(CONFIG.api.baseUrl || "https://huy-locket-api-production.up.railway.app").replace(/\/$/, "");
    const targets = [
      {
        id: "music_lib",
        name: "🎵 Thư Viện Nhạc Locket (Music Tracks API)",
        desc: "Cung cấp bài hát gốc, tìm kiếm và phát audio mượt mà trên video Locket",
        url: `${apiDomain}/api/music/tracks`,
        method: "GET",
        isCors: false,
        errorHelp: "Lỗi 404/500: Máy chủ Railway chưa đồng bộ route âm nhạc hoặc CSDL Neon mất bảng music_tracks.",
        remedy: "Mở bảng điều khiển Railway (Tab Deployments) kiểm tra Log máy chủ và bấm 'Restart Service' để khởi động lại."
      },
      {
        id: "music_search",
        name: "🎧 Cầu Nối Spotify & Apple Music",
        desc: "Hệ thống truy xuất metadata và đồng bộ ISRC bản quyền từ Spotify/Apple",
        url: `${apiDomain}/api/searchMusic?q=locket&limit=1`,
        method: "GET",
        isCors: false,
        errorHelp: "Nghẽn Token: API Key Spotify/Apple bị hạn chế số lần gọi (Rate-limit) hoặc từ chối chứng chỉ.",
        remedy: "Hệ thống đã có cụm chuyển trạm dự phòng Apple Music. Nếu vẫn lỗi, vào trang Spotify Developer cấp lại cặp Client ID & Secret mới trong biến môi trường Railway."
      },
      {
        id: "weather_api",
        name: "🌦️ Trạm Dữ Liệu Thời Tiết (Open-Meteo API)",
        desc: "Cung cấp chỉ số nhiệt độ, độ ẩm và thời tiết thực tế cho nhãn dán Locket",
        url: "https://api.open-meteo.com/v1/forecast?latitude=13.77&longitude=109.22&current_weather=true",
        method: "GET",
        isCors: false,
        errorHelp: "Mất kết nối DNS quốc tế: Hạ tầng CDN của Open-Meteo hoặc cáp quang mạng đang gián đoạn.",
        remedy: "Open-Meteo là máy chủ công cộng miễn phí. Khi mất sóng ngầm, Locket tự giữ nhãn dán nhiệt độ gần nhất trong Cache, chỉ cần chờ nhà mạng khôi phục."
      },
      {
        id: "ip_radar",
        name: "📍 Cảm Biến Định Vị Radar IP (FreeIPAPI / IPInfo)",
        desc: "Dò tìm vị trí thực tế, tỉnh thành và bảo mật đường truyền người dùng Locket",
        url: "https://freeipapi.com/api/json/",
        method: "GET",
        isCors: true,
        errorHelp: "Bị phong tỏa đường truyền: Trình duyệt đang bật 'Trình chặn quảng cáo / Quyền riêng tư' (AdBlock / Brave / Edge Privacy / Tracking Protection) cản lệnh gọi IP.",
        remedy: "Bấm vào biểu tượng Khiên (Shield/Lock) bên trái thanh URL trình duyệt -> Tắt 'Chặn Theo Dõi (Tracking Protection)' hoặc tắt AdBlock cho trang duchi.vercel.app để Cảm biến Radar hoạt động bình thường."
      },
      {
        id: "media_proxy",
        name: "🖼️ Trạm Xử Lý Media & Đám Mây Google Drive",
        desc: "Nén video, chuyển đổi định dạng ảnh và truyền tải lưu trữ Drive tốc độ cao",
        url: "https://media-service.locket-dio.com/convertImage",
        method: "HEAD",
        isCors: true,
        errorHelp: "Lỗi proxy ảnh: Tên miền media-service tạm quá tải băng thông hoặc hạn chế chứng chỉ Cloudflare.",
        remedy: "Khởi động lại Cloudflare Worker gắn với máy chủ ảnh, kiểm tra dung lượng trống trên Google Drive Backup để tránh tràn bộ nhớ."
      },
      {
        id: "collab_api",
        name: "🤝 Trạm Dịch Vụ Ghép Ảnh (Collab Kanade API)",
        desc: "Hệ thống bổ trợ chế độ ghép đôi Collab và tạo khung hiệu ứng cực chất",
        url: "https://api.captionkanade.site",
        method: "HEAD",
        isCors: true,
        errorHelp: "Máy chủ cộng đồng bảo trì: Tên miền đối tác captionkanade.site tạm dừng máy chủ VPS.",
        remedy: "Đây là API bổ trợ độc lập. Nếu gián đoạn, người dùng vẫn có thể ghép khung Locket mặc định không bị gián đoạn app."
      },
      {
        id: "railway_core",
        name: "⚡ Máy Chủ Xử Lý Trung Tâm (Railway Engine)",
        desc: "Trực chiến 24/7 quản trị phiên làm việc, tường lửa WAF và kết nối SQL",
        url: `${apiDomain}/health`,
        method: "GET",
        isCors: false,
        errorHelp: "Ngừng tim (Offline/Error): Máy chủ Railway cạn kiệt CPU/RAM hoặc CSDL Neon ngắt kết nối do quá tải.",
        remedy: "Kiểm tra ngay Dashboard Railway/Neon. Bấm 'Trigger Redeploy' trên Railway để dựng lại container mới 100% trong 2 phút."
      }
    ];

    const results = [];
    for (const t of targets) {
      const startTime = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const fetchOpts = { method: t.method || "GET", signal: controller.signal };
        if (t.isCors) fetchOpts.mode = "no-cors";
        
        const res = await fetch(t.url, fetchOpts);
        clearTimeout(timeoutId);
        const duration = Math.round(performance.now() - startTime);
        const isLive = t.isCors ? true : (res.status < 500 && res.status !== 404);
        results.push({ ...t, status: isLive ? "ONLINE" : "ERROR", ping: duration, httpStatus: t.isCors ? "OK (CORS Guard)" : `HTTP ${res.status}` });
      } catch (err) {
        const duration = Math.round(performance.now() - startTime);
        results.push({ ...t, status: "OFFLINE", ping: duration, httpStatus: err.name === "AbortError" ? "Timeout (> 6000ms)" : "Mất kết nối / Blocked" });
      }
    }
    setApiStatuses(results);
    setTestingApis(false);
  }, []);

  const updateClientTelemetry = useCallback(async (pingMs) => {
    let connectionType = "WiFi / Băng thông rộng";
    let downlinkMbps = "Tối đa";
    if (navigator.connection) {
      const type = navigator.connection.type;
      const eff = navigator.connection.effectiveType;
      if (type && type !== "unknown" && type !== "other") {
        const mapType = { wifi: "WiFi Băng thông rộng", ethernet: "Cáp quang / LAN Ethernet", cellular: "Mạng Di Động (4G/5G)", wimax: "WiMAX" };
        connectionType = mapType[type] || type.toUpperCase();
      } else if (eff) {
        // W3C effectiveType '4g' means broadband speed (WiFi/LAN/Fiber > 5Mbps), not necessarily cellular data!
        if (eff === "4g") {
          connectionType = "WiFi / Cáp quang Băng thông rộng";
        } else {
          connectionType = `Tốc độ mạng di động / tín hiệu yếu (${eff.toUpperCase()})`;
        }
      }
      if (navigator.connection.downlink) downlinkMbps = `${navigator.connection.downlink} Mbps`;
      if (!pingMs && navigator.connection.rtt) pingMs = navigator.connection.rtt;
    }

    let storageBytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        storageBytes += ((key ? key.length : 0) + (localStorage.getItem(key)?.length || 0)) * 2;
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        storageBytes += ((key ? key.length : 0) + (sessionStorage.getItem(key)?.length || 0)) * 2;
      }
    } catch (e) {}

    let cachedItemsCount = 0;
    try {
      if ("caches" in window && caches.keys) {
        const keys = await caches.keys();
        for (const k of keys) {
          const c = await caches.open(k);
          const reqs = await c.keys();
          cachedItemsCount += reqs.length;
        }
      }
    } catch (e) {}

    let userAgentBrand = "Web Browser";
    if (navigator.userAgentData?.brands?.length) {
      // Filter out W3C Chromium anti-fingerprinting noise (e.g., "Not;A=Brand", "Chromium")
      const validBrands = navigator.userAgentData.brands.filter(
        (b) => !b.brand.includes("Not") && !b.brand.includes("Brand") && !b.brand.includes("Chromium")
      );
      if (validBrands.length > 0) {
        userAgentBrand = validBrands.map((b) => `${b.brand} v${b.version || ""}`).join(", ");
      } else {
        userAgentBrand = "Google Chrome / Chromium";
      }
    } else if (navigator.userAgent.includes("Edg")) {
      userAgentBrand = "Microsoft Edge";
    } else if (navigator.userAgent.includes("Chrome")) {
      userAgentBrand = "Google Chrome";
    } else if (navigator.userAgent.includes("Safari")) {
      userAgentBrand = "Apple Safari / iOS";
    } else if (navigator.userAgent.includes("Firefox")) {
      userAgentBrand = "Mozilla Firefox";
    }

    setClientTelemetry({
      pingVal: typeof pingMs === "number" ? pingMs : null,
      pingMs: typeof pingMs === "number" ? `${pingMs} ms` : "⚡ < 15 ms",
      connectionType,
      downlinkMbps,
      userAgentBrand,
      cpuThreads: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Lõi CPU` : "8 Lõi",
      deviceRAM: navigator.deviceMemory ? `${navigator.deviceMemory} GB RAM` : "Tối ưu hóa dung lượng",
      localStorageBytes: Math.max(1, Math.round(storageBytes / 1024)),
      cachedItemsCount,
      protocol: `${window.location.protocol.toUpperCase().replace(":", "")} (SSL/TLS 1.3 Active)`,
    });
  }, []);

  const fetchAdvancedData = useCallback(async (isUserAction = false) => {
    if (typeof isUserAction === "boolean" && isUserAction) setRefreshingTelemetry(true);
    try {
      const tStart = performance.now();
      const h = await adminRequest(`/server-health?_=${Date.now()}`);
      const tEnd = performance.now();
      if (h?.data) {
        setServerHealth(h.data);
        updateClientTelemetry(Math.round(tEnd - tStart));
      } else {
        updateClientTelemetry(null);
      }
      const b = await adminRequest(`/broadcast?_=${Date.now()}`);
      if (b?.data) {
        setBroadcastMsg("");
        setBroadcastActive(Boolean(b.data.active && b.data.message));
        setBroadcastTarget(b.data.targetUser || "ALL");
      }
      if (b?.list) setBroadcastList(b.list || []);
      const p = await adminRequest(`/ip-blacklist?_=${Date.now()}`);
      if (p?.list) setBlacklistedIps(p.list || []);
      if (typeof isUserAction === "boolean" && isUserAction) {
        SonnerSuccess("⚡ Đã cập nhật chỉ số cảm biến và nhịp tim máy chủ mới nhất!");
      }
    } catch (err) {
      console.warn("Failed fetching advanced tools data:", err);
      if (typeof isUserAction === "boolean" && isUserAction) {
        SonnerWarning("⚠️ Mất kết nối tới trạm Railway khi cập nhật cảm biến.");
      }
    } finally {
      if (typeof isUserAction === "boolean" && isUserAction) setRefreshingTelemetry(false);
    }
  }, [updateClientTelemetry]);

  // Modals state
  const [actionModal, setActionModal] = useState(null); // { type: 'lock'|'unlock'|'revoke'|'role', user, newRole, reason }
  const [reauthModalOpen, setReauthModalOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState(null);
  const [pendingCallback, setPendingCallback] = useState(null);

  const fetchUsers = useCallback(async (token = "", { silent = false, live = false } = {}) => {
    const isRootRefresh = !token;
    if (isRootRefresh && rootRefreshInFlight.current) return;
    if (isRootRefresh) rootRefreshInFlight.current = true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (token) query.set("pageToken", token);
      if (live) query.set("live", "1");
      const data = await adminRequest(`/users?${query.toString()}`);
      const nextUsers = data.users || [];
      setUsers((current) => {
        if (!token && !live) return nextUsers;
        if (!token && live) {
          const refreshed = new Set(nextUsers.map((entry) => entry.uid));
          return [...nextUsers, ...current.filter((entry) => !refreshed.has(entry.uid))];
        }
        const merged = new Map(current.map((entry) => [entry.uid, entry]));
        for (const entry of nextUsers) merged.set(entry.uid, entry);
        return Array.from(merged.values());
      });
      if (!token) {
        setSelectedUser((current) => {
          if (!current) return current;
          const updated = nextUsers.find((entry) => entry.uid === current.uid);
          return updated ? { ...current, ...updated } : current;
        });
      }
      setPageToken((current) => live && current ? current : data.pageToken || null);
      setTotalUsers(Number(data.totalUsers || 0));
      setOnlineWindowSeconds(data.onlineWindowSeconds || 150);
      setError(null);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.code === "ADMIN_SESSION_EXPIRED") {
        clearShortAdminSessionToken();
        setIsGateUnlocked(false);
      }
      if (!silent || requestError.status === 401 || requestError.status === 403) {
        setError({ code: requestError.code, message: errorMessage(requestError) });
      }
    } finally {
      if (isRootRefresh) rootRefreshInFlight.current = false;
      if (!silent) {
        setLoading(false);
        setCheckingAdmin(false);
      }
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (auditFilterAction) query.set("action", auditFilterAction);
      if (auditFilterAdmin) query.set("adminUid", auditFilterAdmin);
      const data = await adminRequest(`/audit-logs?${query.toString()}`);
      setAuditLogs(data.logs || []);
    } catch (err) {
      if (err?.code === "ADMIN_SESSION_EXPIRED" || err?.status === 401) {
        clearShortAdminSessionToken();
        setIsGateUnlocked(false);
      }
      setAuditError(errorMessage(err));
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilterAction, auditFilterAdmin]);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const data = await adminRequest("/content/reports?status=pending");
      setReports(data.reports || []);
    } catch (err) {
      if (err?.code === "ADMIN_SESSION_EXPIRED" || err?.status === 401) {
        clearShortAdminSessionToken();
        setIsGateUnlocked(false);
      }
      setReportsError(errorMessage(err));
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAdminSession()) {
      setCheckingAdmin(false);
      navigate("/login", { replace: true });
      return undefined;
    }

    let active = true;
    getAdminRoleInfo()
      .then((info) => {
        if (!active) return;
        setIsAdmin(info.isAdmin);
        setCurrentRole(info.role || "user");
        setCurrentUserUid(info.uid || "");
        setCurrentEmail(info.email || localStorage.getItem("email") || "");
        setHasPin(info.hasPin || false);

        // If already unlocked (valid session in last 30 mins), load users
        if (info.isAdmin && hasShortAdminSession()) {
          setIsGateUnlocked(true);
          fetchUsers();
        } else {
          setCheckingAdmin(false);
          setIsGateUnlocked(false);
        }
      })
      .catch((requestError) => {
        if (!active) return;
        setIsAdmin(false);
        setCheckingAdmin(false);
        SonnerInfo(errorMessage(requestError));
        navigate("/locket", { replace: true });
      });
    return () => {
      active = false;
    };
  }, [fetchUsers, navigate]);

  useEffect(() => {
    if (!isAdmin || !isGateUnlocked || activeTab !== "users") return undefined;
    const refreshLiveUsers = () => {
      if (document.hidden) return;
      fetchUsers("", { silent: true, live: true });
    };
    const timer = window.setInterval(refreshLiveUsers, LIVE_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshLiveUsers();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchUsers, isAdmin, isGateUnlocked, activeTab]);

  useEffect(() => {
    if (!isAdmin || !isGateUnlocked) return;
    if (activeTab === "audit" && (currentRole === "super_admin" || currentRole === "admin")) {
      fetchAuditLogs();
    }
    if (activeTab === "reports" && currentRole !== "support") {
      fetchReports();
    }
  }, [activeTab, isAdmin, isGateUnlocked, currentRole, fetchAuditLogs, fetchReports]);

  const { adminTeam, normalUsers } = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = !normalized ? users : users.filter((user) =>
      user.displayName?.toLowerCase().includes(normalized)
      || user.username?.toLowerCase().includes(normalized)
      || user.email?.toLowerCase().includes(normalized)
      || user.uid.toLowerCase().includes(normalized)
    );
    const admins = [];
    const regulars = [];
    for (const u of list) {
      if (u.role !== "user" || u.isAdmin || u.role === "super_admin") admins.push(u);
      else regulars.push(u);
    }
    return { adminTeam: admins, normalUsers: regulars };
  }, [search, users]);

  const isOnline = useCallback((user) => {
    if (!user.lastSeenAt || Number(user.activeSessions || 0) < 1) return false;
    return Date.now() - new Date(user.lastSeenAt).getTime() <= onlineWindowSeconds * 1000;
  }, [onlineWindowSeconds]);

  const openUser = async (user) => {
    setSelectedUser(user);
    setClearHistoryConfirm(false);
    setHistory([]);
    setHistoryError(null);
    setHistoryState("loading");
    try {
      const data = await adminRequest(`/users/${encodeURIComponent(user.uid)}/login-history?limit=100`);
      setHistory(data.history || []);
      setHistoryState((data.history || []).length ? "success" : "empty");
    } catch (requestError) {
      if (requestError?.code === "ADMIN_SESSION_EXPIRED" || requestError?.status === 401) {
        clearShortAdminSessionToken();
        setIsGateUnlocked(false);
        setSelectedUser(null);
      } else {
        setHistoryError(errorMessage(requestError));
        setHistoryState("error");
      }
    }
  };

  const handleGateSubmit = async (e) => {
    e.preventDefault();
    if (!gatePassword.trim() || !/^\d{4,8}$/.test(gatePassword.trim())) {
      setGateError("Vui lòng nhập mã PIN bảo mật (dãy số từ 4 đến 8 chữ số).");
      return;
    }
    setGateLoading(true);
    setGateError(null);
    try {
      await startShortAdminSession(gatePassword.trim());
      if (!hasPin) {
        SonnerInfo("🎉 Thiết lập Mã PIN số Quản Trị viên thành công! Cổng bảo mật đã mở.");
        setHasPin(true);
      } else {
        SonnerInfo("Xác minh mã PIN thành công! Cổng bảo mật Admin đã mở cho 30 phút tới.");
      }
      setIsGateUnlocked(true);
      fetchUsers();
      fetchAdvancedData();
    } catch (err) {
      setGateError(err.message || "Xác minh mã PIN thất bại. Vui lòng kiểm tra lại mã PIN.");
    } finally {
      setGatePassword("");
      setGateLoading(false);
    }
  };

  const handleActionWithSessionCheck = async (actionFn) => {
    try {
      await actionFn();
    } catch (err) {
      if (err?.code === "ADMIN_SESSION_EXPIRED" || err?.code === "FRESH_AUTH_REQUIRED" || err?.status === 401) {
        clearShortAdminSessionToken();
        setPendingCallback(() => actionFn);
        setReauthError("Phiên thao tác nhạy cảm đã hết hạn sau 30 phút. Vui lòng xác minh lại mã PIN bảo mật.");
        setReauthModalOpen(true);
      } else {
        SonnerInfo(`Lỗi thao tác: ${err.message || "Không xác định"}`);
      }
    }
  };

  const executeModalAction = async () => {
    if (!actionModal) return;
    const { type, user, newRole, reason } = actionModal;
    if (!reason?.trim() && type !== "unlock") {
      SonnerInfo("Vui lòng nhập đầy đủ lý do bắt buộc để tiếp tục");
      return;
    }

    setActionLoading(`${type}-${user.uid}`);
    const fn = async () => {
      if (type === "lock" || type === "unlock") {
        await adminRequest(`/users/${encodeURIComponent(user.uid)}/${type}`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        const nextDisabled = type === "lock";
        const update = (entry) => entry.uid === user.uid
          ? { ...entry, disabled: nextDisabled, accountStatus: nextDisabled ? "locked" : "active" }
          : entry;
        setUsers((current) => current.map(update));
        setSelectedUser((current) => current && current.uid === user.uid ? update(current) : current);
        SonnerInfo(nextDisabled ? "Đã khóa quyền truy cập Huy Locket" : "Đã mở khóa quyền truy cập");
      } else if (type === "revoke") {
        const res = await adminRequest(`/users/${encodeURIComponent(user.uid)}/revoke-sessions`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        SonnerInfo(`Đã thu hồi thành công ${res.revokedSessions || "toàn bộ"} phiên làm việc của user`);
        fetchUsers("", { silent: true });
      } else if (type === "role") {
        await adminRequest(`/users/${encodeURIComponent(user.uid)}/role`, {
          method: "POST",
          body: JSON.stringify({ role: newRole, reason: reason.trim() }),
        });
        SonnerInfo(`Đã gán thành công vai trò ${newRole.toUpperCase()} cho user`);
        const update = (entry) => entry.uid === user.uid
          ? { ...entry, role: newRole, isAdmin: newRole !== "user" }
          : entry;
        setUsers((current) => current.map(update));
        setSelectedUser((current) => current && current.uid === user.uid ? update(current) : current);
      } else if (type === "nuke") {
        await adminRequest(`/users/${encodeURIComponent(user.uid)}/nuke`, {
          method: "DELETE",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        SonnerInfo(`🔥 Đã Tiêu Hủy (Nuke) vĩnh viễn tài khoản của ${user.email || user.uid} khỏi hệ thống!`);
        setUsers((current) => current.filter((entry) => entry.uid !== user.uid));
        if (selectedUser?.uid === user.uid) setSelectedUser(null);
      }
      setActionModal(null);
    };

    try {
      await handleActionWithSessionCheck(fn);
    } finally {
      setActionLoading(null);
    }
  };


  const handleReauthSubmit = async (event) => {
    event.preventDefault();
    if (!reauthPassword.trim() || !/^\d{4,8}$/.test(reauthPassword.trim())) {
      setReauthError("Vui lòng nhập mã PIN số quản trị (4 - 8 chữ số)");
      return;
    }
    setReauthLoading(true);
    setReauthError(null);
    try {
      await startShortAdminSession(reauthPassword.trim());
      SonnerInfo("Xác minh lại mã PIN thành công. Phiên quản trị gia hạn 30 phút.");
      setReauthModalOpen(false);
      setIsGateUnlocked(true);
      if (pendingCallback) {
        await pendingCallback();
      }
    } catch (err) {
      setReauthError(err.message || "Xác minh mã PIN thất bại. Kiểm tra lại mã PIN của bạn.");
    } finally {
      setReauthPassword("");
      setReauthLoading(false);
      setPendingCallback(null);
    }
  };

  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    if (!changePinOld.trim() || !changePinNew.trim()) {
      setChangePinError("Vui lòng nhập đầy đủ mã PIN hiện tại và mã PIN mới.");
      return;
    }
    if (!/^\d{4,8}$/.test(changePinNew.trim())) {
      setChangePinError("Mã PIN mới phải là dãy số gồm từ 4 đến 8 chữ số.");
      return;
    }
    setChangePinLoading(true);
    setChangePinError(null);
    try {
      await changeAdminPin(changePinOld.trim(), changePinNew.trim());
      SonnerInfo("✨ Đổi mã PIN số Bảo Mật Quản Trị thành công!");
      setChangePinModalOpen(false);
      setChangePinOld("");
      setChangePinNew("");
    } catch (err) {
      setChangePinError(err.message || "Đổi mã PIN thất bại. Vui lòng kiểm tra lại mã PIN hiện tại.");
    } finally {
      setChangePinLoading(false);
    }
  };

  const handleResolveReport = async (id, actionTaken) => {
    const fn = async () => {
      await adminRequest(`/content/reports/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ actionTaken }),
      });
      SonnerInfo(`Đã xử lý vi phạm: ${actionTaken}`);
      fetchReports();
    };
    await handleActionWithSessionCheck(fn);
  };

  const handlePurgeBots = async () => {
    if (!window.confirm("⚡ Bạn có chắc muốn TIÊU DIỆT và KHÓA VĨNH VIỄN toàn bộ các tài khoản Bot rác, nick clone dùng tool hoặc máy chủ VPS bất thường không?")) {
      return;
    }
    const fn = async () => {
      setPurgingBots(true);
      try {
        const res = await adminRequest("/users/purge-bots", {
          method: "POST",
        });
        SonnerInfo(`🔥 Càn quét hoàn tất! Đã tiêu diệt và khóa vĩnh viễn ${res?.count || 0} tài khoản Bot rác & Clone bất thường.`);
        fetchUsers("", { silent: true });
      } finally {
        setPurgingBots(false);
      }
    };
    await handleActionWithSessionCheck(fn);
  };

  if (checkingAdmin || !isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  // CỔNG BẢO MẬT: YÊU CẦU XÁC MINH MẬT KHẨU KHI BƯỚC VÀO TRANG ADMIN
  if (!isGateUnlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 py-24 animate-fade-in bg-slate-950 relative overflow-hidden">
        {/* Ambient Cyber-Mesh Glows */}
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none translate-x-1/2 translate-y-1/2" />
        
        <div className="max-w-md w-full bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 border-2 border-cyan-500/40 hover:border-cyan-400/60 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_0_80px_-15px_rgba(6,182,212,0.3)] relative z-10 backdrop-blur-2xl transition-all duration-500">
          <div className="absolute top-0 right-0 transform translate-x-10 -translate-y-10 w-40 h-40 bg-cyan-500/15 rounded-full blur-2xl -z-0 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border-2 border-cyan-400/40 flex items-center justify-center text-cyan-300 mb-6 shadow-[0_0_30px_-5px_rgba(6,182,212,0.5)] group">
              <Lock className="w-12 h-12 animate-pulse text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-black tracking-widest uppercase mb-3 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>SECURITY GATE · AIR-LOCK v3.0</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-200 mb-2 flex items-center justify-center gap-2">
              Cổng Bảo Mật Quản Trị
            </h1>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed font-semibold">
              Chào Quản trị viên <strong className="text-white font-black">{currentEmail || "Huy Locket"}</strong> ({roleBadge(currentRole)}).
            </p>

            {!hasPin ? (
              <div className="text-xs text-cyan-200 bg-cyan-500/10 p-4 rounded-2xl border border-cyan-500/30 mb-6 leading-relaxed text-left shadow-inner flex items-start gap-3">
                <span className="text-xl shrink-0">✨</span>
                <div>
                  <strong className="text-white font-extrabold uppercase block mb-0.5">Thiết Lập Mã PIN Lần Đầu:</strong> 
                  Bạn chưa có Mã PIN số bảo mật riêng cho khu vực Quản Trị. Vui lòng nhập dãy số (4 - 8 chữ số) để làm Mã PIN mở khóa nhanh và an toàn. Về sau bạn có thể tự động thay đổi trong hệ thống!
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-900/90 p-4 rounded-2xl border border-white/10 text-left shadow-inner flex items-start gap-3">
                <span className="text-xl shrink-0">🛡️</span>
                <div>
                  <strong className="text-white font-extrabold uppercase block mb-0.5">Xác Minh Danh Tính:</strong>
                  Để bảo vệ quyền lực tối thượng và tài nguyên người dùng, bạn cần xác minh bằng <strong className="text-cyan-300">Mã PIN số bảo mật Quản trị</strong> riêng biệt. Phiên làm việc sẽ mở khóa an toàn trong <strong className="text-emerald-400">30 phút</strong>.
                </div>
              </div>
            )}

            {gateError && (
              <div className="alert bg-rose-500/20 border border-rose-500 text-rose-200 text-xs py-3 px-4 mb-6 rounded-2xl text-left shadow-lg flex items-center gap-2.5 animate-bounce">
                <AlertTriangle size={18} className="shrink-0 text-rose-400" />
                <span className="font-bold">{gateError}</span>
              </div>
            )}

            <form onSubmit={handleGateSubmit} className="w-full space-y-5">
              <div className="form-control w-full text-left">
                <label className="label text-[11px] font-black tracking-wider text-cyan-400 uppercase pb-2">
                  {hasPin ? "MÃ PIN SỐ BẢO MẬT QUẢN TRỊ" : "THIẾT LẬP MÃ PIN SỐ QUẢN TRỊ (4 - 8 SỐ)"}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    placeholder={hasPin ? "••••••••" : "Tạo mã PIN (ví dụ: 201068)..."}
                    className="input input-bordered w-full rounded-2xl pr-12 shadow-inner text-lg h-14 bg-slate-950 text-cyan-300 border-white/20 focus:border-cyan-400 font-mono font-extrabold tracking-[0.4em] text-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]"
                    value={gatePassword}
                    onChange={(e) => setGatePassword(e.target.value.replace(/[^0-9]/g, ""))}
                    disabled={gateLoading}
                    autoFocus
                  />
                  <Key className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400/60 w-5 h-5 pointer-events-none animate-pulse" />
                </div>
                <div className="mt-4">
                  <VirtualNumPad value={gatePassword} onChange={(val) => setGatePassword(val)} disabled={gateLoading} maxLength={8} />
                </div>
              </div>

              <button
                type="submit"
                className={`btn bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white w-full rounded-2xl font-black h-13 shadow-[0_0_25px_-5px_rgba(6,182,212,0.5)] text-sm gap-2 border-0 transition-all active:scale-95 ${gateLoading ? "loading" : ""}`}
                disabled={gateLoading || !gatePassword.trim()}
              >
                {!gateLoading && <CheckCircle size={18} className="text-cyan-200" />}
                {gateLoading ? "Đang giải mã thẻ xác minh..." : (hasPin ? "🚀 Mở Khóa Trung Tâm Quản Trị" : "✨ Xác Nhận & Tạo Mã PIN Bảo Mật")}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate("/locket", { replace: true })}
              className="btn btn-ghost btn-xs text-slate-400 gap-1.5 mt-6 rounded-xl hover:text-white hover:bg-white/5"
              disabled={gateLoading}
            >
              <ArrowLeft size={14} /> Quay lại màn hình chính Locket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 pt-24 max-w-7xl mx-auto animate-fade-in pb-20 selection:bg-cyan-500 selection:text-black">
      {/* SUPREME COMMAND CENTER HERO HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/90 text-white rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 mb-8 relative overflow-hidden backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none -mt-20 -mr-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -mb-20 -ml-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-wider shadow-inner">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
              </span>
              <span>SUPREME INFRASTRUCTURE & USER COMMAND CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black flex items-center gap-3 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-200">
              <span className="p-2 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg text-2xl sm:text-3xl shrink-0 flex items-center justify-center">
                🛡️
              </span>
              <span>Trạm Quản Trị Hệ Thống Huy Locket</span>
            </h1>
            <p className="text-sm text-slate-300 font-medium flex flex-wrap items-center gap-2 pt-1">
              <span>Quyền lực của bạn:</span> {roleBadge(currentRole)} 
              <span className="text-slate-600 font-bold">•</span>
              <span className="inline-flex items-center gap-1 font-mono text-emerald-400 font-black bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                👥 {totalUsers} tài khoản được rà soát Live
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setChangePinOld("");
                setChangePinNew("");
                setChangePinError(null);
                setChangePinModalOpen(true);
              }}
              className="btn btn-sm sm:btn-md bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 font-bold rounded-2xl h-11 px-4 shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              title="Tự động thay đổi mã PIN Bảo Mật số cho Quản trị viên"
            >
              <Key size={16} className="text-cyan-400" /> 
              <span>Đổi Mã PIN Quản Trị</span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearShortAdminSessionToken();
                setIsGateUnlocked(false);
                SonnerInfo("Đã khóa trang Quản Trị. Vui lòng nhập mã PIN bảo mật khi truy cập lại.");
              }}
              className="btn btn-sm sm:btn-md bg-gradient-to-r from-rose-600 via-red-600 to-amber-700 hover:from-rose-500 hover:to-amber-600 text-white font-extrabold border-0 rounded-2xl h-11 px-5 shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              title="Khóa ngay phiên làm việc admin hiện tại"
            >
              <Lock size={16} /> 
              <span>Khóa Trạm Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* TABS HEADER - SLEEK QUANTUM SWITCH DOCK */}
      <div className="flex flex-wrap items-center gap-2 mb-8 bg-slate-950/95 p-2 sm:p-2.5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-sm transition-all duration-300 cursor-pointer ${
            activeTab === "users" 
              ? "bg-gradient-to-r from-cyan-600 via-indigo-600 to-blue-600 text-white shadow-[0_0_25px_-5px_rgba(56,189,248,0.5)] scale-[1.02] border border-cyan-400/40" 
              : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <Users size={18} className={activeTab === "users" ? "text-cyan-300 animate-pulse" : "text-slate-500"} /> 
          <span>Người dùng & Phân quyền ({totalUsers})</span>
        </button>

        {(currentRole === "super_admin" || currentRole === "admin") && (
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-sm transition-all duration-300 cursor-pointer ${
              activeTab === "audit" 
                ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-[0_0_25px_-5px_rgba(168,85,247,0.5)] scale-[1.02] border border-purple-400/40" 
                : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <FileText size={18} className={activeTab === "audit" ? "text-purple-300 animate-pulse" : "text-slate-500"} /> 
            <span>Nhật ký Quản trị (Audit Log)</span>
          </button>
        )}

        {currentRole !== "support" && (
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-sm transition-all duration-300 cursor-pointer ${
              activeTab === "reports" 
                ? "bg-gradient-to-r from-rose-600 via-amber-600 to-orange-600 text-white shadow-[0_0_25px_-5px_rgba(244,63,94,0.5)] scale-[1.02] border border-rose-400/40" 
                : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <Shield size={18} className={activeTab === "reports" ? "text-amber-300 animate-pulse" : "text-slate-500"} /> 
            <span>Quản lý Nội dung vi phạm</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => { setActiveTab("advanced"); fetchAdvancedData(); }}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-sm transition-all duration-300 cursor-pointer ${
            activeTab === "advanced" 
              ? "bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 text-white shadow-[0_0_25px_-5px_rgba(245,158,11,0.6)] scale-[1.02] border border-amber-300/60" 
              : "bg-gradient-to-r from-amber-500/15 to-red-500/15 text-amber-300 hover:text-white hover:border-amber-400/50 border border-amber-500/20"
          }`}
        >
          <Zap size={18} className="text-yellow-300 animate-bounce fill-yellow-300" /> 
          <span>🚀 Quyền Lực Tối Thượng</span>
        </button>
      </div>

      {/* TAB 1: USERS AND RBAC */}
      {activeTab === "users" && (
        <div className="space-y-10 animate-fade-in">
          {/* RADAR SURVEILLANCE BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-4 sm:p-5 rounded-3xl border border-white/10 shadow-xl backdrop-blur-xl">
            <div className="flex items-start gap-3.5 max-w-3xl text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner mt-0.5">
                <Info size={20} className="animate-pulse" />
              </div>
              <div>
                <strong className="text-cyan-300 font-extrabold uppercase tracking-wide text-xs block mb-0.5">Radar Trinh Sát Vị Trí (GPS & IP):</strong>
                Vị trí hiển thị kết hợp giữa <strong className="text-white">Vị trí IP máy chủ</strong> và <strong className="text-emerald-400">Tọa độ GPS thực tế</strong> của thiết bị (hệ thống tự động xin quyền truy cập vị trí khi người dùng vào web, nếu được cho phép sẽ ghi lại tọa độ chính xác từng mét).
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
              <div className="relative flex-1 md:w-72">
                <input 
                  type="text" 
                  placeholder="Tìm kiếm email, tên, UID..." 
                  className="input w-full pl-10 rounded-2xl h-11 text-sm bg-slate-950 text-white placeholder:text-slate-500 border border-white/15 focus:border-cyan-400 font-medium shadow-inner" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              <button
                type="button"
                onClick={() => {
                  fetchUsers();
                  SonnerSuccess("🔄 Đã tải lại dữ liệu!", "Bảng quản trị đã cập nhật tọa độ GPS và thông tin IP mới nhất.");
                }}
                disabled={loading}
                className="btn bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 font-black rounded-2xl px-5 h-11 border-0 shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)] transition-all flex items-center gap-2 shrink-0 active:scale-95 text-xs sm:text-sm cursor-pointer"
                title="Làm mới toàn bộ danh sách và tọa độ thực tế mà không cần reload trang"
              >
                {loading ? <span className="loading loading-spinner loading-xs" /> : <><span>🔄 Làm mới</span></>}
              </button>
            </div>
          </div>

          {/* SECTION A: BAN QUẢN TRỊ HUY LOCKET */}
          <div>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-3 tracking-tight text-white">
                <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center text-xl shadow-inner">
                  👑
                </span>
                <span>Ban Quản trị Huy Locket</span>
                <span className="badge bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-xs px-3 py-3 rounded-xl shadow-md border-0">
                  {adminTeam.length} Admin
                </span>
              </h2>
              <span className="text-xs font-bold text-slate-400 hidden sm:block">QUYỀN ĐIỀU HÀNH BẢO MẬT</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminTeam.map((admin) => {
                const latestLogin = admin.latestLoginData || admin;
                const locationElement = renderUserLocation(admin, latestLogin);
                const isSuperAdmin = admin.role === "super_admin" || admin.email?.toLowerCase() === "buiduchuy2010qn@gmail.com";
                const isSelf = admin.uid === currentUserUid;

                return (
                  <div
                    key={admin.uid}
                    className="bg-gradient-to-b from-slate-900/95 via-slate-950 to-indigo-950/90 border-2 border-indigo-500/40 hover:border-cyan-400/80 rounded-[2.2rem] p-6 shadow-[0_15px_40px_-15px_rgba(99,102,241,0.25)] hover:shadow-[0_20px_50px_-10px_rgba(6,182,212,0.35)] transition-all duration-300 relative overflow-hidden flex flex-col justify-between group"
                  >
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-36 h-36 bg-gradient-to-bl from-cyan-500/15 via-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

                    <div>
                      <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-500 p-0.5 shadow-[0_0_20px_rgba(245,158,11,0.3)] shrink-0">
                            <div className="w-full h-full bg-slate-950 rounded-[0.9rem] flex items-center justify-center font-black text-2xl">
                              {isSuperAdmin ? "👑" : "🛡️"}
                            </div>
                          </div>
                          <div className="overflow-hidden">
                            <div className="font-black text-base sm:text-lg text-white flex items-center gap-2 flex-wrap truncate">
                              <span>{userName(admin)}</span>
                              <div className="scale-90 origin-left">{roleBadge(admin.role)}</div>
                            </div>
                            <div className="text-xs font-mono font-semibold text-slate-400 mt-1 truncate" title={admin.email || admin.username || admin.uid}>
                              {admin.email || admin.username || admin.uid}
                            </div>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          className="btn btn-sm bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 rounded-xl px-2.5 h-9 shrink-0 transition-colors" 
                          onClick={() => openUser(admin)} 
                          title="Xem chi tiết & lịch sử đăng nhập thực"
                        >
                          <Info size={18} />
                        </button>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/10 space-y-3 relative z-10 text-xs font-semibold text-slate-300">
                        <div className="flex items-center justify-between bg-slate-950/80 px-3.5 py-2.5 rounded-xl border border-white/5">
                          <span className="text-slate-400">Trạng thái kết nối:</span>
                          {isOnline(admin) ? (
                            <span className="text-emerald-400 font-black flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              <span>Đang hoạt động ({admin.activeSessions} phiên)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">{relativeActivity(admin.lastSeenAt)}</span>
                          )}
                        </div>

                        <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-white/10 shadow-inner space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-cyan-300 font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                              <span>📍</span>
                              <span>Vị trí (GPS & IP):</span>
                            </span>
                            {isSelf && !admin.gps_coordinates && !latestLogin?.gps_coordinates && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const gps = await updateAndSyncGpsLocation(true);
                                    if (gps) {
                                      SonnerSuccess("🎉 Đã lấy tọa độ GPS thực tế!", `Tọa độ thiết bị: ${gps}. Đang đồng bộ về Bảng Quản trị...`);
                                      setTimeout(() => window.location.reload(), 1500);
                                    } else {
                                      SonnerWarning("Chưa cấp quyền GPS", "Hãy bấm biểu tượng bên trái thanh địa chỉ URL (quyền trang web) -> chọn Vị trí (Location) -> Cho phép, rồi quay lại bấm nút này!");
                                    }
                                  } catch (err) {
                                    SonnerWarning("Lỗi định vị", "Vui lòng bật quyền vị trí trên trình duyệt Chrome.");
                                  }
                                }}
                                className="btn btn-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black px-3 h-7 text-[11px] rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.5)] border-0 animate-pulse shrink-0 cursor-pointer"
                                title="Bấm để lấy tọa độ GPS chính xác từ thiết bị, thay thế cho vị trí IP của cổng trạm nhà mạng"
                              >
                                📍 Lấy GPS thật
                              </button>
                            )}
                          </div>
                          <div className="font-bold text-white bg-white/[0.04] py-2 px-3 rounded-xl border border-white/5 flex items-center justify-between w-full shadow-inner text-xs leading-relaxed">
                            {locationElement}
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-slate-950/80 px-3.5 py-2.5 rounded-xl border border-white/5 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans">Nguồn / Thiết bị:</span>
                          <span className="text-indigo-300 font-black truncate max-w-[180px]">
                            {sourceLabel(admin.webSource)} · {latestLogin?.browser || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Administrative buttons or Immutable Shield inside Admin card */}
                    <div className="mt-6 pt-4 flex items-center justify-end gap-2 border-t border-white/10 relative z-10">
                      {isSuperAdmin ? (
                        <div className="w-full bg-gradient-to-r from-amber-500/15 via-indigo-500/20 to-purple-500/15 border border-amber-500/40 text-amber-300 font-black text-[11px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-inner uppercase tracking-wider">
                          <Lock size={14} className="text-amber-400 shrink-0" />
                          <span>Quyền Tối Thượng Cố Định (Immutable)</span>
                        </div>
                      ) : isSelf ? (
                        <div className="w-full bg-purple-500/15 border border-purple-500/40 text-purple-300 font-extrabold text-[11px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-inner uppercase tracking-wider">
                          <span>👤 Tài khoản chính bạn (Protected)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full justify-end">
                          {currentRole === "super_admin" && (
                            <button
                              type="button"
                              onClick={() => setActionModal({ type: "role", user: admin, newRole: admin.role || "user", reason: "" })}
                              className="btn btn-xs bg-purple-500/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 font-black rounded-xl px-3.5 h-8 transition-all"
                            >
                              Đổi vai trò
                            </button>
                          )}
                          {currentRole !== "support" && currentRole !== "moderator" && (
                            <button
                              type="button"
                              onClick={() => setActionModal({ type: "revoke", user: admin, reason: "" })}
                              className="btn btn-xs bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-black rounded-xl px-3.5 h-8 transition-all"
                            >
                              Thu hồi phiên
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION B: NGƯỜI DÙNG LOCKET WEB */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xl font-bold shadow-inner">
                  👥
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight text-white">
                    <span>Người dùng Locket Web</span>
                    <span className="badge bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black text-xs px-3 py-3 rounded-xl shadow-sm">
                      {normalUsers.length} Tài Khoản
                    </span>
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    fetchUsers();
                    SonnerSuccess("🔄 Đã tải lại!", "Danh sách người dùng và tọa độ đã được cập nhật.");
                  }}
                  disabled={loading}
                  className="btn btn-sm bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 rounded-xl font-bold px-4 h-10 text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                  title="Tải lại ngay danh sách người dùng Locket Web"
                >
                  {loading ? <span className="loading loading-spinner loading-xs" /> : <span>🔄 Làm mới</span>}
                </button>
                <button
                  type="button"
                  onClick={handlePurgeBots}
                  disabled={purgingBots}
                  className="btn btn-sm bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black border-0 rounded-xl px-5 h-10 shadow-[0_0_20px_-5px_rgba(244,63,94,0.6)] transition-all flex items-center gap-2 cursor-pointer active:scale-95 text-xs sm:text-sm"
                >
                  {purgingBots ? (
                    <>
                      <span className="loading loading-spinner loading-xs text-white" />
                      <span>Đang càn quét...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="animate-bounce text-yellow-300 fill-yellow-300" />
                      <span>⚡ Càn Quét Bot Rác</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CYBER OBSERVABILITY TABLE */}
            <div className="bg-slate-950/95 rounded-[2.2rem] shadow-2xl border border-slate-800/80 overflow-hidden backdrop-blur-2xl">
              <div className="overflow-x-auto">
                <table className="table w-full text-sm font-medium">
                  <thead>
                    <tr className="bg-slate-900/90 text-cyan-300 font-extrabold text-xs uppercase tracking-wider border-b border-white/10">
                      <th className="py-4 pl-6">Người dùng & Vai trò</th>
                      <th>Đăng nhập gần nhất</th>
                      <th>IP / Vị trí (GPS & IP)</th>
                      <th>Trình duyệt / Thiết bị</th>
                      <th>Trạng thái web</th>
                      <th>Hoạt động gần nhất</th>
                      <th>Nguồn web</th>
                      <th className="text-right pr-6">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {loading && users.length === 0 ? (
                      <tr><td colSpan="8" className="text-center py-20"><span className="loading loading-bars loading-lg text-cyan-400" /></td></tr>
                    ) : error ? (
                      <tr><td colSpan="8" className="text-center py-16"><AlertTriangle size={36} className="mx-auto text-rose-400 mb-2 animate-bounce" /><p className="text-rose-300 font-bold">{error.message}</p><button type="button" onClick={() => fetchUsers()} className="btn btn-sm btn-outline mt-4 rounded-xl font-bold"><RefreshCw size={14} /> Thử lại ngay</button></td></tr>
                    ) : normalUsers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-20 text-slate-500">
                          <div className="max-w-md mx-auto space-y-3 py-6">
                            <div className="text-5xl">📭</div>
                            <p className="text-lg font-black text-white">Chưa ghi nhận người dùng Locket Web nào</p>
                            <p className="text-xs text-slate-400 leading-relaxed font-semibold">Hệ thống Giám sát Real-time đang rình gác. Ngay khi có người dùng đăng nhập, hồ sơ thật và lịch sử tọa độ sẽ xuất hiện tức thời tại đây.</p>
                          </div>
                        </td>
                      </tr>
                    ) : normalUsers.map((user) => {
                      const latestLogin = user.latestLoginData || user;
                      const locationElement = renderUserLocation(user, latestLogin);
                      const isSuperAdmin = user.role === "super_admin" || user.email?.toLowerCase() === "buiduchuy2010qn@gmail.com";
                      const isSelf = user.uid === currentUserUid;

                      return (
                        <tr key={user.uid} className="hover:bg-white/[0.04] transition-colors group">
                          <td className="py-4 pl-6">
                            <div className="font-black text-sm flex items-center gap-2 text-white">
                              <span>{userName(user)}</span>
                              <div className="scale-90 origin-left">{roleBadge(user.role)}</div>
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2 flex-wrap">
                              <span>{user.email || user.uid}</span>
                              <span className="px-2 py-0.5 rounded-md bg-white/5 text-cyan-300 font-bold text-[10px] font-mono border border-white/10 shadow-sm" title={`Raw UID: ${user.uid}`}>
                                {getFixedNumericUid(user.uid)}
                              </span>
                            </div>
                          </td>
                          <td className="min-w-36">
                            {latestLogin ? (
                              <div className="space-y-1">
                                <div className="text-xs font-bold text-slate-200">{formatDateTime(latestLogin.created_at)}</div>
                                <span className="inline-block px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-[11px] font-mono font-bold border border-purple-500/20">
                                  {loginMethodLabel(latestLogin.login_method || user.loginMethod || user.provider)}
                                </span>
                              </div>
                            ) : <span className="text-xs text-slate-500 italic">Chưa ghi nhận</span>}
                          </td>
                          <td className="min-w-48">
                            <div className="font-mono font-extrabold text-xs text-cyan-300 flex items-center gap-1.5">
                              <span>🌐</span>
                              <span>{latestLogin?.ip_address || UNKNOWN}</span>
                            </div>
                            <div className="mt-1.5 text-xs text-slate-300 font-medium">{locationElement}</div>
                          </td>
                          <td className="min-w-48">
                            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                              <Monitor size={14} className="text-emerald-400 shrink-0" /> 
                              <span>{latestLogin?.browser || UNKNOWN} {latestLogin?.browser_version !== UNKNOWN ? latestLogin?.browser_version : ""}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-semibold">{latestLogin ? `${latestLogin.os || UNKNOWN} · ${latestLogin.device || UNKNOWN}` : UNKNOWN}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Build: {latestLogin?.commit_hash || latestLogin?.build_id || "—"}</div>
                          </td>
                          <td>
                            {user.disabled ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black shadow-sm">
                                <Lock size={13} /> Đã khóa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black shadow-sm">
                                <Unlock size={13} /> Hoạt động
                              </span>
                            )}
                          </td>
                          <td>
                            {isOnline(user) ? (
                              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black shadow-sm animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                <span>Online ({user.activeSessions} phiên)</span>
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-slate-400">
                                {user.lastLogoutAt && new Date(user.lastLogoutAt) >= new Date(user.lastSeenAt || 0) ? "⚪ Đã đăng xuất" : relativeActivity(user.lastSeenAt)}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="px-2.5 py-1 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-bold font-mono shadow-sm">
                              {sourceLabel(latestLogin?.web_source || user.webSource)}
                            </span>
                          </td>
                          <td className="text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              {isSuperAdmin ? (
                                <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase select-none">
                                  🔒 Cố định
                                </span>
                              ) : isSelf ? (
                                <span className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold select-none">
                                  👤 Chính bạn
                                </span>
                              ) : (
                                <>
                                  {currentRole !== "support" && currentRole !== "moderator" && (
                                    <>
                                      <button
                                        type="button"
                                        className={`btn btn-xs rounded-xl font-extrabold h-8 px-3 transition-all ${user.disabled ? "bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40" : "bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40"}`}
                                        onClick={() => setActionModal({ type: user.disabled ? "unlock" : "lock", user, reason: "" })}
                                        title={user.disabled ? "Mở khóa web" : "Khóa truy cập web"}
                                      >
                                        {user.disabled ? <Unlock size={14} /> : <Lock size={14} />}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-xs bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl font-extrabold h-8 px-3 transition-all"
                                        onClick={() => setActionModal({ type: "revoke", user, reason: "" })}
                                        title="Thu hồi toàn bộ phiên làm việc web"
                                      >
                                        Thu hồi
                                      </button>
                                    </>
                                  )}
                                  {currentRole === "super_admin" && (
                                    <button
                                      type="button"
                                      className="btn btn-xs bg-indigo-500/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl font-black h-8 px-3 transition-all"
                                      onClick={() => setActionModal({ type: "role", user, newRole: user.role || "user", reason: "" })}
                                      title="Gán quyền RBAC"
                                    >
                                      RBAC
                                    </button>
                                  )}
                                </>
                              )}
                              <button 
                                type="button" 
                                className="btn btn-sm bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 rounded-xl px-2.5 h-8 transition-colors" 
                                onClick={() => openUser(user)} 
                                title="Xem trọn bộ lịch sử đăng nhập thực"
                              >
                                <Info size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {!loading && !error && (
              <p className="mt-4 text-xs text-slate-400 text-center font-bold font-mono">
                ⚡ Đang hiển thị <strong className="text-cyan-300">{users.length}/{totalUsers}</strong> người dùng Locket Web
              </p>
            )}

            {!loading && !error && pageToken && !search.trim() && (
              <div className="mt-6 flex justify-center">
                <button type="button" className="btn bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 rounded-2xl px-8 h-12 font-black shadow-lg" onClick={() => fetchUsers(pageToken)}>
                  🔄 Tải thêm danh sách
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="bg-slate-950 text-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-800/80 p-6 sm:p-9 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -mt-32 -mr-32" />
          
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-black mb-2 shadow-inner">
                <span>📜 IMMUTABLE SECURITY TRACKER</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-purple-200 flex items-center gap-2.5">
                Nhật Ký Quản Trị Huy Locket (Audit Log)
              </h2>
              <p className="text-sm text-slate-400 font-medium mt-1">
                Lưu vết toàn bộ thao tác nhạy cảm của các quản trị viên theo chuẩn Append-Only. Dữ liệu vĩnh viễn không thể tẩy xóa bởi admin thường.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
              <input
                type="text"
                placeholder="Lọc lệnh (LOCK, REVOKE...)"
                className="input input-bordered text-xs rounded-2xl h-11 bg-slate-900 text-white border-white/15 focus:border-purple-400 font-bold px-4"
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
              />
              <input
                type="text"
                placeholder="Lọc theo UID admin..."
                className="input input-bordered text-xs rounded-2xl h-11 bg-slate-900 text-white border-white/15 focus:border-purple-400 font-bold px-4"
                value={auditFilterAdmin}
                onChange={(e) => setAuditFilterAdmin(e.target.value)}
              />
              <button type="button" onClick={fetchAuditLogs} className="btn bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/40 rounded-2xl h-11 px-4 font-extrabold flex items-center gap-2" title="Tải lại log">
                <RefreshCw size={17} className={auditLoading ? "animate-spin" : ""} />
                <span>Làm Mới</span>
              </button>
            </div>
          </div>

          <div className="relative z-10">
            {auditLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
                <span className="loading loading-bars loading-lg text-purple-400" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang truy xuất Sổ Lưu Vết từ hạ tầng Neon Postgres...</p>
              </div>
            ) : auditError ? (
              <div className="alert bg-rose-500/20 border border-rose-500 text-rose-200 text-sm rounded-2xl p-4 font-bold"><AlertTriangle size={20} /> <span>{auditError}</span></div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <div className="text-5xl mb-4">📭</div>
                <p className="font-black text-lg text-white">Chưa có bản ghi Audit Log nào phù hợp</p>
                <p className="text-xs mt-1 text-slate-400 font-semibold">Các thao tác khóa tài khoản, thu hồi phiên hay đổi quyền RBAC sẽ xuất hiện tự động tại đây.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/10 rounded-2xl bg-slate-900/60 shadow-inner max-h-[600px] overflow-y-auto">
                <table className="table table-sm w-full text-sm font-medium">
                  <thead className="bg-slate-900 font-extrabold text-purple-300 text-xs uppercase tracking-wider sticky top-0 z-10 border-b border-white/10">
                    <tr>
                      <th className="py-3.5 pl-5">Thời gian server</th>
                      <th>Quản trị viên</th>
                      <th>Hành động</th>
                      <th>UID đối tượng</th>
                      <th>Lý do & Chi tiết</th>
                      <th className="pr-5">IP / Nguồn thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.04] transition-colors">
                        <td className="whitespace-nowrap font-mono text-xs font-bold text-slate-300 pl-5 py-3.5">{formatDateTime(log.created_at)}</td>
                        <td>
                          <div className="font-mono text-xs font-black text-cyan-300" title={`Raw Admin UID: ${log.admin_uid}`}>{getFixedNumericUid(log.admin_uid)}</div>
                          <div className="mt-1 scale-90 origin-left">{roleBadge(log.role)}</div>
                        </td>
                        <td>
                          <span className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono font-black text-xs shadow-sm">
                            {log.action}
                          </span>
                        </td>
                        <td className="font-mono text-xs font-bold text-amber-300" title={`Raw Target UID: ${log.target_uid || "—"}`}>
                          {log.target_uid && log.target_uid !== "—" ? getFixedNumericUid(log.target_uid) : "—"}
                        </td>
                        <td className="text-xs font-semibold text-slate-300 max-w-md break-words">{log.details || "—"}</td>
                        <td className="text-xs pr-5">
                          <div className="font-mono font-extrabold text-white">{log.ip_address || UNKNOWN}</div>
                          <div className="text-[11px] font-bold text-slate-400 mt-0.5">{sourceLabel(log.web_source)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REPORTED CONTENT */}
      {activeTab === "reports" && (
        <div className="bg-slate-950 text-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-800/80 p-6 sm:p-9 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none -mt-32 -mr-32" />

          <div className="relative z-10 flex items-center justify-between mb-8 pb-6 border-b border-white/10 flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-black mb-2 shadow-inner">
                <span>🛡️ CONTENT MODERATION SHIELD</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-100 to-rose-200 flex items-center gap-2.5">
                Quản Lý Nội Dung Bị Báo Cáo
              </h2>
              <p className="text-sm text-slate-400 font-medium mt-1">
                Trạm xử lý vi phạm tiêu chuẩn cộng đồng dành riêng cho Quản trị viên và Moderator của Huy Locket.
              </p>
            </div>
            <button type="button" onClick={fetchReports} className="btn bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-2xl h-11 px-5 font-black flex items-center gap-2" title="Tải lại">
              <RefreshCw size={17} className={reportsLoading ? "animate-spin" : ""} />
              <span>Tải Lại Báo Cáo</span>
            </button>
          </div>

          <div className="relative z-10">
            {reportsLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4"><span className="loading loading-spinner loading-lg text-amber-400" /></div>
            ) : reportsError ? (
              <div className="alert bg-rose-500/20 border border-rose-500 text-rose-200 text-sm rounded-2xl p-4 font-bold"><AlertTriangle size={20} /> <span>{reportsError}</span></div>
            ) : reports.length === 0 ? (
              <div className="text-center py-20 text-slate-500 bg-slate-900/40 rounded-3xl border border-white/5">
                <div className="text-6xl mb-4 animate-bounce">🎉</div>
                <p className="font-black text-xl text-white">Không Có Nội Dung Vi Phạm Nào!</p>
                <p className="text-sm text-slate-400 mt-1 font-semibold">Môi trường giao tiếp trên Locket đang cực kỳ an toàn và sạch sẽ.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/10 rounded-2xl bg-slate-900/60 shadow-inner">
                <table className="table w-full text-sm font-medium">
                  <thead className="bg-slate-900 font-extrabold text-amber-300 text-xs uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="py-3.5 pl-5">ID Bài / Nội dung</th>
                      <th>Người báo cáo</th>
                      <th>Tác giả</th>
                      <th>Lý do vi phạm</th>
                      <th>Trạng thái</th>
                      <th className="text-right pr-5">Xử lý vi phạm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-white/[0.04] transition-colors">
                        <td className="font-mono text-xs font-black text-cyan-300 pl-5 py-3.5">{report.content_id}</td>
                        <td className="font-mono text-xs font-bold text-slate-300">{report.reporter_uid || "Ẩn danh"}</td>
                        <td className="font-mono text-xs font-bold text-slate-300">{report.author_uid || "—"}</td>
                        <td className="text-xs font-black text-rose-400">{report.reason || "Vi phạm tiêu chuẩn"}</td>
                        <td><span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black shadow-sm">Đang chờ xử lý</span></td>
                        <td className="text-right space-x-2 pr-5">
                          <button type="button" onClick={() => handleResolveReport(report.id, "hidden")} className="btn btn-xs bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-extrabold rounded-xl h-8 px-3 transition-all">Ẩn bài</button>
                          <button type="button" onClick={() => handleResolveReport(report.id, "deleted")} className="btn btn-xs bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-extrabold rounded-xl h-8 px-3 transition-all">Xóa mềm</button>
                          <button type="button" onClick={() => handleResolveReport(report.id, "dismissed")} className="btn btn-xs bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl h-8 px-3 transition-all">Bỏ qua</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ADVANCED SUPER ADMIN POWER SUITE */}
      {activeTab === "advanced" && (
        <div className="space-y-7 animate-fade-in">
          {/* SUB-NAVIGATOR FOR SUPREME POWER SUITE - OBSIDIAN CYBER DOCK */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-slate-950/95 p-3.5 sm:p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => setAdvancedSubTab("telemetry")}
              className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-300 cursor-pointer text-left shadow-lg border relative overflow-hidden ${
                advancedSubTab === "telemetry"
                  ? "bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-700 text-white border-cyan-400/60 shadow-[0_0_25px_-5px_rgba(56,189,248,0.4)] scale-[1.01]"
                  : "bg-slate-900/80 text-slate-300 border-white/5 hover:border-cyan-500/40 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 ${advancedSubTab === "telemetry" ? "bg-white/20 text-cyan-200 shadow-md scale-105" : "bg-cyan-500/15 text-cyan-400"}`}>
                <Activity size={24} className={advancedSubTab === "telemetry" ? "animate-pulse" : ""} />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300/80 mb-0.5 flex items-center gap-1">
                  <span>HẠ TẦNG CLOUD</span>
                  {advancedSubTab === "telemetry" && <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />}
                </div>
                <div className="text-sm font-black truncate text-white">Cảm Biến Telemetry</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAdvancedSubTab("broadcast")}
              className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-300 cursor-pointer text-left shadow-lg border relative overflow-hidden ${
                advancedSubTab === "broadcast"
                  ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-blue-400/60 shadow-[0_0_25px_-5px_rgba(59,130,246,0.4)] scale-[1.01]"
                  : "bg-slate-900/80 text-slate-300 border-white/5 hover:border-blue-500/40 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 ${advancedSubTab === "broadcast" ? "bg-white/20 text-yellow-200 shadow-md scale-105" : "bg-blue-500/15 text-blue-400"}`}>
                <Volume2 size={24} className={advancedSubTab === "broadcast" ? "animate-bounce" : ""} />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-300/80 mb-0.5 flex items-center gap-1">
                  <span>TRUYỀN THÔNG BÁO</span>
                  {advancedSubTab === "broadcast" && <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-ping" />}
                </div>
                <div className="text-sm font-black truncate text-white">Phát Loa Broadcast</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAdvancedSubTab("blacklist")}
              className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-300 cursor-pointer text-left shadow-lg border relative overflow-hidden ${
                advancedSubTab === "blacklist"
                  ? "bg-gradient-to-r from-rose-600 via-red-600 to-amber-700 text-white border-rose-400/60 shadow-[0_0_25px_-5px_rgba(244,63,94,0.4)] scale-[1.01]"
                  : "bg-slate-900/80 text-slate-300 border-white/5 hover:border-rose-500/40 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 ${advancedSubTab === "blacklist" ? "bg-white/20 text-yellow-200 shadow-md scale-105" : "bg-rose-500/15 text-rose-400"}`}>
                <ShieldAlert size={24} className={advancedSubTab === "blacklist" ? "animate-pulse" : ""} />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-rose-300/80 mb-0.5 flex items-center gap-1">
                  <span>TƯỜNG LỬA WAF</span>
                  {advancedSubTab === "blacklist" && <span className="w-1.5 h-1.5 rounded-full bg-rose-300 animate-ping" />}
                </div>
                <div className="text-sm font-black truncate text-white">Cấm Cửa IP Vĩnh Viễn</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdvancedSubTab("heartbeat");
                if (apiStatuses.length === 0) runApiHealthCheck();
              }}
              className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-300 cursor-pointer text-left shadow-lg border relative overflow-hidden ${
                advancedSubTab === "heartbeat"
                  ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white border-emerald-400/60 shadow-[0_0_25px_-5px_rgba(16,185,129,0.4)] scale-[1.01]"
                  : "bg-slate-900/80 text-slate-300 border-white/5 hover:border-emerald-500/40 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 ${advancedSubTab === "heartbeat" ? "bg-white/20 text-emerald-200 shadow-md scale-105" : "bg-emerald-500/15 text-emerald-400"}`}>
                <Zap size={24} className={advancedSubTab === "heartbeat" ? "animate-bounce" : ""} />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300/80 mb-0.5 flex items-center gap-1">
                  <span>RADAR NHỊP SỐNG</span>
                  {advancedSubTab === "heartbeat" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />}
                </div>
                <div className="text-sm font-black truncate text-white">Giám Sát Sóng API</div>
              </div>
            </button>
          </div>

          {/* Section 1: Dual-Cloud Health Dashboard: Vercel & Railway */}
          {advancedSubTab === "telemetry" && (
            <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-800/80 relative overflow-hidden animate-fade-in">
              {/* Decorative Ambient Mesh Lighting */}
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none -mt-32 -mr-32" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -mb-32 -ml-32" />

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 pb-6 border-b border-white/10">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-black mb-2 shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>DUAL-CLOUD SHIELD V3.0 · OBSERVABILITY ENGINE</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 flex items-center gap-2.5">
                    Cảm Biến Giám Sát Hạ Tầng Vercel & Railway
                  </h2>
                  <p className="text-sm text-slate-400 font-medium mt-1 max-w-3xl leading-relaxed">
                    Hệ thống đo tải tài nguyên thực tế 100% không qua bộ đệm ảo: Phân chia chính xác giữa Giao diện Edge (Vercel CDN), Máy chủ Backend (Railway Node Engine) & Cơ sở dữ liệu (Neon PostgreSQL).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchAdvancedData(true)}
                  disabled={refreshingTelemetry}
                  className="btn btn-md bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold border-0 shadow-[0_0_25px_-5px_rgba(56,189,248,0.4)] transition-all duration-300 shrink-0 rounded-2xl px-6 h-12 active:scale-95 cursor-pointer"
                >
                  {refreshingTelemetry ? (
                    <>
                      <span className="loading loading-spinner loading-sm text-cyan-200" />
                      <span>Đang đo sóng Railway...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} className="text-cyan-300" />
                      <span>🔄 Làm mới Cảm biến Real-Time</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Vercel Frontend Edge Shield & Client Telemetry */}
                <div className="bg-slate-900/70 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 rounded-3xl p-6 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.15)] flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-cyan-500/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-lg font-bold shadow-inner group-hover:scale-110 transition-transform">
                          🌐
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400/80">FRONTEND LAYER</div>
                          <span className="font-black text-sm text-white">TRẠM GIAO DIỆN VERCEL</span>
                        </div>
                      </div>
                      <span className="badge bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black text-[10px] animate-pulse px-3 py-2.5 rounded-xl shadow-sm">
                        EDGE ACTIVE
                      </span>
                    </div>
                    
                    <div className="space-y-3.5">
                      <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-all shadow-inner">
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                          Độ trễ phản hồi máy chủ (Real RTT Ping)
                        </span>
                        <div className="flex flex-col gap-2">
                          <div className={`font-black text-lg font-mono tracking-tight flex items-center gap-2 ${
                            !clientTelemetry?.pingVal || clientTelemetry.pingVal < 350
                              ? "text-emerald-400"
                              : clientTelemetry.pingVal < 800
                                ? "text-amber-300"
                                : "text-amber-400"
                          }`}>
                            <span className={`inline-block w-2.5 h-2.5 rounded-full animate-ping ${
                              !clientTelemetry?.pingVal || clientTelemetry.pingVal < 350 ? "bg-emerald-400" : "bg-amber-400"
                            }`} />
                            <span>{clientTelemetry?.pingMs || "Đang đo..."}</span>
                            <span className="text-xs text-slate-400 font-semibold font-sans px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                              {clientTelemetry?.connectionType || "Online"}
                            </span>
                          </div>
                          {clientTelemetry?.pingVal > 800 && (
                            <div className="text-xs text-amber-200 font-semibold bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 leading-relaxed shadow-sm flex items-start gap-2">
                              <span className="text-base shrink-0">⚡</span>
                              <div>
                                <strong className="text-amber-300 font-extrabold uppercase text-[11px] block">Vì sao ping cao?</strong>
                                Máy chủ Railway đặt tại Mỹ (US-West) & CSDL Neon vừa khôi phục sau chế độ ngủ ngầm (Cold Start). Bấm làm mới lần nữa sẽ tụt xuống dưới 350ms!
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-all shadow-inner">
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                          Tường lửa WAF & Giao thức Edge
                        </span>
                        <div className="flex items-center gap-2 text-white font-black text-xs font-mono">
                          <span className="badge badge-sm bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold px-2">DDoS Protected</span>
                          <span className="text-cyan-300">{clientTelemetry?.protocol || "HTTPS (TLS 1.3)"}</span>
                        </div>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-all shadow-inner">
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                          Tối ưu hóa tĩnh (Workbox PWA & Cache)
                        </span>
                        <div className="text-amber-300 font-bold text-xs font-mono flex items-center justify-between">
                          <span>⚡ {clientTelemetry?.cachedItemsCount || "0"} Assets trong máy</span>
                          <span className="text-slate-400">Lưu trữ: {clientTelemetry?.localStorageBytes || "0"} KB</span>
                        </div>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-all shadow-inner">
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                          Thiết bị Admin & Trình duyệt thực
                        </span>
                        <div className="text-cyan-300 font-bold text-xs font-mono truncate bg-cyan-500/10 px-3 py-2 rounded-xl border border-cyan-500/20">
                          💻 {clientTelemetry?.cpuThreads || "8 Lõi"} · {clientTelemetry?.deviceRAM || "RAM"} · {clientTelemetry?.userAgentBrand || "Web"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Railway Backend API Server */}
                <div className="bg-slate-900/70 backdrop-blur-xl border border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 rounded-3xl p-6 shadow-[0_10px_30px_-10px_rgba(168,85,247,0.15)] flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-purple-500/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-lg font-bold shadow-inner group-hover:scale-110 transition-transform">
                          ⚡
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-purple-400/80">BACKEND ENGINE</div>
                          <span className="font-black text-sm text-white">TRẠM XỬ LÝ RAILWAY</span>
                        </div>
                      </div>
                      <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/40 font-black text-[10px] animate-pulse px-3 py-2.5 rounded-xl shadow-sm">
                        NODE ENGINE
                      </span>
                    </div>

                    {serverHealth ? (
                      <div className="space-y-3.5">
                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all shadow-inner">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                            Trạng thái & Tiến trình (PID)
                          </span>
                          <div className="text-emerald-400 font-black text-sm font-mono flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                            <span>{serverHealth.status}</span>
                            {serverHealth.pid && <span className="badge badge-sm bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-mono font-bold">PID #{serverHealth.pid}</span>}
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all shadow-inner">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                            Thời gian liên tiếp hoạt động (Uptime)
                          </span>
                          <div className="text-white font-black text-sm font-mono bg-purple-500/10 px-3.5 py-2.5 rounded-xl border border-purple-500/20 flex flex-wrap gap-2 items-center justify-between">
                            <span>⏳ API: <span className="text-purple-300 font-bold">{Math.floor(serverHealth.uptimeSeconds / 3600)}h {Math.floor((serverHealth.uptimeSeconds % 3600) / 60)}p</span></span>
                            {serverHealth.osUptimeSeconds && <span className="text-xs text-slate-400">OS: {Math.floor(serverHealth.osUptimeSeconds / 3600)}h {Math.floor((serverHealth.osUptimeSeconds % 3600) / 60)}p</span>}
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all shadow-inner">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                            Bộ nhớ RAM Máy chủ (App RSS / V8 Heap)
                          </span>
                          <div className="text-amber-300 font-black text-sm font-mono">
                            <div className="flex items-center justify-between mb-1">
                              <span>🧠 {serverHealth.memoryRssMb} MB <span className="text-xs font-normal text-slate-400">(RSS)</span></span>
                              <span>{serverHealth.memoryHeapUsedMb} MB <span className="text-xs font-normal text-slate-400">(Heap)</span></span>
                            </div>
                            {serverHealth.totalOsRamMb && <div className="text-xs text-slate-400 font-normal border-t border-white/5 pt-1 mt-1">Tổng RAM hạ tầng Cloud: <strong className="text-white">{serverHealth.totalOsRamMb} MB</strong></div>}
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all shadow-inner">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                            Phần cứng CPU & Hệ điều hành
                          </span>
                          <div className="text-slate-200 font-bold text-xs font-mono">
                            <div className="truncate mb-1 text-purple-300" title={serverHealth.cpuModel}>
                              🖥️ {serverHealth.cpuModel || "Cloud vCPU"} ({serverHealth.cpuCores || 1} Cores)
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-white/5 pt-1.5">
                              <span>Platform: <strong className="text-white font-mono">{serverHealth.platform}</strong></span>
                              <span>Node: <strong className="text-white font-mono">{serverHealth.nodeVersion}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-16 text-center text-purple-300 flex flex-col items-center gap-3.5">
                        <span className="loading loading-bars loading-md text-purple-400"></span>
                        <span className="font-bold text-xs uppercase tracking-wide text-slate-400">Đang đo ngầm tài nguyên thực từ Railway...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Neon PostgreSQL Cloud DB Telemetry */}
                <div className="bg-slate-900/70 backdrop-blur-xl border border-emerald-500/30 hover:border-emerald-400/60 transition-all duration-300 rounded-3xl p-6 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.15)] flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-emerald-500/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg font-bold shadow-inner group-hover:scale-110 transition-transform">
                          🗄️
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400/80">DATABASE LAYER</div>
                          <span className="font-black text-sm text-white">TRẠM CSDL NEON CLOUD</span>
                        </div>
                      </div>
                      <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-[10px] animate-pulse px-3 py-2.5 rounded-xl shadow-sm">
                        SQL ONLINE
                      </span>
                    </div>

                    {serverHealth && serverHealth.db ? (
                      <div className="space-y-3.5">
                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all shadow-inner">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                            Engine CSDL & Tốc độ truy xuất (DB Latency)
                          </span>
                          <div className="text-emerald-400 font-black text-sm font-mono flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span>{serverHealth.db.latencyMs ? `${serverHealth.db.latencyMs}ms` : "Siêu nhạy"}</span>
                            <span className="text-xs text-slate-300 font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/20">
                              {serverHealth.db.status}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all shadow-inner">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                            Dung lượng Thực tế & Quy mô CSDL
                          </span>
                          <div className="text-white font-black text-sm font-mono flex items-center justify-between bg-emerald-500/10 px-3.5 py-2.5 rounded-xl border border-emerald-500/20">
                            <span>💾 {serverHealth.db.size}</span>
                            <span className="text-xs text-emerald-300 font-semibold">Gồm {serverHealth.db.tables} Bảng dữ liệu thực</span>
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all shadow-inner">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-1.5">
                            Bể kết nối SQL (Active Connection Pool)
                          </span>
                          <div className="text-amber-300 font-black text-sm font-mono flex items-center justify-between">
                            <span>🔌 {serverHealth.db.connections?.active || 1} / {serverHealth.db.connections?.total || 1} kết nối kích hoạt</span>
                            <span className="badge badge-sm bg-amber-500/20 text-amber-300 border-amber-500/30">Pool Active</span>
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all shadow-inner">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block mb-2">
                            Thống kê Bản ghi thực tế trong Hệ thống
                          </span>
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold">
                            <div className="bg-emerald-500/10 text-emerald-300 p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between shadow-sm">
                              <span>👥 Accounts:</span>
                              <span className="text-white font-black">{serverHealth.db.records?.users || 0}</span>
                            </div>
                            <div className="bg-cyan-500/10 text-cyan-300 p-2.5 rounded-xl border border-cyan-500/20 flex items-center justify-between shadow-sm">
                              <span>🔐 Sessions:</span>
                              <span className="text-white font-black">{serverHealth.db.records?.sessions || 0}</span>
                            </div>
                            <div className="bg-purple-500/10 text-purple-300 p-2.5 rounded-xl border border-purple-500/20 flex items-center justify-between shadow-sm">
                              <span>🛡️ Audit Log:</span>
                              <span className="text-white font-black">{serverHealth.db.records?.audit || 0}</span>
                            </div>
                            <div className="bg-rose-500/10 text-rose-300 p-2.5 rounded-xl border border-rose-500/20 flex items-center justify-between shadow-sm">
                              <span>🚫 Banned IPs:</span>
                              <span className="text-white font-black">{serverHealth.db.records?.blacklistedIps || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-16 text-center text-emerald-300 flex flex-col items-center gap-3.5">
                        <span className="loading loading-spinner loading-md text-emerald-400"></span>
                        <span className="font-bold text-xs uppercase tracking-wide text-slate-400">Đang trích xuất dữ liệu từ Neon Postgres...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Global / Targeted Broadcast Banner */}
          {advancedSubTab === "broadcast" && (
            <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-800/80 relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -mt-32 -mr-32" />

              <div className="relative z-10 mb-8 pb-6 border-b border-white/10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-black mb-2 shadow-inner">
                  <span>📢 GLOBAL & TARGETED BROADCAST HUB</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-blue-200">
                  Phát Loa Thông Báo Toàn Hệ Thống
                </h3>
                <p className="text-sm text-slate-400 font-medium mt-1 max-w-3xl leading-relaxed">
                  Phát thông báo nổi bật tới toàn bộ người dùng đang trực tuyến hoặc chỉ định rõ một tài khoản nhất định. Banner thông báo sẽ tự động nổi lên trên giao diện ứng dụng của người nhận theo thời gian thực!
                </p>
              </div>

              <div className="relative z-10 space-y-6 max-w-4xl">
                <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/10 shadow-2xl space-y-5">
                  <div>
                    <label className="label text-xs font-black uppercase text-blue-300 tracking-wider pb-2">
                      🎯 Chọn Đối Tượng Nhận Thông Báo (Mục Tiêu Phát Sóng):
                    </label>
                    <select
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="select select-bordered w-full rounded-2xl font-bold text-sm bg-slate-950 text-white border-white/20 focus:border-blue-500 h-12 shadow-inner"
                    >
                      <option value="ALL">🌐 Toàn bộ hệ thống (Tất cả người dùng trên Server)</option>
                      {users.map((u) => {
                        const label = u.displayName ? `${u.displayName} (${u.email || u.uid})` : (u.email || u.uid);
                        return (
                          <option key={u.uid || u.email} value={u.email || u.uid}>
                            👤 Cá nhân: {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="label text-xs font-black uppercase text-blue-300 tracking-wider pb-2">
                      💬 Nội Dung Bản Tin Phát Loa:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="Nhập nội dung thông báo (ví dụ: Bảo trì hệ thống lúc 23h50, vui lòng lưu giữ bài đăng...)"
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        className="input input-bordered flex-1 font-semibold rounded-2xl h-13 bg-slate-950 text-white placeholder:text-slate-500 border-white/20 focus:border-blue-500 shadow-inner px-4 text-base"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!broadcastMsg.trim()) {
                            SonnerWarning("Vui lòng nhập nội dung thông báo trước khi phát sóng!");
                            return;
                          }
                          const action = async () => {
                            await adminRequest("/broadcast", {
                              method: "POST",
                              body: JSON.stringify({ message: broadcastMsg, active: true, targetUser: broadcastTarget }),
                            });
                            setBroadcastMsg("");
                            setBroadcastActive(true);
                            window.dispatchEvent(new Event("locket_broadcast_updated"));
                            const targetText = broadcastTarget === "ALL" ? "Toàn Server" : `riêng cho ${broadcastTarget}`;
                            SonnerSuccess(`🎉 Đã ĐĂNG và PHÁT SÓNG thông báo tới: ${targetText}!`);
                            fetchAdvancedData();
                          };
                          handleActionWithSessionCheck(action);
                        }}
                        className="btn bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 font-black px-8 rounded-2xl h-13 border-0 shadow-[0_0_25px_-5px_rgba(16,185,129,0.5)] transition-all active:scale-95 text-sm"
                      >
                        🟢 Đăng & Phát Sóng Ngay
                      </button>
                    </div>
                  </div>
                </div>

                {/* Danh Sách Các Thông Báo Đã Đăng */}
                <div className="pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      📋 Lịch Sử Thông Báo Đã Đăng (Broadcast Archive)
                    </h4>
                    <span className="badge badge-neutral badge-sm font-bold">{broadcastList.length} Bản tin</span>
                  </div>

                  <div className="overflow-x-auto border border-white/10 rounded-2xl bg-slate-900/50 shadow-inner max-h-96 overflow-y-auto">
                    <table className="table w-full text-sm font-medium">
                      <thead className="bg-slate-900 font-extrabold text-slate-300 uppercase text-xs tracking-wider sticky top-0 z-10 border-b border-white/10">
                        <tr>
                          <th className="py-3.5">Trang Thái</th>
                          <th>Nội Dung</th>
                          <th>Đối Tượng</th>
                          <th>Thời Gian Đăng</th>
                          <th className="text-right">Hành Động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {broadcastList.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center py-12 text-slate-500 font-semibold">
                              Chưa có thông báo nào được ghi nhận trong cơ sở dữ liệu.
                            </td>
                          </tr>
                        ) : (
                          broadcastList.map((bItem) => {
                            const isAll = bItem.targetUser === "ALL" || bItem.targetUser === "*";
                            return (
                              <tr key={bItem.id || bItem.updatedAt} className="hover:bg-white/[0.04] transition-colors">
                                <td className="py-3.5 font-bold">
                                  {bItem.active ? (
                                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm animate-pulse">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Đang Phát
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white/10 text-slate-400 border border-white/10">
                                      ⚪ Đã Tắt
                                    </span>
                                  )}
                                </td>
                                <td className="font-bold max-w-xs truncate text-white" title={bItem.message}>
                                  {bItem.message}
                                </td>
                                <td>
                                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border shadow-sm ${
                                    isAll ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" : "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                  }`}>
                                    {isAll ? "🌐 Toàn Server" : `👤 ${bItem.targetUser}`}
                                  </span>
                                </td>
                                <td className="text-xs text-slate-400 font-mono">
                                  {bItem.updatedAt ? new Date(bItem.updatedAt).toLocaleString("vi-VN") : "N/A"}
                                </td>
                                <td className="text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const action = async () => {
                                          await adminRequest("/broadcast", {
                                            method: "POST",
                                            body: JSON.stringify({ action: "toggle", id: bItem.id, active: !bItem.active }),
                                          });
                                          SonnerInfo(bItem.active ? "Đã tắt loa thông báo!" : "Đã bật lại loa thông báo!");
                                          window.dispatchEvent(new Event("locket_broadcast_updated"));
                                          fetchAdvancedData();
                                        };
                                        handleActionWithSessionCheck(action);
                                      }}
                                      className={`btn btn-xs font-extrabold rounded-xl h-8 px-3 transition-all ${
                                        bItem.active ? "bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40" : "bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40"
                                      }`}
                                    >
                                      {bItem.active ? "🚫 Tắt Loa" : "🟢 Phát Lại"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const action = async () => {
                                          await adminRequest(`/broadcast/${bItem.id}`, { method: "DELETE" });
                                          SonnerInfo("Đã xóa thông báo khỏi danh sách!");
                                          window.dispatchEvent(new Event("locket_broadcast_updated"));
                                          fetchAdvancedData();
                                        };
                                        handleActionWithSessionCheck(action);
                                      }}
                                      className="btn btn-xs bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-bold rounded-xl h-8 px-3 flex items-center gap-1 transition-all"
                                      title="Xóa thông báo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Permanent IP Blacklist */}
          {advancedSubTab === "blacklist" && (
            <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-800/80 relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none -mt-32 -mr-32" />

              <div className="relative z-10 mb-8 pb-6 border-b border-white/10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-black mb-2 shadow-inner">
                  <span>🚫 WAF FIREWALL · PERMANENT LOCKOUT</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-100 to-amber-200">
                  Cấm Cửa Địa Chỉ IP Vĩnh Viễn
                </h3>
                <p className="text-sm text-slate-400 font-medium mt-1 max-w-3xl leading-relaxed">
                  Những địa chỉ IP nằm trong danh sách đen này sẽ bị Tường Lửa Thép Huy Locket từ chối kết nối ngay tại tầng giao thức trước khi chạm vào máy chủ Node.js, vô hiệu hóa hoàn toàn mọi truy cập của tin tặc hay spammer.
                </p>
              </div>

              <div className="relative z-10 space-y-6">
                <div className="bg-slate-900/80 p-6 rounded-3xl border border-rose-500/20 shadow-2xl max-w-4xl">
                  <label className="label text-xs font-black uppercase tracking-wider text-rose-300 pb-2">
                    🔒 Phong Tỏa IP Khả Nghi Vào Danh Sách Đen:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Nhập địa chỉ IP (VD: 54.196.219.221)..."
                      value={banIpInput}
                      onChange={(e) => setBanIpInput(e.target.value)}
                      className="input input-bordered w-full sm:w-72 font-mono text-sm rounded-2xl h-12 bg-slate-950 text-white placeholder:text-slate-500 border-white/20 focus:border-rose-500 shadow-inner"
                    />
                    <input
                      type="text"
                      placeholder="Lý do phong tỏa (VD: Dội bot VPS / Tấn công dò rỉ)..."
                      value={banReasonInput}
                      onChange={(e) => setBanReasonInput(e.target.value)}
                      className="input input-bordered flex-1 text-sm rounded-2xl h-12 bg-slate-950 text-white placeholder:text-slate-500 border-white/20 focus:border-rose-500 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!banIpInput.trim()) return SonnerInfo("Vui lòng nhập số IP hợp lệ");
                        const action = async () => {
                          await adminRequest("/ip-blacklist", {
                            method: "POST",
                            body: JSON.stringify({ ip_address: banIpInput.trim(), reason: banReasonInput.trim() || "Cấm bởi Quản Trị Viên" }),
                          });
                          SonnerInfo(`🛑 Đã cấm vĩnh viễn IP: ${banIpInput.trim()}`);
                          setBanIpInput(""); setBanReasonInput("");
                          fetchAdvancedData();
                        };
                        handleActionWithSessionCheck(action);
                      }}
                      className="btn bg-gradient-to-r from-rose-600 via-red-600 to-amber-700 hover:from-rose-500 hover:to-amber-600 text-white font-black px-8 rounded-2xl h-12 border-0 shadow-[0_0_25px_-5px_rgba(244,63,94,0.5)] transition-all active:scale-95 text-sm"
                    >
                      🔒 Phong Tỏa Ngay
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      📋 Lịch Sử Phong Tỏa Cấm Cửa (Active Blocklist)
                    </h4>
                    <span className="badge badge-error badge-sm font-black text-white">{blacklistedIps.length} IP Bị Cấm</span>
                  </div>

                  <div className="overflow-x-auto border border-white/10 rounded-2xl bg-slate-900/50 shadow-inner max-h-96 overflow-y-auto">
                    <table className="table table-zebra w-full text-sm font-medium">
                      <thead className="bg-slate-900 font-extrabold text-slate-300 uppercase text-xs tracking-wider sticky top-0 z-10 border-b border-white/10">
                        <tr>
                          <th className="py-3.5">Địa chỉ IP</th>
                          <th>Lý do Cấm Cửa</th>
                          <th>Người thao tác</th>
                          <th>Thời gian phong tỏa</th>
                          <th className="text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {blacklistedIps.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center py-12 text-slate-500 font-semibold">
                              Chưa có IP nào bị phong tỏa trong cơ sở dữ liệu. Môi trường mạng đang sạch.
                            </td>
                          </tr>
                        ) : blacklistedIps.map((b) => (
                          <tr key={b.ip_address} className="hover:bg-white/[0.04] transition-colors">
                            <td className="font-mono font-black text-rose-400 text-sm py-3.5">
                              🚫 {b.ip_address}
                            </td>
                            <td className="text-xs font-bold text-slate-200">{b.reason || "—"}</td>
                            <td className="font-mono text-xs text-cyan-300 font-bold">{b.blocked_by || "SUPER_ADMIN"}</td>
                            <td className="font-mono text-xs text-slate-400">{formatDateTime(b.created_at)}</td>
                            <td className="text-right">
                              <button
                                type="button"
                                onClick={async () => {
                                  const action = async () => {
                                    await adminRequest(`/ip-blacklist/${encodeURIComponent(b.ip_address)}`, { method: "DELETE" });
                                    SonnerInfo(`Đã mở cửa IP: ${b.ip_address}`);
                                    fetchAdvancedData();
                                  };
                                  handleActionWithSessionCheck(action);
                                }}
                                className="btn btn-xs bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 font-extrabold rounded-xl h-8 px-4 transition-all"
                              >
                                🔓 Mở Khóa IP
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Live API & Integration Heartbeat Monitor */}
          {advancedSubTab === "heartbeat" && (
            <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-800/80 relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -mt-32 -mr-32" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none -mb-32 -ml-32" />

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 pb-6 border-b border-white/10">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-black mb-2 shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>REAL-TIME API RADAR · LIVE PROBE</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-emerald-200 flex items-center gap-2.5">
                    Trạm Giám Sát Nhịp Sống & Liên Kết API
                  </h2>
                  <p className="text-sm text-slate-400 font-medium mt-1 max-w-3xl leading-relaxed">
                    Tự động phóng các xung tín hiệu trực tiếp (Live Ping Probe) tới toàn bộ các Cổng API âm nhạc, thời tiết, định vị và máy chủ trung tâm để chẩn đoán trạng thái Sống/Chết kèm giải pháp sửa chữa tức thì.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runApiHealthCheck}
                  disabled={testingApis}
                  className="btn btn-md bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 font-black border-0 shadow-[0_0_25px_-5px_rgba(16,185,129,0.5)] rounded-2xl px-6 h-12 shrink-0 transition-all active:scale-95 cursor-pointer text-sm"
                >
                  {testingApis ? (
                    <>
                      <span className="loading loading-spinner loading-sm text-slate-950" />
                      <span>Đang rà soát nhịp sống...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={18} className="text-amber-900 fill-amber-900" />
                      <span>🧪 Kiểm tra ngay (Live Ping)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Heartbeat Status Grid */}
              <div className="relative z-10">
                {apiStatuses.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
                    <span className="loading loading-bars loading-lg text-emerald-400"></span>
                    <p className="text-sm font-extrabold text-emerald-300/80 uppercase tracking-widest">Đang thực hiện cuộc rà soát Sóng liên kết lần đầu...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {apiStatuses.map((item) => {
                      const isOnline = item.status === "ONLINE";
                      return (
                        <div
                          key={item.id}
                          className={`rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between shadow-2xl relative overflow-hidden group ${
                            isOnline
                              ? "bg-slate-900/80 backdrop-blur-xl border-emerald-500/30 hover:border-emerald-400/60 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.15)]"
                              : "bg-gradient-to-b from-rose-950/90 to-slate-950 border-rose-500 shadow-[0_10px_35px_-10px_rgba(244,63,94,0.4)] ring-2 ring-rose-500/30 animate-fade-in"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <h3 className="font-black text-base text-white leading-snug tracking-tight flex items-center gap-2">
                                <span>{item.name}</span>
                              </h3>
                              <span
                                className={`badge font-black px-3 py-3 rounded-xl shrink-0 text-xs shadow-sm ${
                                  isOnline
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-rose-500/30 text-rose-300 border border-rose-500 animate-pulse"
                                }`}
                              >
                                {isOnline ? "🟢 ONLINE" : "🔴 OFFLINE / LỖI"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4 font-medium">{item.desc}</p>

                            {/* AUTOMATED DIAGNOSIS & REMEDY GUIDE */}
                            <div className={`rounded-2xl p-4 mb-5 border transition-all shadow-inner ${
                              isOnline
                                ? "bg-slate-950/80 border-white/5 text-slate-300 hover:border-white/10"
                                : "bg-black/60 border-rose-500/50 text-rose-100"
                            }`}>
                              <div className="flex items-center gap-2 text-xs font-black mb-2">
                                <span className="text-base">{isOnline ? "💡" : "🚨"}</span>
                                <span className={isOnline ? "text-cyan-300 uppercase tracking-wider text-[11px]" : "text-amber-300 uppercase tracking-wider text-xs underline decoration-rose-500 decoration-2"}>
                                  {isOnline ? "Hướng dẫn bảo trì dự phòng:" : "Chẩn đoán Lỗi & Cách xử lý ngay:"}
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed mb-3 text-slate-300 font-medium">
                                <strong className={isOnline ? "text-teal-400 font-black uppercase text-[11px]" : "text-rose-300 font-black uppercase text-[11px]"}>Nguyên nhân: </strong> 
                                {item.errorHelp}
                              </p>
                              <div className="text-xs font-bold text-amber-200 bg-slate-900/90 p-3 rounded-xl border border-amber-500/20 leading-relaxed flex items-start gap-2 shadow-sm">
                                <span className="text-base shrink-0">🛠️</span>
                                <div>
                                  <strong className="text-amber-300 font-black uppercase text-[11px] block underline mb-0.5">Giải pháp chẩn đoán:</strong>
                                  <span className="text-slate-200 font-normal">{item.remedy}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono font-bold">
                            <span className="flex items-center gap-2 text-slate-300">
                              <span>⏱️ RTT Latency:</span>
                              <span className={`px-2 py-1 rounded-lg border ${
                                item.ping < 300 
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-black" 
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/30 font-black"
                              }`}>
                                {item.ping} ms
                              </span>
                            </span>
                            <span className={`font-black px-2.5 py-1 rounded-xl border font-mono ${
                              isOnline ? "text-slate-300 bg-white/5 border-white/10" : "text-rose-200 bg-rose-500/20 border-rose-500/50"
                            }`}>
                              {item.httpStatus}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative z-10 mt-8 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200 flex items-center gap-3.5 font-medium shadow-lg backdrop-blur-md">
                <span className="text-2xl shrink-0">🛡️</span>
                <span className="leading-relaxed">
                  <strong className="text-white font-black uppercase text-[11px] tracking-wider block mb-0.5">Huy Locket API Guard Note:</strong> 
                  Các dịch vụ có nhãn <code className="bg-emerald-500/20 px-2 py-0.5 rounded-lg text-white font-mono font-bold border border-emerald-500/30">CORS Guard</code> hoặc trả về HTTP Status (&lt; 500) đều đồng nghĩa máy chủ đầu xa đang mở cổng kết nối và phản hồi các tiến trình Locket một cách hoàn toàn bình thường theo đúng chuẩn bảo mật trình duyệt.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CHI TIẾT USER & LỊCH SỬ ĐĂNG NHẬP */}
      {selectedUser && (

        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setSelectedUser(null)}>
          <div className="modal-box max-w-5xl rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-primary/20 bg-base-100" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-5 top-5 text-base-content/60 hover:bg-base-200" onClick={() => setSelectedUser(null)}>✕</button>
            <h3 className="font-black text-xl mb-1.5 flex items-center gap-2.5 text-base-content">
              {userName(selectedUser)}
              {roleBadge(selectedUser.role)}
            </h3>
            <p className="text-sm font-medium text-base-content/70">{selectedUser.email || selectedUser.username || "Không có email/username"}</p>
            <p className="text-xs text-base-content/40 mb-6 font-mono">UID: {selectedUser.uid}</p>

            {selectedUser.role === "super_admin" || selectedUser.email?.toLowerCase() === "buiduchuy2010qn@gmail.com" ? (
              <div className="alert alert-info bg-primary/15 border-2 border-primary/40 text-primary mb-6 text-sm rounded-2xl font-semibold shadow-inner flex items-center gap-3">
                <Shield size={24} className="shrink-0 animate-pulse text-primary" />
                <span>👑 <strong>Quyền lực Tối thượng Cố định (Immutable Super Admin)</strong>: Tài khoản này được bảo vệ ở cấp độ cao nhất. Không bất kỳ ai (kể cả chính tài khoản này) có thể tự hạ vai trò, khóa truy cập hay thu hồi phiên làm việc.</span>
              </div>
            ) : selectedUser.uid === currentUserUid ? (
              <div className="alert alert-warning bg-secondary/15 border-2 border-secondary/40 text-secondary mb-6 text-sm rounded-2xl font-semibold shadow-inner">
                <span>👤 <strong>Tài khoản chính bạn (Self Protected)</strong>: Để chống tự khóa hỏng quyền truy cập điều hành, bạn không thể tự thu hồi hay khóa tài khoản của chính mình từ giao diện này.</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5 mb-6 bg-base-200/50 p-3 rounded-2xl border border-base-200">
                {currentRole !== "support" && currentRole !== "moderator" && (
                  <>
                    <button type="button" className={`btn btn-sm rounded-xl font-bold px-4 ${selectedUser.disabled ? "btn-success shadow-sm" : "btn-warning shadow-sm"}`} onClick={() => setActionModal({ type: selectedUser.disabled ? "unlock" : "lock", user: selectedUser, reason: "" })}>
                      {selectedUser.disabled ? <Unlock size={15} /> : <Lock size={15} />}
                      {selectedUser.disabled ? "Mở khóa truy cập web" : "Khóa truy cập web"}
                    </button>
                    <button type="button" className="btn btn-sm btn-outline btn-error rounded-xl font-bold px-4" onClick={() => setActionModal({ type: "revoke", user: selectedUser, reason: "" })}>
                      Thu hồi toàn bộ phiên web
                    </button>
                  </>
                )}
                {currentRole === "super_admin" && (
                  <button type="button" className="btn btn-sm btn-outline btn-secondary rounded-xl font-bold px-4" onClick={() => setActionModal({ type: "role", user: selectedUser, newRole: selectedUser.role || "user", reason: "" })}>
                    Gán vai trò RBAC
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-7 text-sm">
              <div className="bg-base-200/70 rounded-2xl p-4 border border-base-300/60 flex items-center gap-2.5"><Clock size={18} className="text-primary shrink-0" /> <span className="text-xs text-base-content/70">Đăng nhập: <strong className="text-base-content block text-sm mt-0.5">{formatDateTime(selectedUser.lastSignInTime)}</strong></span></div>
              <div className="bg-base-200/70 rounded-2xl p-4 border border-base-300/60 flex items-center gap-2.5"><Activity size={18} className="text-success shrink-0" /> <span className="text-xs text-base-content/70">Trang thái: <strong className="text-base-content block text-sm mt-0.5">{isOnline(selectedUser) ? `Đang hoạt động · ${selectedUser.activeSessions} phiên` : relativeActivity(selectedUser.lastSeenAt)}</strong></span></div>
              <div className="bg-base-200/70 rounded-2xl p-4 border border-base-300/60 flex items-center gap-2.5"><Monitor size={18} className="text-secondary shrink-0" /> <span className="text-xs text-base-content/70">Nguồn web: <strong className="text-base-content font-mono block text-sm mt-0.5">{sourceLabel(selectedUser.webSource)}</strong></span></div>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3 border-b border-base-200 pb-3">
              <h4 className="font-extrabold text-base flex items-center gap-2"><Clock size={18} className="text-primary" /> Lịch sử đăng nhập & Phiên web chi tiết</h4>
              {(currentRole === "super_admin" || currentRole === "admin") && (
                <button
                  type="button"
                  className={`btn btn-xs btn-error rounded-xl font-bold px-3 h-8 gap-1.5 ${clearHistoryConfirm ? "animate-pulse btn-active shadow-md" : "btn-outline"}`}
                  onClick={async () => {
                    if (!clearHistoryConfirm) {
                      setClearHistoryConfirm(true);
                      return;
                    }
                    const fn = async () => {
                      const data = await adminRequest(`/users/${encodeURIComponent(selectedUser.uid)}/login-history`, { method: "DELETE" });
                      setHistory([]);
                      setHistoryState("empty");
                      setClearHistoryConfirm(false);
                      SonnerInfo(`Đã xóa ${data.deleted || 0} sự kiện đăng nhập`);
                    };
                    await handleActionWithSessionCheck(fn);
                  }}
                  disabled={historyState === "loading" || history.length === 0}
                >
                  <Trash2 size={14} />
                  {clearHistoryConfirm ? "Xác nhận xóa lịch sử ngay!" : "Xóa lịch sử"}
                </button>
              )}
            </div>

            {historyState === "loading" ? (
              <div className="py-12 text-center"><span className="loading loading-spinner loading-md text-primary" /></div>
            ) : historyState === "error" ? (
              <div className="alert alert-error text-sm rounded-2xl"><AlertTriangle size={16} /><span>{historyError}</span></div>
            ) : historyState === "empty" ? (
              <div className="alert text-sm bg-base-200/50 border-base-200 rounded-2xl font-medium"><Info size={16} className="text-primary" /><span>Chưa có lịch sử đăng nhập được ghi nhận từ khi bộ máy giám sát kích hoạt.</span></div>
            ) : (
              <div className="overflow-x-auto max-h-[420px] rounded-2xl border border-base-300 shadow-inner bg-base-100">
                <table className="table table-sm w-full">
                  <thead><tr className="bg-base-200 text-xs font-bold sticky top-0 z-10"><th>Thời gian</th><th>IP máy chủ</th><th>Vị trí (GPS / IP)</th><th>Trình duyệt / thiết bị</th><th>Phương thức</th><th>Build / Commit</th><th>Nguồn</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {history.map((entry) => {
                      const entryOnline = !entry.ended_at && Date.now() - new Date(entry.last_seen_at).getTime() <= onlineWindowSeconds * 1000;
                      return (
                        <tr key={entry.event_id || entry.session_id} className="hover">
                          <td className="whitespace-nowrap text-xs font-medium">{formatDateTime(entry.created_at)}</td>
                          <td className="font-mono text-xs font-bold text-primary">{entry.ip_address || UNKNOWN}</td>
                          <td><span className="inline-flex items-center font-semibold gap-1 text-xs"><MapPin size={11} className="text-secondary shrink-0" /> {entry.gps_coordinates ? "📍 Đã bật GPS (" + entry.gps_coordinates + ")" : "🌐 Vị trí IP (gần đúng): " + ([entry.city, entry.region, entry.country].filter((v) => v && v !== UNKNOWN).join(", ") || UNKNOWN)}</span></td>
                          <td><span className="font-bold text-xs">{entry.browser || UNKNOWN} {entry.browser_version && entry.browser_version !== UNKNOWN ? entry.browser_version : ""}</span><br /><span className="text-[11px] text-base-content/60">{entry.os || UNKNOWN} · {entry.device || UNKNOWN}</span></td>
                          <td><span className="badge badge-ghost font-mono badge-xs py-2 px-2">{loginMethodLabel(entry.login_method)}</span></td>
                          <td className="font-mono text-xs">{entry.web_version || "—"}<br /><span className="text-[10px] text-base-content/50">{entry.commit_hash || entry.build_id || "—"}</span></td>
                          <td><span className="badge badge-outline badge-xs font-mono font-bold py-2 px-2">{sourceLabel(entry.web_source)}</span></td>
                          <td>{entry.ended_at ? <span className="badge badge-ghost badge-xs font-medium py-2 px-2">Đã kết thúc</span> : entryOnline ? <span className="badge badge-success font-bold badge-xs text-success-content py-2 px-2 shadow-sm">Đang hoạt động</span> : <span className="badge badge-warning font-bold badge-xs py-2 px-2">Mất heartbeat</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL BẮT BUỘC NHẬP LÝ DO CHO THAO TÁC QUẢN TRỊ NHẠY CẢM */}
      {actionModal && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setActionModal(null)}>
          <div className="modal-box max-w-lg rounded-3xl p-6 border border-base-300 shadow-2xl bg-base-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg flex items-center gap-2 text-error mb-2">
              <AlertTriangle className="text-error" size={22} /> Xác nhận Thao tác Quản trị
            </h3>
            <p className="text-sm text-base-content/80 mb-5 font-medium leading-relaxed">
              Bạn đang thực hiện thao tác <strong className="uppercase text-primary font-bold">{actionModal.type}</strong> đối với tài khoản <strong>{userName(actionModal.user)}</strong>. Hành động này sẽ được ghi nhận vào nhật ký Audit Log vĩnh viễn.
            </p>

            {actionModal.type === "role" && (
              <div className="form-control mb-5">
                <label className="label font-extrabold text-xs tracking-wide uppercase text-base-content/70">CHỌN VAI TRÒ RBAC:</label>
                <select
                  className="select select-bordered w-full rounded-2xl font-bold text-sm h-12 border-secondary/40 focus:border-secondary"
                  value={actionModal.newRole}
                  onChange={(e) => setActionModal({ ...actionModal, newRole: e.target.value })}
                >
                  <option value="super_admin">👑 Super Admin - Toàn quyền quản trị tối cao</option>
                  <option value="admin">🛡️ Admin - Quản lý user & thu hồi phiên</option>
                  <option value="moderator">⚖️ Moderator - Chỉ xử lý nội dung vi phạm</option>
                  <option value="support">🎧 Support - Chỉ xem dữ liệu hỗ trợ cơ bản</option>
                  <option value="user">👤 User - Người dùng Locket Web thông thường</option>
                </select>
              </div>
            )}

            <div className="form-control mb-7">
              <label className="label font-extrabold text-xs tracking-wide uppercase text-base-content/70">
                <span>LÝ DO BẮT BUỘC (LƯU VÀO AUDIT LOG):</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-28 rounded-2xl text-sm p-3.5 border-base-300 focus:border-primary shadow-inner font-medium"
                placeholder="Ví dụ: Phát hiện nghi vấn xâm phạm, Thay đổi nhiệm vụ nhân sự, Theo yêu cầu Super Admin..."
                value={actionModal.reason}
                onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                autoFocus
              />
            </div>

            <div className="modal-action flex items-center justify-end gap-2.5 pt-2 border-t border-base-200">
              <button type="button" className="btn btn-sm btn-ghost rounded-xl px-5 font-bold" onClick={() => setActionModal(null)}>Hủy bỏ</button>
              <button
                type="button"
                className={`btn btn-sm btn-primary rounded-xl px-7 font-extrabold h-10 shadow-md ${Boolean(actionLoading) ? "loading" : ""}`}
                onClick={executeModalAction}
                disabled={Boolean(actionLoading)}
              >
                Xác nhận & Thực thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC MINH LẠI MÃ PIN KHI ĐÃ HẾT HẠN PHIÊN NHẠY CẢM */}
      {reauthModalOpen && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setReauthModalOpen(false)}>
          <div className="modal-box max-w-md rounded-3xl p-6 border-2 border-primary/40 shadow-2xl bg-base-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg flex items-center gap-2 text-primary mb-2">
              🔐 Xác Minh Lại Mã PIN Quản Trị
            </h3>
            <p className="text-xs text-base-content/70 leading-relaxed mb-4 font-medium">
              Phiên thao tác quản trị 30 phút của bạn đã hết hạn. Để tiếp tục thực hiện lệnh nhạy cảm cho <strong>{currentEmail || "Tài khoản của bạn"}</strong>, vui lòng xác minh lại bằng Mã PIN số bảo mật.
            </p>

            {reauthError && (
              <div className="alert alert-error text-xs py-2 mb-4 rounded-xl font-medium">
                <AlertTriangle size={16} className="shrink-0" /> <span>{reauthError}</span>
              </div>
            )}

            <form onSubmit={handleReauthSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label text-[11px] font-extrabold text-base-content/70 tracking-wider uppercase">MÃ PIN SỐ BẢO MẬT (4 - 8 SỐ)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  placeholder="Nhập mã PIN của bạn..."
                  className="input input-bordered w-full rounded-2xl pr-10 shadow-inner text-sm h-11 font-bold tracking-widest text-center text-lg border-primary/30 focus:border-primary"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={reauthLoading}
                  autoFocus
                />
              </div>

              <div className="modal-action flex items-center justify-end gap-2 pt-3 border-t border-base-200">
                <button type="button" className="btn btn-sm btn-ghost rounded-xl px-4 font-bold" onClick={() => { setReauthModalOpen(false); setPendingCallback(null); }} disabled={reauthLoading}>Hủy bỏ</button>
                <button type="submit" className="btn btn-sm btn-primary rounded-xl px-6 font-extrabold h-10 shadow-md" disabled={reauthLoading || !reauthPassword.trim()}>
                  {reauthLoading ? <span className="loading loading-spinner loading-xs" /> : "Xác minh & Tiếp tục thao tác"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI MÃ PIN QUẢN TRỊ VIÊN */}
      {changePinModalOpen && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setChangePinModalOpen(false)}>
          <div className="modal-box max-w-md rounded-3xl p-6 border-2 border-primary/40 shadow-2xl bg-base-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg flex items-center gap-2 text-primary mb-2">
              🔑 Đổi Mã PIN Số Bảo Mật Quản Trị
            </h3>
            <p className="text-xs text-base-content/70 leading-relaxed mb-4 font-medium">
              Bạn có thể tự do thay đổi Mã PIN số bảo mật dành riêng cho khu vực quản trị viên tại đây.
            </p>

            {changePinError && (
              <div className="alert alert-error text-xs py-2 mb-4 rounded-xl font-medium">
                <AlertTriangle size={16} className="shrink-0" /> <span>{changePinError}</span>
              </div>
            )}

            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label text-[11px] font-extrabold text-base-content/70 tracking-wider uppercase">MÃ PIN HIỆN TẠI (CŨ)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  placeholder="Nhập mã PIN hiện tại..."
                  className="input input-bordered w-full rounded-2xl shadow-inner text-sm h-11 font-bold tracking-widest text-center text-lg border-base-300 focus:border-primary"
                  value={changePinOld}
                  onChange={(e) => setChangePinOld(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={changePinLoading}
                  autoFocus
                />
              </div>

              <div className="form-control">
                <label className="label text-[11px] font-extrabold text-base-content/70 tracking-wider uppercase">MÃ PIN SỐ MỚI (4 - 8 CHỮ SỐ)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  placeholder="Nhập mã PIN số mới..."
                  className="input input-bordered w-full rounded-2xl shadow-inner text-sm h-11 font-bold tracking-widest text-center text-lg border-primary/40 focus:border-primary text-primary"
                  value={changePinNew}
                  onChange={(e) => setChangePinNew(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={changePinLoading}
                />
              </div>

              <div className="modal-action flex items-center justify-end gap-2 pt-3 border-t border-base-200">
                <button type="button" className="btn btn-sm btn-ghost rounded-xl px-4 font-bold" onClick={() => setChangePinModalOpen(false)} disabled={changePinLoading}>Hủy bỏ</button>
                <button type="submit" className="btn btn-sm btn-primary rounded-xl px-6 font-extrabold h-10 shadow-md" disabled={changePinLoading || !changePinOld.trim() || !changePinNew.trim()}>
                  {changePinLoading ? <span className="loading loading-spinner loading-xs" /> : "Lưu Mã PIN Mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ VÀ HỖ TRỢ KHÔI PHỤC MẬT KHẨU */}
      {passwordStatusModal && (
        <div className="modal modal-open modal-bottom sm:modal-middle" onClick={() => setPasswordStatusModal(null)}>
          <div className="modal-box max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border-2 border-info/30 bg-base-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <h3 className="font-black text-lg text-info flex items-center gap-2">🔑 Kiểm tra & Hỗ trợ Mật Khẩu</h3>
              <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setPasswordStatusModal(null)}>✕</button>
            </div>
            <div className="py-4 space-y-4 text-sm">
              <div>
                <span className="text-xs text-base-content/60 font-bold uppercase block">Hồ sơ người dùng</span>
                <p className="font-bold text-base-content text-base mt-0.5">{passwordStatusModal.displayName}</p>
                <p className="text-xs font-mono text-primary mt-0.5">{passwordStatusModal.email}</p>
              </div>
              <div className="bg-base-200/70 p-3.5 rounded-2xl border border-base-300">
                <span className="text-xs text-secondary font-bold block mb-1">🛡️ Trạng Thái & Quyền Trợ Giúp:</span>
                <p className="text-xs text-base-content/80 leading-relaxed font-medium">{passwordStatusModal.policy}</p>
              </div>
              {passwordStatusModal.canResetViaFirebase ? (
                <div className="alert alert-success/20 border border-success/30 rounded-2xl py-3 text-xs font-semibold text-success-content flex items-center gap-2">
                  <span>✅ Email chính chủ hợp lệ. Bất cứ khi nào người dùng quên mật khẩu, họ có thể dùng nút Khôi Phục ở Màn Đăng Nhập hoặc liên hệ Admin gởi cổng bảo mật.</span>
                </div>
              ) : (
                <div className="alert alert-error/20 border border-error/30 rounded-2xl py-3 text-xs font-semibold text-error flex items-center gap-2">
                  <span>⚠️ Tài khoản này chưa gắn Email chuẩn. Yêu cầu liên hệ trực tiếp Admin Huy để cập nhật email trước khi reset.</span>
                </div>
              )}
            </div>
            <div className="modal-action">
              <button type="button" onClick={() => setPasswordStatusModal(null)} className="btn btn-primary rounded-xl font-bold px-6 w-full">Đã rõ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

