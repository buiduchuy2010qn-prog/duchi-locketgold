const ze = {
  love: { colors: ["#FF6B9D", "#D81B60"], text_color: "#FFFFFF" },
  miss: { colors: ["#A78BFA", "#6366F1"], text_color: "#FFFFFF" },
  thanks: { colors: ["#FBBF24", "#F59E0B"], text_color: "#3D2800" },
  sorry: { colors: ["#C4B5FD", "#93C5FD"], text_color: "#2A2A4A" },
  daily: { colors: ["#F9A8D4", "#93C5FD"], text_color: "#2D2A32" },
  anime: { colors: ["#F472B6", "#A78BFA"], text_color: "#FFFFFF" },
};

const oldItems = [
  {id:"jp_love_best",ja:"恋って最高",vi:"Yêu đương thật tuyệt",emoji:"💗",category:"love"},
  {id:"jp_very_happy",ja:"幸せすぎる",vi:"Hạnh phúc quá",emoji:"🥰",category:"love"},
  {id:"jp_love_you",ja:"大好きだよ",vi:"Yêu anh/em nhiều lắm",emoji:"💕",category:"love"},
  {id:"jp_deep_love",ja:"愛してる",vi:"Yêu anh/em",emoji:"❤️",category:"love"},
  {id:"jp_together",ja:"ずっと一緒にいよう",vi:"Mình mãi bên nhau nhé",emoji:"🫶",category:"love"},
  {id:"jp_only_you",ja:"君だけ",vi:"Chỉ mình anh/em thôi",emoji:"💘",category:"love"},
  {id:"jp_good_feeling",ja:"気持ちいい",vi:"Cảm giác thật tuyệt",emoji:"☺️",category:"love"},
  {id:"jp_miss_you",ja:"君が恋しい",vi:"Anh nhớ em / Em nhớ anh",emoji:"🥺",category:"miss"},
  {id:"jp_want_to_meet",ja:"会いたい",vi:"Muốn gặp anh/em",emoji:"💭",category:"miss"},
  {id:"jp_meet_now",ja:"今すぐ会いたい",vi:"Muốn gặp anh/em ngay bây giờ",emoji:"😭",category:"miss"},
  {id:"jp_stay_with_me",ja:"そばにいて",vi:"Hãy ở bên anh/em",emoji:"🫂",category:"miss"},
  {id:"jp_thinking_you",ja:"君のことを考えてる",vi:"Đang nghĩ về anh/em",emoji:"💌",category:"miss"},
  {id:"jp_thank_you",ja:"ありがとう",vi:"Cảm ơn",emoji:"🌷",category:"thanks"},
  {id:"jp_thank_you_very_much",ja:"本当にありがとう",vi:"Thật sự cảm ơn rất nhiều",emoji:"💝",category:"thanks"},
  {id:"jp_sorry",ja:"ごめんね",vi:"Xin lỗi nhé",emoji:"🥹",category:"sorry"},
  {id:"jp_very_sorry",ja:"本当にごめんなさい",vi:"Thật sự xin lỗi",emoji:"🙇",category:"sorry"},
  {id:"jp_forgive_me",ja:"許してね",vi:"Tha lỗi cho anh/em nhé",emoji:"🙏",category:"sorry"},
  {id:"jp_good_morning",ja:"おはよう",vi:"Chào buổi sáng",emoji:"☀️",category:"daily"},
  {id:"jp_good_night",ja:"おやすみ",vi:"Ngủ ngon",emoji:"🌙",category:"daily"},
  {id:"jp_try_your_best",ja:"がんばって",vi:"Cố gắng lên nhé",emoji:"✨",category:"daily"},
  {id:"jp_good_job",ja:"お疲れさま",vi:"Hôm nay vất vả rồi",emoji:"🍵",category:"daily"},
  {id:"jp_anime_sugoi",ja:"す、すごい〜！！",romaji:"s-sugoiii!!~",vi:"T-tuyệt quá!!~",emoji:"🤩",category:"anime"},
  {id:"jp_anime_baka",ja:"ば、ばか〜！！",romaji:"b-baka!!~",vi:"Đ-đồ ngốc!!~",emoji:"😤",category:"anime"},
  {id:"jp_anime_onii_chan",ja:"お兄ちゃん〜〜",romaji:"onii-chan~~",vi:"Anh trai ơi~~",emoji:"🥺",category:"anime"},
  {id:"jp_anime_konnichiwa",ja:"こ、こんにちは〜〜",romaji:"k-konnichiwa~~",vi:"X-xin chào~~",emoji:"👋",category:"anime"}
];

const mapOldItem = (item) => {
  const style = ze[item.category] || ze.daily;
  const text = (item.ja || "").trim();
  return {
    id: item.id,
    text: text,
    vi_label: item.vi || "",
    romaji_label: item.romaji || "",
    type: "decorative",
    background: { colors: [style.colors[0], style.colors[1] || style.colors[0]] },
    text_color: style.text_color,
    icon: item.emoji ? { type: "emoji", data: item.emoji } : null,
  };
};

const Ii = [
  {section_id:"jp_caption_love",name:"🇯🇵 Tình yêu",badge:"JP",categories:["love"],order_id:10},
  {section_id:"jp_caption_miss",name:"🇯🇵 Nhớ nhung",badge:"JP",categories:["miss"],order_id:11},
  {section_id:"jp_caption_thanks_sorry",name:"🇯🇵 Cảm ơn và xin lỗi",badge:"JP",categories:["thanks","sorry"],order_id:12},
  {section_id:"jp_caption_daily",name:"🇯🇵 Hằng ngày",badge:"JP",categories:["daily"],order_id:13},
  {section_id:"jp_caption_anime",name:"🇯🇵 Anime",badge:"JP",categories:["anime"],order_id:14}
];

const oldSections = Ii.map((section) => {
  const items = oldItems
    .filter((item) => section.categories.includes(item.category))
    .map(mapOldItem);
  return {
    section_id: section.section_id,
    name: section.name,
    badge: section.badge,
    items: items,
  };
});

const newSections = [
  {
    section_id: "japanese_presets",
    name: "🇯🇵 Tiếng Nhật (Mới)",
    badge: "Hot",
    items: [
      {
        id: "jp_ohayou_new",
        text: "おはよう ☀️",
        vi_label: "Chào buổi sáng",
        romaji_label: "Ohayou",
        type: "decorative",
        background: { colors: ["#FF9A9E", "#FECFEF"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_oyasumi_new",
        text: "おやすみ 🌙",
        vi_label: "Chúc ngủ ngon",
        romaji_label: "Oyasumi",
        type: "decorative",
        background: { colors: ["#2c3e50", "#3498db"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_arigatou_new",
        text: "ありがとう 🌸",
        vi_label: "Cảm ơn",
        romaji_label: "Arigatou",
        type: "decorative",
        background: { colors: ["#a18cd1", "#fbc2eb"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_kawaii_new",
        text: "かわいい 🎀",
        vi_label: "Dễ thương",
        romaji_label: "Kawaii",
        type: "decorative",
        background: { colors: ["#ff9a9e", "#fecfef"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_ganbatte_new",
        text: "がんばって 💪",
        vi_label: "Cố lên",
        romaji_label: "Ganbatte",
        type: "decorative",
        background: { colors: ["#f6d365", "#fda085"] },
        text_color: "#FFFFFF",
      },
      {
        id: "jp_daisuki_new",
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

export const buildJapaneseCaptionSections = () => [...oldSections, ...newSections];

export const toJapanesePayloadCaption = (item) => {
  const payload = { ...item };
  delete payload.vi_label;
  delete payload.romaji_label;
  payload.overlay_id = payload.id || payload.overlay_id;
  return payload;
};
