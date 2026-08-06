import { useTheme } from "@/hooks/useTheme";

export default function BgHuyLocket({ bgSrc }) {
  const { perfMode } = useTheme();

  if (!bgSrc) return null;

  const isVideo = bgSrc.endsWith(".mp4") || bgSrc.endsWith(".webm");

  // Video nền chạy liên tục tốn GPU/RAM nhất trên Android máy yếu.
  // Giữ màu nền của theme thay vì phát video khi bật chế độ lite.
  if (isVideo && perfMode === "lite") return null;

  if (isVideo) {
    return (
      <video
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src={bgSrc} type="video/mp4" />
      </video>
    );
  }

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgSrc})` }}
    />
  );
}
