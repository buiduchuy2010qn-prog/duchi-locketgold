function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDate(date) {
  return `${pad(date.getDate())} Thg ${pad(
    date.getMonth() + 1
  )} ${date.getFullYear()}`;
}

/**
 * Trả về: "Ng dd Thg mm yyyy -> Ng dd Thg mm yyyy"
 * ISO week (Thứ 2 → Chủ nhật) theo local timezone
 */
export function getWeekRange(week, year) {
  // Tìm ngày 4 tháng 1 của năm (luôn nằm trong tuần 1 theo chuẩn ISO 8601)
  const jan4 = new Date(year, 0, 4);
  const dayNum = jan4.getDay() || 7;
  
  // Tính ngày Thứ 2 của tuần 1
  const week1Monday = new Date(year, 0, 4 - (dayNum - 1));
  
  // Tính ngày Thứ 2 của tuần `week`
  const start = new Date(week1Monday);
  start.setDate(week1Monday.getDate() + (week - 1) * 7);
  
  // Ngày Chủ nhật
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return `${formatDate(start)} -> ${formatDate(end)}`;
}

/**
 * Lấy ISO week number (Thứ 2 → CN) theo múi giờ local
 */
export function getISOWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Đưa về đầu ngày theo local

  // Tìm ngày thứ 5 của tuần chứa ngày d
  // ISO: Thứ 2 = 1, Chủ Nhật = 7
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);

  // Năm chứa ngày thứ 5 đó
  const year = d.getFullYear();

  // Ngày 1/1 của năm đó
  const yearStart = new Date(year, 0, 1);

  // Số ngày từ 1/1 đến ngày thứ 5
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  return { week, year };
}

export function listWeeksOfYear(year = new Date().getFullYear()) {
  const now = new Date();
  const { week: currentWeek, year: currentYear } = getISOWeek(now);

  // Nếu là năm hiện tại → chỉ list tới tuần hiện tại
  // Nếu là năm quá khứ → list full năm
  const lastWeek =
    year === currentYear
      ? currentWeek
      : getISOWeek(new Date(year, 11, 28)).week;

  return Array.from({ length: lastWeek }, (_, i) => {
    const week = i + 1;
    return {
      week,
      year,
      label: getWeekRange(week, year),
    };
  });
}
