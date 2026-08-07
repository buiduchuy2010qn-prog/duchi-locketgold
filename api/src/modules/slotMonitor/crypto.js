const crypto = require("crypto");

function getEncryptionKey() {
  const secret = String(
    process.env.SLOT_MONITOR_ENCRYPTION_KEY ||
      process.env.COOKIE_SECRET ||
      process.env.JWT_SECRET ||
      process.env.LOCKETDIO_JWT_SECRET ||
      "",
  ).trim();

  if (secret.length < 16) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(value) {
  const key = getEncryptionKey();
  if (!key) {
    const error = new Error("Slot Monitor encryption key is not configured");
    error.code = "SLOT_ENCRYPTION_UNAVAILABLE";
    throw error;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value || ""), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptSecret(payload) {
  const key = getEncryptionKey();
  if (!key) {
    const error = new Error("Slot Monitor encryption key is not configured");
    error.code = "SLOT_ENCRYPTION_UNAVAILABLE";
    throw error;
  }

  const [ivPart, tagPart, dataPart] = String(payload || "").split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid encrypted Slot Monitor session");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = {
  getEncryptionKey,
  encryptSecret,
  decryptSecret,
};
