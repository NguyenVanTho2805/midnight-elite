"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { callApi, useNotify } from "@/components/tutor/shared";
import { OPTIONAL_TUTOR_MODULES, TUTOR_MODULES, applyPreferencesPatch, normalizeMessengerHandle, reminderChannels, type UserPreferences, type OptionalTutorModule } from "@/lib/userPreferences";
import { normalizeZaloGroupUrl } from "@/lib/funnel";
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { KinButton } from "@/components/kin";
import PhoneLoginCard from "@/components/account/PhoneLoginCard";
import PushSettings from "@/components/tutor/PushSettings";
import { FIELD_STYLE } from "@/components/tutor/shared";

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

export interface ClassLink { id: string; name: string; zaloGroupUrl: string | null }

export default function CaiDatClient({ initial, classes, phone }: { initial: UserPreferences; classes: ClassLink[]; phone: string | null }) {
  const router = useRouter();
  const notify = useNotify();
  const [prefs, setPrefs] = useState<UserPreferences>(initial);
  const [busy, setBusy] = useState(false);
  const modules = prefs.modules ?? [];
  const channels = reminderChannels(prefs);
  // PH-215 Kết nối
  const [links, setLinks] = useState<Record<string, string>>(() => Object.fromEntries(classes.map(c => [c.id, c.zaloGroupUrl ?? ""])));
  const [savedLinks, setSavedLinks] = useState<Record<string, string>>(() => Object.fromEntries(classes.map(c => [c.id, c.zaloGroupUrl ?? ""])));
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [linkErr, setLinkErr] = useState<Record<string, string>>({});
  const [messenger, setMessenger] = useState(prefs.connections?.messenger ?? "");
  const [msgErr, setMsgErr] = useState("");
  const zaloPhone = normalizeZaloPhone(phone);

  async function saveGroupLink(id: string) {
    const raw = links[id] ?? "";
    const u = normalizeZaloGroupUrl(raw);
    if (!u.ok) { setLinkErr(e => ({ ...e, [id]: "Link nhóm Zalo phải có dạng https://zalo.me/g/…" })); return; }
    setLinkErr(e => ({ ...e, [id]: "" }));
    setLinkBusy(id);
    const r = await callApi<{ url: string | null }>(`/api/tutor/classes/${id}/zalo-group`, { method: "PUT", body: JSON.stringify({ url: u.value }) });
    setLinkBusy(null);
    if (!r.ok) { setLinkErr(e => ({ ...e, [id]: r.data.error ?? "Không lưu được" })); return; }
    setLinks(l => ({ ...l, [id]: r.data.url ?? "" }));
    setSavedLinks(l => ({ ...l, [id]: r.data.url ?? "" }));
    notify.ok(r.data.url ? "Đã lưu link nhóm Zalo của lớp." : "Đã gỡ link nhóm Zalo của lớp.");
  }
  async function saveMessenger() {
    const raw = messenger.trim();
    if (raw && !normalizeMessengerHandle(raw)) { setMsgErr("Tên trang chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang (hoặc dán link m.me/…)."); return; }
    setMsgErr("");
    await save({ connections: { messenger: raw ? raw : null } }, raw ? "Đã lưu trang Messenger." : "Đã gỡ trang Messenger.");
  }

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

      <PushSettings />

      <section id="ket-noi" aria-labelledby="h-kn" className="rounded-xl p-4" style={CARD}>
        <h2 id="h-kn" className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Kết nối</h2>
        <p className="text-xs mt-1 mb-3" style={{ color: "var(--kin-chu-phu)" }}>
          KiN không dùng bot trên Zalo cá nhân và không tự gửi tin: mọi tin đều soạn sẵn, bạn tự bấm gửi.
        </p>

        <div className="rounded-lg p-3 mb-3" style={{ background: "var(--kin-nen-trang)", border: "1px dashed var(--kin-vien-thuong)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Đăng nhập bằng Zalo <span className="ml-1 text-xs font-normal" style={{ color: "var(--kin-chu-phu)" }}>(chưa mở)</span></p>
          <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>Cần ứng dụng Zalo đã đăng ký cho KiN. Đăng nhập Zalo không trả về số điện thoại, nên số vẫn xác minh bằng mã OTP riêng. Hiện bạn vẫn gửi tin bằng Zalo trên máy như bình thường.</p>
        </div>

        <h3 className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Nhóm Zalo của lớp</h3>
        <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--kin-chu-phu)" }}>
          Dán link mời nhóm (https://zalo.me/g/…). Tin vào nhóm chỉ là tin chung: không tên em, không điểm, không số tiền. Phiếu học phí luôn gửi riêng.
        </p>
        {classes.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Bạn chưa có lớp nào.</p>
        ) : (
          <ul className="space-y-3">
            {classes.map(c => {
              const changed = (links[c.id] ?? "") !== (savedLinks[c.id] ?? "");
              return (
                <li key={c.id}>
                  <label className="block text-sm" htmlFor={`zg-${c.id}`}>{c.name}</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <input id={`zg-${c.id}`} value={links[c.id] ?? ""} onChange={e => setLinks(l => ({ ...l, [c.id]: e.target.value }))} placeholder="https://zalo.me/g/abcxyz"
                      className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} aria-invalid={!!linkErr[c.id]} />
                    <KinButton variant="secondary" loading={linkBusy === c.id} disabled={!changed} onClick={() => void saveGroupLink(c.id)}>Lưu</KinButton>
                  </div>
                  {linkErr[c.id] && <p role="alert" className="text-xs mt-1" style={{ color: "var(--kin-tt-chu-loi)" }}>{linkErr[c.id]}</p>}
                  {!changed && savedLinks[c.id] && <p className="text-xs mt-1" style={{ color: "var(--kin-tt-chu-xong)" }}>Đã gắn nhóm Zalo cho lớp này.</p>}
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="text-sm font-semibold mt-5" style={{ color: "var(--kin-chu-chinh)" }}>Trang Messenger</h3>
        <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--kin-chu-phu)" }}>Tên trang Facebook của bạn (m.me/<i>tên</i>). Hồ sơ công khai sẽ có nút “Nhắn Messenger” với tin điền sẵn.</p>
        <div className="flex gap-2 flex-wrap">
          <input aria-label="Tên trang Messenger" value={messenger} onChange={e => setMessenger(e.target.value)} placeholder="gia.su.lan hoặc https://m.me/gia.su.lan"
            className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} aria-invalid={!!msgErr} />
          <KinButton variant="secondary" disabled={busy || messenger.trim() === (prefs.connections?.messenger ?? "")} onClick={() => void saveMessenger()}>Lưu</KinButton>
        </div>
        {msgErr && <p role="alert" className="text-xs mt-1" style={{ color: "var(--kin-tt-chu-loi)" }}>{msgErr}</p>}
        {prefs.connections?.messenger && <p className="text-xs mt-1 break-all" style={{ color: "var(--kin-chu-phu)" }}>Link: https://m.me/{prefs.connections.messenger}</p>}

        <div className="mt-4 divide-y" style={{ borderColor: "var(--kin-vien-thuong)" }}>
          <Switch id="show-zalo" checked={!!prefs.connections?.showZalo} disabled={false} busy={busy || !zaloPhone}
            onChange={v => void save({ connections: { showZalo: v } }, v ? "Hồ sơ công khai sẽ hiện số Zalo của bạn." : "Đã ẩn số Zalo khỏi hồ sơ công khai.")}
            label="Hiện số Zalo trên hồ sơ công khai"
            hint={zaloPhone ? `Tắt sẵn. Bật thì ai cũng thấy số ${zaloPhone} và bấm được zalo.me/${zaloPhone} — số điện thoại của bạn sẽ lộ ra.` : "Hồ sơ chưa có số điện thoại hợp lệ nên chưa bật được. Tắt sẵn để không lộ số."} />
        </div>

        <div className="rounded-lg p-3 mt-3" style={{ background: "var(--kin-nen-trang)", border: "1px dashed var(--kin-vien-thuong)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Zalo OA <span className="ml-1 text-xs font-normal" style={{ color: "var(--kin-chu-phu)" }}>(đang khoá)</span></p>
          <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>Gửi tin tự động cần Zalo OA đã xác thực, mở khi KiN có pháp nhân. Cho tới lúc đó KiN soạn sẵn tin và bạn tự bấm gửi.</p>
        </div>
      </section>

      <PhoneLoginCard profilePhone={phone} />

      <section aria-labelledby="h-gd" className="rounded-xl p-4" style={CARD}>
        <h2 id="h-gd" className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Giao diện</h2>
        <p className="text-xs mt-1 mb-3" style={{ color: "var(--kin-chu-phu)" }}>Chủ đề màu và chế độ sáng/tối cũng lưu theo tài khoản.</p>
        <Link href="/cai-dat/chu-de" className="inline-flex items-center px-4 py-2 rounded-lg text-sm min-h-[44px]"
          style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-nhan-diem)", border: "1px solid var(--kin-vien-thuong)" }}>Chọn chủ đề màu</Link>
      </section>
    </div>
  );
}
