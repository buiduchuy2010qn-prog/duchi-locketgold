import React, { useEffect, useState } from "react";
import { MapPin, Shield, CloudRain, CheckCircle, XCircle } from "lucide-react";
import { useAuthStore } from "@/stores";
import { SonnerInfo, SonnerSuccess } from "@/components/uikit/SonnerToast";
import { updateAndSyncGpsLocation } from "@/services/UserActivityService";

const CONSENT_KEY = "HUY_LOCKET_GPS_CONSENT";

export default function LocationConsentModal() {
  const isAuth = useAuthStore((s) => s.isAuth);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuth || typeof window === "undefined") {
      setIsOpen(false);
      return;
    }
    const currentStatus = localStorage.getItem(CONSENT_KEY);
    // Nếu người dùng chưa từng đưa ra quyết định (chưa có trong localStorage)
    if (!currentStatus) {
      // Đợi 2.5 giây sau khi vào app để trải nghiệm mượt mà, không giật mình
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isAuth]);

  const handleGrant = async () => {
    setLoading(true);
    try {
      localStorage.setItem(CONSENT_KEY, "granted");
      await updateAndSyncGpsLocation();
      SonnerSuccess("🎉 Đã bật định vị thành công!", "Hệ thống Huy Locket Shield đã sẵn sàng bảo vệ và cá nhân hóa trải nghiệm của bạn.");
    } catch (error) {
      SonnerInfo("Chưa thể lấy vị trí từ thiết bị. Bạn có thể kiểm tra lại quyền trong cài đặt trình duyệt.");
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleDeny = () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    SonnerInfo("Đã từ chối chia sẻ vị trí. Bạn có thể bật lại bất cứ lúc nào trong menu Quyền Cài đặt.");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle z-[99999]" style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="modal-box max-w-lg rounded-3xl p-6 sm:p-8 border-2 border-primary/30 shadow-2xl bg-base-100 text-base-content animate-fade-in relative overflow-hidden">
        {/* Nền trang trí nhẹ */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
            <MapPin className="w-7 h-7 text-primary animate-bounce" />
          </div>
          <div>
            <h3 className="font-black text-lg sm:text-xl text-base-content leading-tight">
              📍 Yêu Cầu Quyền Truy Cập Vị Trí
            </h3>
            <p className="text-xs text-base-content/60 font-medium mt-0.5">
              Hệ thống Bảo Mật & Cá Nhân Hóa Huy Locket
            </p>
          </div>
        </div>

        <p className="text-sm text-base-content/80 font-medium mb-5 leading-relaxed">
          <strong>Huy Locket</strong> mong muốn được sự cho phép của bạn để tiếp cận tọa độ vị trí (GPS) hiện tại với 2 mục đích an toàn:
        </p>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-base-200/70 border border-base-300">
            <Shield className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-base-content uppercase tracking-wider">🛡️ Bảo Mật Tài Khoản Cấp Độ Hạt Nhân</h4>
              <p className="text-xs text-base-content/70 mt-1 leading-normal">
                Ghi nhận tọa độ an toàn. Hệ thống lập tức cảnh báo nếu phát hiện tài khoản đăng nhập từ vị trí xa lạ hoặc quốc gia khác.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-base-200/70 border border-base-300">
            <CloudRain className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-base-content uppercase tracking-wider">🌦️ Trải Nghiệm Locket Chuẩn Xác</h4>
              <p className="text-xs text-base-content/70 mt-1 leading-normal">
                Tự động gắn chính xác nhãn dán thời tiết, nhiệt độ địa phương và vị trí kiểm duyệt khi bạn gửi ảnh Locket cho bạn bè.
              </p>
            </div>
          </div>
        </div>

        <div className="alert alert-info/10 border border-info/20 rounded-2xl p-3 mb-6 text-xs text-base-content/80 font-semibold flex items-center gap-2">
          <span>💡 Quyền truy cập là hoàn toàn tự nguyện, chỉ sử dụng để phục vụ an ninh cho chính tài khoản của bạn.</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={handleGrant}
            disabled={loading}
            className="btn btn-primary flex-1 font-black text-primary-content rounded-xl shadow-lg h-12 text-sm gap-2"
          >
            {loading ? <span className="loading loading-spinner loading-sm" /> : <CheckCircle className="w-4 h-4" />}
            🟢 Đồng ý cho phép
          </button>
          <button
            type="button"
            onClick={handleDeny}
            disabled={loading}
            className="btn btn-ghost border border-base-300 font-bold text-base-content/70 hover:bg-base-200 rounded-xl h-12 text-sm px-6 gap-1.5"
          >
            <XCircle className="w-4 h-4 text-base-content/50" />
            Không, cảm ơn
          </button>
        </div>
      </div>
    </div>
  );
}
