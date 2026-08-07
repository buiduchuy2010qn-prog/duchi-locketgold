import React, { useEffect, useState } from "react";
import { Mail, MessageCircle, Save, Send } from "lucide-react";
import {
  fetchSlotNotificationSettings,
  saveSlotNotificationSettings,
  testSlotNotificationChannel,
} from "./slotNotificationService";

const EMPTY = {
  telegramChatId: "",
  telegramEnabled: false,
  emailAddress: "",
  emailEnabled: false,
  zaloUserId: "",
  zaloEnabled: false,
  providers: {
    telegram: { configured: false, botUsername: "" },
    email: { configured: false },
    zalo: { configured: false },
  },
};

function ChannelStatus({ configured }) {
  return (
    <span className={`badge badge-sm ${configured ? "badge-success" : "badge-warning"}`}>
      {configured ? "Server sẵn sàng" : "Chưa cấu hình server"}
    </span>
  );
}

export default function SlotNotificationSettings() {
  const [settings, setSettings] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSlotNotificationSettings()
      .then((data) => {
        if (!cancelled && data) setSettings({ ...EMPTY, ...data });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.response?.data?.message || "Chưa tải được cài đặt kênh thông báo.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = await saveSlotNotificationSettings(settings);
      setSettings((current) => ({ ...current, ...saved }));
      setMessage("Đã lưu 3 kênh thông báo.");
    } catch (err) {
      setError(err?.response?.data?.message || "Không lưu được cài đặt thông báo.");
    } finally {
      setSaving(false);
    }
  };

  const test = async (channel) => {
    setTesting(channel);
    setMessage("");
    setError("");
    try {
      const saved = await saveSlotNotificationSettings(settings);
      setSettings((current) => ({ ...current, ...saved }));
      await testSlotNotificationChannel(channel);
      setMessage(`Đã gửi thử qua ${channel === "email" ? "Gmail/Email" : channel === "telegram" ? "Telegram" : "Zalo"}.`);
    } catch (err) {
      setError(err?.response?.data?.message || "Không gửi được thông báo thử.");
    } finally {
      setTesting("");
    }
  };

  if (loading) {
    return (
      <section className="mt-4 rounded-2xl border border-base-300 bg-base-200/35 p-4">
        <span className="loading loading-spinner loading-sm" />
        <span className="ml-2 text-sm text-base-content/60">Đang tải kênh thông báo...</span>
      </section>
    );
  }

  const telegramConfigured = Boolean(settings.providers?.telegram?.configured);
  const emailConfigured = Boolean(settings.providers?.email?.configured);
  const zaloConfigured = Boolean(settings.providers?.zalo?.configured);
  const botUsername = settings.providers?.telegram?.botUsername || "";

  return (
    <section className="mt-4 rounded-2xl border border-base-300 bg-base-200/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">Kênh báo khi Celeb mở slot</h2>
          <p className="text-xs text-base-content/55">
            Có thể bật đồng thời Telegram, Gmail và Zalo. Railway sẽ gửi ngay khi phát hiện slot trống.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
          Lưu
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <article className="rounded-xl border border-base-300 bg-base-100 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <Send size={17} /> Telegram
            </div>
            <ChannelStatus configured={telegramConfigured} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={Boolean(settings.telegramEnabled)}
              onChange={(event) => update("telegramEnabled", event.target.checked)}
            />
            Bật Telegram
          </label>
          <input
            className="input input-bordered input-sm mt-3 w-full"
            inputMode="numeric"
            placeholder="Telegram Chat ID"
            value={settings.telegramChatId || ""}
            onChange={(event) => update("telegramChatId", event.target.value)}
          />
          <p className="mt-2 text-[11px] text-base-content/50">
            {botUsername ? `Nhắn /start cho @${botUsername}, rồi dùng Chat ID của bạn.` : "Cần Bot Token + Chat ID. Bước tiếp theo sẽ làm kết nối Telegram tự động."}
          </p>
          <button
            className="btn btn-ghost btn-xs mt-3"
            disabled={!telegramConfigured || !settings.telegramChatId || testing === "telegram"}
            onClick={() => test("telegram")}
          >
            {testing === "telegram" ? <span className="loading loading-spinner loading-xs" /> : <MessageCircle size={13} />}
            Gửi thử
          </button>
        </article>

        <article className="rounded-xl border border-base-300 bg-base-100 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <Mail size={17} /> Gmail
            </div>
            <ChannelStatus configured={emailConfigured} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={Boolean(settings.emailEnabled)}
              onChange={(event) => update("emailEnabled", event.target.checked)}
            />
            Bật Gmail
          </label>
          <input
            type="email"
            className="input input-bordered input-sm mt-3 w-full"
            placeholder="tenban@gmail.com"
            value={settings.emailAddress || ""}
            onChange={(event) => update("emailAddress", event.target.value)}
          />
          <p className="mt-2 text-[11px] text-base-content/50">
            Gửi từ Gmail thật của Duchi Locket qua Google Apps Script. URL và secret chỉ nằm trên Railway, không lưu ở trình duyệt.
          </p>
          <button
            className="btn btn-ghost btn-xs mt-3"
            disabled={!emailConfigured || !settings.emailAddress || testing === "email"}
            onClick={() => test("email")}
          >
            {testing === "email" ? <span className="loading loading-spinner loading-xs" /> : <Mail size={13} />}
            Gửi thử
          </button>
        </article>

        <article className="rounded-xl border border-base-300 bg-base-100 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <MessageCircle size={17} /> Zalo
            </div>
            <ChannelStatus configured={zaloConfigured} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={Boolean(settings.zaloEnabled)}
              onChange={(event) => update("zaloEnabled", event.target.checked)}
            />
            Bật Zalo
          </label>
          <input
            className="input input-bordered input-sm mt-3 w-full"
            inputMode="numeric"
            placeholder="Zalo User ID"
            value={settings.zaloUserId || ""}
            onChange={(event) => update("zaloUserId", event.target.value)}
          />
          <p className="mt-2 text-[11px] text-base-content/50">
            Dùng Zalo Official Account API. Người nhận phải đủ điều kiện nhận tin theo chính sách Zalo OA.
          </p>
          <button
            className="btn btn-ghost btn-xs mt-3"
            disabled={!zaloConfigured || !settings.zaloUserId || testing === "zalo"}
            onClick={() => test("zalo")}
          >
            {testing === "zalo" ? <span className="loading loading-spinner loading-xs" /> : <MessageCircle size={13} />}
            Gửi thử
          </button>
        </article>
      </div>

      {message && <p className="mt-3 text-xs text-success">{message}</p>}
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </section>
  );
}
