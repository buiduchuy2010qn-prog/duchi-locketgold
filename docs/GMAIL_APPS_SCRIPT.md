# Gmail thật cho Huy Locket qua Google Apps Script

Railway Trial/Free/Hobby chặn outbound SMTP, vì vậy Huy Locket gửi Gmail qua HTTPS đến một Google Apps Script Web App chạy bằng tài khoản Gmail của Duchi Locket.

## Apps Script

Tạo project tại Google Apps Script bằng đúng tài khoản Gmail sẽ dùng để gửi mail, rồi dán mã sau vào `Code.gs`:

```javascript
function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function hashKey(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ""),
    Utilities.Charset.UTF_8,
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 100);
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const expectedSecret = PropertiesService
      .getScriptProperties()
      .getProperty("HUY_LOCKET_MAIL_SECRET");

    if (!expectedSecret || String(data.secret || "") !== expectedSecret) {
      return jsonResponse({ ok: false, code: "UNAUTHORIZED", message: "Unauthorized" });
    }

    const to = String(data.to || "").trim().toLowerCase();
    const subject = String(data.subject || "Huy Locket").slice(0, 200);
    const text = String(data.text || "").slice(0, 20000);
    const html = String(data.html || "").slice(0, 50000);
    const fromName = String(data.fromName || "Duchi Locket").slice(0, 120);
    const idempotencyKey = String(data.idempotencyKey || "").slice(0, 240);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return jsonResponse({ ok: false, code: "INVALID_EMAIL", message: "Invalid email" });
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = idempotencyKey ? `mail:${hashKey(idempotencyKey)}` : "";
    if (cacheKey && cache.get(cacheKey)) {
      return jsonResponse({ ok: true, deduped: true });
    }

    GmailApp.sendEmail(to, subject, text || "Huy Locket notification", {
      htmlBody: html || undefined,
      name: fromName,
    });

    if (cacheKey) cache.put(cacheKey, "1", 21600);
    return jsonResponse({ ok: true, deduped: false });
  } catch (error) {
    return jsonResponse({
      ok: false,
      code: "SEND_FAILED",
      message: String(error && error.message ? error.message : error).slice(0, 500),
    });
  }
}
```

## Cấu hình secret

Trong Apps Script mở **Project Settings > Script Properties** và thêm:

- Property: `HUY_LOCKET_MAIL_SECRET`
- Value: một chuỗi ngẫu nhiên dài, chỉ dùng cho Huy Locket.

## Deploy Web App

Chọn **Deploy > New deployment > Web app**:

- Execute as: **Me**
- Who has access: **Anyone**

Copy URL kết thúc bằng `/exec`.

## Railway Variables

Đặt trên service `huy-locket-api`:

```env
GMAIL_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
GMAIL_APPS_SCRIPT_SECRET=...
GMAIL_FROM_NAME=Duchi Locket
```

Không đưa secret vào frontend, Vercel hoặc GitHub.
