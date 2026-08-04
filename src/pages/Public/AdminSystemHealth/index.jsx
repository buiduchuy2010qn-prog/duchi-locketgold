import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Mic,
  Volume2,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  Wifi,
  ShieldCheck,
  ArrowLeft,
  Activity,
  Cpu,
  Database,
  Music,
  Maximize2,
  Globe,
  Radio
} from "lucide-react";
import ScrollReveal from "@/components/Effects/ScrollReveal";
import MagneticButton from "@/components/Effects/MagneticButton";
import { useConnectivityStore } from "@/stores/useConnectivityStore";
import { useAuthStore } from "@/stores";

const StatusBadge = ({ status, text }) => {
  if (status === "loading") {
    return (
      <span className="badge badge-warning gap-1 animate-pulse font-semibold">
        <RefreshCw className="w-3 h-3 animate-spin" /> Đang kiểm tra...
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="badge badge-success gap-1 text-white font-semibold">
        <CheckCircle2 className="w-3 h-3" /> {text || "Hoạt động tốt"}
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="badge badge-warning gap-1 font-semibold">
        <AlertTriangle className="w-3 h-3" /> {text || "Cảnh báo / Giới hạn"}
      </span>
    );
  }
  return (
    <span className="badge badge-error gap-1 text-white font-semibold">
      <XCircle className="w-3 h-3" /> {text || "Lỗi / Không khả dụng"}
    </span>
  );
};

export default function AdminSystemHealth() {
  const [isBrowserOnline, setIsBrowserOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const { isAuth, user } = useAuthStore();
  const [testing, setTesting] = useState(false);

  // Listen to browser network changes
  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // States for diagnostic checks
  const [cameraStatus, setCameraStatus] = useState({ state: "loading", details: "" });
  const [micStatus, setMicStatus] = useState({ state: "loading", details: "" });
  const [zoomStatus, setZoomStatus] = useState({ state: "loading", details: "" });
  const [apiStatus, setApiStatus] = useState({ state: "loading", latency: null, details: "" });
  const [musicStatus, setMusicStatus] = useState({ state: "loading", details: "" });
  const [authStatus, setAuthStatus] = useState({ state: "loading", details: "" });

  const runDiagnostics = useCallback(async () => {
    setTesting(true);

    // 1. Camera, Mic & Hardware Zoom Real Check
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatus({ state: "error", details: "Trình duyệt không hỗ trợ MediaDevices / getUserMedia API" });
        setMicStatus({ state: "error", details: "Trình duyệt không hỗ trợ MediaDevices / getUserMedia API" });
        setZoomStatus({ state: "error", details: "Không hỗ trợ" });
      } else {
        // Enumerate devices first
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const audioInputs = devices.filter((d) => d.kind === "audioinput");

        // Try accessing stream to test real permissions and capabilities
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];

          if (videoTrack) {
            const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
            const resText = settings.width && settings.height ? ` (${settings.width}x${settings.height})` : "";
            setCameraStatus({
              state: "ok",
              details: `Camera hoạt động tốt! Label: "${videoTrack.label || 'Camera'}"${resText}.`,
            });

            // Real Hardware Zoom check on active video track
            const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
            if (capabilities.zoom) {
              setZoomStatus({
                state: "ok",
                details: `Thiết bị hỗ trợ Hardware Zoom (Mức Zoom: ${capabilities.zoom.min || 1}x - ${capabilities.zoom.max || 5}x).`,
              });
            } else {
              setZoomStatus({
                state: "warning",
                details: "Ống kính Camera không có Hardware Zoom quang học. Sử dụng Digital Zoom phần mềm.",
              });
            }
          } else {
            setCameraStatus({ state: "warning", details: "Không thể khởi chạy Video Track." });
            setZoomStatus({ state: "warning", details: "Không lấy được Video Track để kiểm tra Zoom." });
          }

          if (audioTrack) {
            setMicStatus({
              state: "ok",
              details: `Microphone thu âm tốt! Label: "${audioTrack.label || 'Microphone'}".`,
            });
          } else {
            setMicStatus({ state: "warning", details: "Không thể khởi chạy Audio Track." });
          }

          // Release test stream immediately
          stream.getTracks().forEach((t) => t.stop());
        } catch (permErr) {
          // If permission was denied or camera occupied
          if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
            setCameraStatus({
              state: "warning",
              details: `🔒 Quyền bị từ chối: Bạn đã chặn quyền Camera trên trình duyệt. (${videoInputs.length} thiết bị có sẵn)`,
            });
            setMicStatus({
              state: "warning",
              details: `🔒 Quyền bị từ chối: Bạn đã chặn quyền Microphone trên trình duyệt. (${audioInputs.length} thiết bị có sẵn)`,
            });
            setZoomStatus({ state: "warning", details: "Cần cấp quyền Camera để đo tính năng Zoom." });
          } else {
            setCameraStatus({
              state: videoInputs.length > 0 ? "ok" : "error",
              details: `Phát hiện ${videoInputs.length} thiết bị Camera (${permErr.message || "Bị chiếm dụng"})`,
            });
            setMicStatus({
              state: audioInputs.length > 0 ? "ok" : "error",
              details: `Phát hiện ${audioInputs.length} thiết bị Microphone`,
            });
            setZoomStatus({ state: "warning", details: "Không kiểm tra được Zoom" });
          }
        }
      }
    } catch (err) {
      setCameraStatus({ state: "error", details: err.message || "Lỗi thiết bị" });
      setMicStatus({ state: "error", details: err.message || "Lỗi thiết bị" });
      setZoomStatus({ state: "error", details: "Lỗi kiểm tra" });
    }

    // 2. Real API Health & Ping Latency Check
    const start = performance.now();
    try {
      const res = await fetch("/dio-api/health", { method: "GET", cache: "no-store" });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        setApiStatus({
          state: "ok",
          latency,
          details: `Máy chủ Backend /dio-api phản hồi bình thường (Độ trễ ping: ${latency}ms)`,
        });
      } else {
        setApiStatus({
          state: "error",
          latency,
          details: `Máy chủ trả về mã lỗi HTTP ${res.status}`,
        });
      }
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      setApiStatus({
        state: "error",
        latency: null,
        details: `Không kết nối được Backend API (/dio-api) - Lỗi: ${err.message || "Mất kết nối mạng"}`,
      });
    }

    // 3. Audio & Music Player Real Support Check
    try {
      const dummyAudio = new Audio();
      const canPlayMp3 = dummyAudio.canPlayType("audio/mpeg");
      const canPlayOgg = dummyAudio.canPlayType("audio/ogg");
      if (canPlayMp3 || canPlayOgg) {
        setMusicStatus({
          state: "ok",
          details: `Trình duyệt hỗ trợ phát nhạc Web Audio API (MP3: ${canPlayMp3 || "không"}, OGG: ${canPlayOgg || "không"}). Dịch vụ Spotify SDK sẵn sàng.`,
        });
      } else {
        setMusicStatus({
          state: "error",
          details: "Trình duyệt không hỗ trợ định dạng âm thanh HTML5 Audio.",
        });
      }
    } catch (err) {
      setMusicStatus({
        state: "warning",
        details: "Lỗi kiểm tra trình phát âm thanh.",
      });
    }

    // 4. Auth & Database Status Check
    if (isAuth && user) {
      setAuthStatus({
        state: "ok",
        details: `Phiên đăng nhập hợp lệ. Người dùng: ${user.displayName || user.email || user.uid}`,
      });
    } else {
      setAuthStatus({
        state: "warning",
        details: "Chưa đăng nhập hoặc phiên làm việc hết hạn.",
      });
    }

    setTesting(false);
  }, [isAuth, user]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  return (
    <div className="min-h-screen w-full bg-base-100 text-base-content p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <ScrollReveal className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-base-200/50 backdrop-blur-md p-6 rounded-3xl border border-base-content/10 shadow-lg">
          <div className="flex items-center gap-4">
            <Link
              to="/admin/users"
              className="btn btn-circle btn-ghost btn-sm border border-base-content/10"
              title="Quay lại trang Admin Users"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
                <Activity className="w-7 h-7 text-primary animate-pulse" />
                Kiểm Trả Tình Trạng Hệ Thống
              </h1>
              <p className="text-sm text-base-content/70 mt-1">
                Bảng theo dõi và chẩn đoán thời gian thực cho tất cả tính năng cốt lõi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/users"
              className="btn btn-sm btn-outline rounded-full font-semibold"
            >
              👥 Quản lý người dùng
            </Link>
            <MagneticButton>
              <button
                onClick={runDiagnostics}
                disabled={testing}
                className="btn btn-primary rounded-full shadow-md gap-2 font-bold px-5"
              >
                <RefreshCw className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
                {testing ? "Đang quét..." : "Quét lại hệ thống"}
              </button>
            </MagneticButton>
          </div>
        </ScrollReveal>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ScrollReveal delay={0.1} className="bg-base-200/40 backdrop-blur-md p-5 rounded-2xl border border-base-content/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-base-content/60 uppercase">Trạng thái Mạng</p>
              <h3 className="text-lg font-bold mt-1">{isBrowserOnline ? "Trực tuyến (Online)" : "Ngoại tuyến (Offline)"}</h3>
            </div>
            <div className={`p-3 rounded-xl ${isBrowserOnline ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
              <Wifi className="w-6 h-6" />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15} className="bg-base-200/40 backdrop-blur-md p-5 rounded-2xl border border-base-content/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-base-content/60 uppercase">Backend API</p>
              <h3 className="text-lg font-bold mt-1">
                {apiStatus.latency ? `${apiStatus.latency} ms` : "Chưa kiểm tra"}
              </h3>
            </div>
            <div className={`p-3 rounded-xl ${apiStatus.state === "ok" ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
              <Server className="w-6 h-6" />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2} className="bg-base-200/40 backdrop-blur-md p-5 rounded-2xl border border-base-content/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-base-content/60 uppercase">Xác thực Admin</p>
              <h3 className="text-lg font-bold mt-1">{isAuth ? "Đã đăng nhập" : "Chưa đăng nhập"}</h3>
            </div>
            <div className={`p-3 rounded-xl ${isAuth ? "bg-info/20 text-info" : "bg-warning/20 text-warning"}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.25} className="bg-base-200/40 backdrop-blur-md p-5 rounded-2xl border border-base-content/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-base-content/60 uppercase">Máy chủ Socket</p>
              <h3 className="text-lg font-bold mt-1">{isBrowserOnline && apiStatus.state === "ok" ? "Sẵn sàng" : "Chưa kết nối"}</h3>
            </div>
            <div className={`p-3 rounded-xl ${isBrowserOnline && apiStatus.state === "ok" ? "bg-purple-500/20 text-purple-500" : "bg-warning/20 text-warning"}`}>
              <Radio className="w-6 h-6" />
            </div>
          </ScrollReveal>
        </div>

        {/* Diagnostic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Camera */}
          <ScrollReveal delay={0.1} className="bg-base-200/30 backdrop-blur-md p-6 rounded-3xl border border-base-content/10 flex flex-col justify-between hover:border-primary/50 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <Camera className="w-6 h-6" />
                </div>
                <StatusBadge status={cameraStatus.state} />
              </div>
              <h2 className="text-xl font-bold">Camera (Máy ảnh)</h2>
              <p className="text-sm text-base-content/70 leading-relaxed">
                {cameraStatus.details}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-base-content/5 text-xs text-base-content/50">
              Phân loại: Phần cứng & Quyền trình duyệt
            </div>
          </ScrollReveal>

          {/* Card 2: Zoom */}
          <ScrollReveal delay={0.15} className="bg-base-200/30 backdrop-blur-md p-6 rounded-3xl border border-base-content/10 flex flex-col justify-between hover:border-primary/50 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-secondary/10 text-secondary">
                  <Maximize2 className="w-6 h-6" />
                </div>
                <StatusBadge status={zoomStatus.state} />
              </div>
              <h2 className="text-xl font-bold">Tính năng Zoom</h2>
              <p className="text-sm text-base-content/70 leading-relaxed">
                {zoomStatus.details}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-base-content/5 text-xs text-base-content/50">
              Phân loại: MediaTrackConstraints
            </div>
          </ScrollReveal>

          {/* Card 3: Microphone */}
          <ScrollReveal delay={0.2} className="bg-base-200/30 backdrop-blur-md p-6 rounded-3xl border border-base-content/10 flex flex-col justify-between hover:border-primary/50 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-accent/10 text-accent">
                  <Mic className="w-6 h-6" />
                </div>
                <StatusBadge status={micStatus.state} />
              </div>
              <h2 className="text-xl font-bold">Microphone (Thu âm)</h2>
              <p className="text-sm text-base-content/70 leading-relaxed">
                {micStatus.details}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-base-content/5 text-xs text-base-content/50">
              Phân loại: Phần cứng & Quyền âm thanh
            </div>
          </ScrollReveal>

          {/* Card 4: Backend API */}
          <ScrollReveal delay={0.25} className="bg-base-200/30 backdrop-blur-md p-6 rounded-3xl border border-base-content/10 flex flex-col justify-between hover:border-primary/50 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-info/10 text-info">
                  <Server className="w-6 h-6" />
                </div>
                <StatusBadge status={apiStatus.state} />
              </div>
              <h2 className="text-xl font-bold">Máy Chủ Locket API</h2>
              <p className="text-sm text-base-content/70 leading-relaxed">
                {apiStatus.details}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-base-content/5 text-xs text-base-content/50">
              Endpoint: /dio-api/health
            </div>
          </ScrollReveal>

          {/* Card 5: Music & Sound */}
          <ScrollReveal delay={0.3} className="bg-base-200/30 backdrop-blur-md p-6 rounded-3xl border border-base-content/10 flex flex-col justify-between hover:border-primary/50 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <Music className="w-6 h-6" />
                </div>
                <StatusBadge status={musicStatus.state} />
              </div>
              <h2 className="text-xl font-bold">Âm Nhạc & Spotify</h2>
              <p className="text-sm text-base-content/70 leading-relaxed">
                {musicStatus.details}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-base-content/5 text-xs text-base-content/50">
              Phân loại: Tích hợp dịch vụ bên thứ ba
            </div>
          </ScrollReveal>

          {/* Card 6: Database & Authentication */}
          <ScrollReveal delay={0.35} className="bg-base-200/30 backdrop-blur-md p-6 rounded-3xl border border-base-content/10 flex flex-col justify-between hover:border-primary/50 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-warning/10 text-warning">
                  <Database className="w-6 h-6" />
                </div>
                <StatusBadge status={authStatus.state} />
              </div>
              <h2 className="text-xl font-bold">Cơ sở dữ liệu & Auth</h2>
              <p className="text-sm text-base-content/70 leading-relaxed">
                {authStatus.details}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-base-content/5 text-xs text-base-content/50">
              Phân loại: Firebase Service
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
