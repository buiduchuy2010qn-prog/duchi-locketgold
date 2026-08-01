/**
 * Generate Huy Locket Open Graph Banner (1200x630) for Social Media sharing (Zalo, Telegram, FB)
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const sharp = require("../api/node_modules/sharp");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function buildOgSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff1e6b"/>
      <stop offset="45%" stop-color="#9215df"/>
      <stop offset="100%" stop-color="#3d097c"/>
    </linearGradient>

    <!-- Underline Glow Gradient -->
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff6ec7"/>
      <stop offset="50%" stop-color="#ff2e93"/>
      <stop offset="100%" stop-color="#ff6ec7"/>
    </linearGradient>

    <!-- Call-to-Action Button Gradient -->
    <linearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff0844"/>
      <stop offset="50%" stop-color="#ff4e50"/>
      <stop offset="100%" stop-color="#f9d423"/>
    </linearGradient>
  </defs>

  <!-- Vibrant Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative Bokeh / Light Spheres -->
  <circle cx="100" cy="80" r="340" fill="rgba(255,255,255,0.08)"/>
  <circle cx="100" cy="80" r="230" fill="rgba(255,255,255,0.07)"/>
  <circle cx="1120" cy="550" r="400" fill="rgba(255,255,255,0.06)"/>
  <circle cx="1120" cy="550" r="260" fill="rgba(255,255,255,0.05)"/>
  <circle cx="980" cy="120" r="160" fill="rgba(255,180,220,0.12)"/>
  <circle cx="200" cy="520" r="180" fill="rgba(150,100,255,0.15)"/>

  <!-- Main Glassmorphic Container -->
  <rect x="70" y="50" width="1060" height="530" rx="36" fill="rgba(0, 0, 0, 0.42)" stroke="rgba(255, 255, 255, 0.45)" stroke-width="3"/>
  <rect x="75" y="55" width="1050" height="520" rx="32" fill="none" stroke="rgba(255, 150, 220, 0.28)" stroke-width="2"/>

  <!-- Top Pill Badge -->
  <rect x="410" y="85" width="380" height="42" rx="21" fill="rgba(255, 255, 255, 0.18)" stroke="rgba(255, 255, 255, 0.6)" stroke-width="1.5"/>
  <text x="600" y="113" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="18" fill="#ffffff" letter-spacing="1">✨ MIỄN PHÍ &amp; GIAO DIỆN CỰC CHẤT ✨</text>

  <!-- Main Brand Title -->
  <text x="600" y="205" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="900" font-size="82" fill="#ffffff" letter-spacing="4">HUY LOCKET</text>

  <!-- Glowing Title Divider Bar -->
  <rect x="450" y="230" width="300" height="6" rx="3" fill="url(#barGrad)"/>

  <!-- Subtitle -->
  <text x="600" y="288" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="36" fill="#ffeef7">Đăng Ảnh &amp; Video Lên Locket Cực Nhanh</text>

  <!-- Feature Highlights (Left & Right Boxes) -->
  <rect x="130" y="330" width="455" height="95" rx="18" fill="rgba(255, 255, 255, 0.09)" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1"/>
  <text x="165" y="368" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="22" fill="#00ffff">★ Trải Nghiệm Trực Tiếp Trên Web</text>
  <text x="165" y="402" font-family="Segoe UI, Arial, sans-serif" font-weight="500" font-size="18" fill="#e0f7ff">Không cần tải app • Giao diện siêu mượt</text>

  <rect x="615" y="330" width="455" height="95" rx="18" fill="rgba(255, 255, 255, 0.09)" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1"/>
  <text x="650" y="368" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="22" fill="#ffb74d">★ Kho Caption &amp; Màu Sắc Độc Quyền</text>
  <text x="650" y="402" font-family="Segoe UI, Arial, sans-serif" font-weight="500" font-size="18" fill="#fff3e0">Tùy biến cá nhân • Sao lưu Google Drive</text>

  <!-- Bottom Call-to-Action Button -->
  <rect x="340" y="460" width="520" height="64" rx="32" fill="url(#ctaGrad)" stroke="rgba(255,255,255,0.85)" stroke-width="2"/>
  <text x="600" y="502" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="26" fill="#ffffff" letter-spacing="1">👉 Bắt đầu với duchi.vercel.app 👈</text>

  <!-- Footer Credit -->
  <text x="600" y="554" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="16" fill="rgba(255,255,255,0.65)">Huy Locket • Bản quyền độc lập phát triển bởi Bùi Đức Huy</text>
</svg>`;
}

async function generate() {
  const targets = [
    "public/images/og-huy-locket.png",
    "dist/images/og-huy-locket.png",
    "vercel-static/images/og-huy-locket.png"
  ];

  const svgContent = buildOgSvg();
  const buffer = Buffer.from(svgContent, "utf-8");

  for (const rel of targets) {
    const outPath = path.join(root, rel);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir) && !rel.startsWith("public/")) {
      console.log("[skip]", rel);
      continue;
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await sharp(buffer).png().toFile(outPath);
    console.log("[og-banner] Saved:", outPath);
  }
  console.log("[og-banner] SUCCESS! Huy Locket social sharing banners generated.");
}

generate().catch((err) => {
  console.error("Error generating OG banner:", err);
  process.exit(1);
});
