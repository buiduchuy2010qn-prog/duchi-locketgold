class IdolValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IdolValidationError";
    this.code = code;
    this.status = 400;
  }
}

function cleanText(value, maxLength, fieldName) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new IdolValidationError("INVALID_FIELD", `${fieldName} không hợp lệ.`);
  }
  const cleaned = value.trim();
  const hasControlCharacter = Array.from(cleaned).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
  if (
    cleaned.length > maxLength ||
    hasControlCharacter ||
    cleaned.includes("<") ||
    cleaned.includes(">")
  ) {
    throw new IdolValidationError("INVALID_FIELD", `${fieldName} không hợp lệ.`);
  }
  return cleaned;
}

function normalizeLocketProfileUrl(rawUrl) {
  const input = cleanText(rawUrl, 500, "Liên kết Locket");
  if (!input) {
    throw new IdolValidationError(
      "LOCKET_URL_REQUIRED",
      "Vui lòng nhập liên kết Locket.",
    );
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new IdolValidationError(
      "INVALID_LOCKET_URL",
      "Liên kết Locket không hợp lệ.",
    );
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "locket.cam" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new IdolValidationError(
      "INVALID_LOCKET_URL",
      "Chỉ chấp nhận liên kết hồ sơ https://locket.cam hợp lệ.",
    );
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) {
    throw new IdolValidationError(
      "INVALID_LOCKET_URL",
      "Liên kết phải trỏ trực tiếp tới một hồ sơ Locket.",
    );
  }

  let username;
  try {
    username = decodeURIComponent(segments[0]);
  } catch {
    throw new IdolValidationError(
      "INVALID_LOCKET_URL",
      "Username trong liên kết không hợp lệ.",
    );
  }

  if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) {
    throw new IdolValidationError(
      "INVALID_LOCKET_USERNAME",
      "Username trong liên kết không hợp lệ.",
    );
  }

  const normalizedUsername = username.toLowerCase();
  return {
    locketUrl: `https://locket.cam/${username}`,
    normalizedUrl: `https://locket.cam/${normalizedUsername}`,
    username,
    normalizedUsername,
  };
}

function normalizeIdolInput(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new IdolValidationError("INVALID_REQUEST", "Dữ liệu không hợp lệ.");
  }

  const link = normalizeLocketProfileUrl(payload.locketUrl);
  const suppliedUsername = cleanText(payload.username, 64, "Username");
  if (
    suppliedUsername &&
    suppliedUsername.replace(/^@/, "").toLowerCase() !== link.normalizedUsername
  ) {
    throw new IdolValidationError(
      "USERNAME_MISMATCH",
      "Username không khớp với liên kết Locket.",
    );
  }

  const displayName = cleanText(payload.displayName, 120, "Tên hiển thị");
  const rawCountry = cleanText(payload.countryCode, 8, "Mã quốc gia");
  const countryCode = (rawCountry || "OTHER").toUpperCase();
  if (!/^[A-Z0-9_-]{2,8}$/.test(countryCode)) {
    throw new IdolValidationError(
      "INVALID_COUNTRY",
      "Mã quốc gia không hợp lệ.",
    );
  }

  const sortOrder = payload.sortOrder === undefined ? 0 : Number(payload.sortOrder);
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) {
    throw new IdolValidationError(
      "INVALID_SORT_ORDER",
      "Thứ tự hiển thị không hợp lệ.",
    );
  }

  if (payload.enabled !== undefined && typeof payload.enabled !== "boolean") {
    throw new IdolValidationError(
      "INVALID_ENABLED",
      "Trạng thái hiển thị không hợp lệ.",
    );
  }

  return {
    ...link,
    displayName,
    countryCode,
    sortOrder,
    enabled: payload.enabled === undefined ? true : payload.enabled,
  };
}

module.exports = {
  IdolValidationError,
  normalizeIdolInput,
  normalizeLocketProfileUrl,
};
