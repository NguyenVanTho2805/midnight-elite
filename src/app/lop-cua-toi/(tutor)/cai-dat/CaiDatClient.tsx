"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { callApi, useNotify } from "@/components/tutor/shared";
import { OPTIONAL_TUTOR_MODULES, TUTOR_MODULES, applyPreferencesPatch, reminderChannels, type UserPreferences, type OptionalTutorModule } from "@/lib/userPreferences";

const CARD = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" } as const;

function Switch({ id, checked, disabled, busy, onChange, label, hint }: { id: string; checked: boolean; disabled?: boolean; busy?: boolean; onChange?: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 py-3 min-h-[44px]" style={{ cursor: disabled ? "default" : "pointer" }}>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled || busy} onChange={e => onChange?.(e.target.checked)}
        className="mt-1 w-5 h-5 flex-shrink-0" style={{ accentColor: "var(--kin-nhan-nen)" }} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>
          {label}{disabled && <span className="ml-2 text-xs font-normal" style={{ color: "var(--kin-chu-phu)" }}>(luôn bật)</span>}
        </span>
        <span className="block text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{hint}</span>
      </span>
    </label>
  );
}

export default function CaiDatClient({ initial }: { initial: UserPreferences }) {
  const router = useRouter();
  const notify = useNotify();
  const [prefs, setPrefs] = useState<UserPreferences>(initial);
  const [busy, setBusy] = useState(false);
  const modules = prefs.modules ?? [];
  const channels = reminderChannels(prefs);

  async function save(patch: Record<string, unknown>, okMsg: string) {
    if (busy) return;
    const before = prefs;
    // Cập nhật ngay trên màn hình (công tắc không bị trễ theo mạng); lỗi thì trả về như cũ.
    const guess = applyPreferencesPatch(prefs, patch);
    if (guess.ok) setPrefs(guess.value);
    setBusy(true);
    const r = await callApi<{ preferences?: UserPreferences }>("/api/users/me/preferences", { method: "PUT", body: JSON.stringify(patch) });
    setBusy(false);
    if (!r.ok || !r.data.preferences) { setPrefs(before); notify.err(r.data.error ?? "Không lưu được, thử lại"); return; }
    setPrefs(r.data.preferences);
    notify.ok(okMsg);
    router.refresh(); // vỏ gia sư (thanh module) đọc lại lựa chọn mới
  }

  const toggleModule = (key: OptionalTutorModule, on: boolean) => {
    const next = on ? [...modules, key] : modules.filter(m => m !== key);
    void save({ modules: next }, on ? "Đã bật module — xem ở thanh bên." : "Đã ẩn module khỏi thanh bên. Dữ liệu vẫn giữ nguyên.");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Cài đặt</h1>
        <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>Lưu theo tài khoản của bạn, đăng nhập ở máy nào cũng giống nhau.</p>
      </header>

      <section id="module" aria-labelledby="h-module" className="rounded-xl p-4" style={CARD}>
        <h2 id="h-module" className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Module hiển thị</h2>
        <p className="text-xs mt-1 mb-2" style={{ color: "var(--kin-chu-phu)" }}>
          Tắt module chỉ là ẩn khỏi thanh bên — dữ liệu giữ nguyên, bật lại là thấy đủ. Khi Hộp việc đang tắt, việc cần xử lý hiện thành chấm trên đúng buổi trong Lịch.
        </p>
        <div className="divide-y" style={{ borderColor: "var(--kin-vien-thuong)" }}>
          {TUTOR_MODULES.filter(m => m.always).map(m => <Switch key={m.key} id={`m-${m.key}`} checked disabled label={m.label} hint={m.hint} />)}
          {TUTOR_MODULES.filter(m => !m.always).map(m => (
            <Switch key={m.key} id={`m-${m.key}`} checked={modules.includes(m.key as OptionalTutorModule)}
              onChange={v => toggleModule(m.key as OptionalTutorModule, v)} label={m.label} hint={m.hint} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">{modules.length} module tuỳ chọn đang bật trên {OPTIONAL_TUTOR_MODULES.length}</p>
      </section>

      <section aria-labelledby="h-nhac" className="rounded-xl p-4" style={CARD}>
        <h2 id="h-nhac" className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Nhắc lịch</h2>
        <p className="text-xs mt-1 mb-2" style={{ color: "var(--kin-chu-phu)" }}>
          Nhắc trước 24 giờ và trước 1 giờ mỗi buổi, không gửi trong giờ yên lặng 22:00–07:00. Tin soạn sẵn ở trang Lịch — bạn bấm một lần để mở Zalo và tự bấm gửi (KiN không dùng bot trên Zalo cá nhân).
        </p>
        <div className="divide-y" style={{ borderColor: "var(--kin-vien-thuong)" }}>
          <Switch id="r-parent" checked={channels.parent} onChange={v => void save({ reminders: { parent: v } }, v ? "Đã bật nhắc cho phụ huynh." : "Đã tắt nhắc cho phụ huynh.")} label="Nhắc phụ huynh" hint="Tin nhắc cho phụ huynh của từng học viên" />
          <Switch id="r-student" checked={channels.student} onChange={v => void save({ reminders: { student: v } }, v ? "Đã bật nhắc cho học sinh." : "Đã tắt nhắc cho học sinh.")} label="Nhắc học sinh" hint="Tin nhắc cho chính học sinh" />
        </div>
      </section>

      <section aria-labelledby="h-gd" className="rounded-xl p-4" style={CARD}>
        <h2 id="h-gd" className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Giao diện</h2>
        <p className="text-xs mt-1 mb-3" style={{ color: "var(--kin-chu-phu)" }}>Chủ đề màu và chế độ sáng/tối cũng lưu theo tài khoản.</p>
        <Link href="/cai-dat/chu-de" className="inline-flex items-center px-4 py-2 rounded-lg text-sm min-h-[44px]"
          style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)", border: "1px solid var(--kin-vien-thuong)" }}>Chọn chủ đề màu</Link>
      </section>
    </div>
  );
}
