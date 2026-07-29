export const buildJapaneseCaptionSections = () => [
  {
    section_id: "japanese_presets",
    name: "🇯🇵 Tiếng Nhật",
    badge: "Hot",
    items: [
      {
        id: "jp_ohayou",
        text: "おはよう ☀️",
        vi_label: "Chào buổi sáng",
        romaji_label: "Ohayou",
        type: "decorative",
        background: { colors: ["#FF9A9E", "#FECFEF"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_oyasumi",
        text: "おやすみ 🌙",
        vi_label: "Chúc ngủ ngon",
        romaji_label: "Oyasumi",
        type: "decorative",
        background: { colors: ["#2c3e50", "#3498db"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_arigatou",
        text: "ありがとう 🌸",
        vi_label: "Cảm ơn",
        romaji_label: "Arigatou",
        type: "decorative",
        background: { colors: ["#a18cd1", "#fbc2eb"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_kawaii",
        text: "かわいい 🎀",
        vi_label: "Dễ thương",
        romaji_label: "Kawaii",
        type: "decorative",
        background: { colors: ["#ff9a9e", "#fecfef"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_ganbatte",
        text: "がんばって 💪",
        vi_label: "Cố lên",
        romaji_label: "Ganbatte",
        type: "decorative",
        background: { colors: ["#f6d365", "#fda085"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_daisuki",
        text: "だいすき 💖",
        vi_label: "Thích lắm",
        romaji_label: "Daisuki",
        type: "decorative",
        background: { colors: ["#ff0844", "#ffb199"] },
        text_color: "#FFFFFF",
      },
    ],
  },
  {
    section_id: "korean_presets",
    name: "🇰🇷 Tiếng Hàn",
    badge: "New",
    items: [
      {
        id: "kr_annyeong",
        text: "안녕 👋",
        vi_label: "Xin chào",
        romaji_label: "Annyeong",
        type: "decorative",
        background: { colors: ["#84fab0", "#8fd3f4"] },
        text_color: "#FFFFFF",
      },
      {
        id: "kr_saranghae",
        text: "사랑해 🫰",
        vi_label: "Mình yêu cậu",
        romaji_label: "Saranghae",
        type: "decorative",
        background: { colors: ["#fccb90", "#d57eeb"] },
        text_color: "#FFFFFF",
      },
      {
        id: "kr_hwaiting",
        text: "화이팅 🔥",
        vi_label: "Cố lên",
        romaji_label: "Hwaiting",
        type: "decorative",
        background: { colors: ["#e0c3fc", "#8ec5fc"] },
        text_color: "#FFFFFF",
      },
      {
        id: "kr_daebak",
        text: "대박 ✨",
        vi_label: "Đỉnh quá",
        romaji_label: "Daebak",
        type: "decorative",
        background: { colors: ["#4facfe", "#00f2fe"] },
        text_color: "#FFFFFF",
      },
    ],
  }
];

export const toJapanesePayloadCaption = (item) => {
  const payload = { ...item };
  delete payload.vi_label;
  delete payload.romaji_label;
  payload.overlay_id = payload.id || payload.overlay_id;
  return payload;
};
