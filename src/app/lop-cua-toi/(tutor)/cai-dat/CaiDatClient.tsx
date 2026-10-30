"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { callApi, useNotify } from "@/components/tutor/shared";
import { OPTIONAL_TUTOR_MODULES, TUTOR_MODULES, applyPreferencesPatch, normalizeMessengerHandle, reminderChannels, type UserPreferences, type OptionalTutorModule } from "@/lib/userPreferences";
import { normalizeZaloGroupUrl } from "@/lib/funnel";
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { KinButton } from "@/components/kin";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinPage, KinPageHeader, KIN_TWO_COL } from "@/components/kin/PageLayout";
import { KIN_TAB_BOX, KinTabInner } from "@/components/kin/Tabs";
import PhoneLoginCard from "@/components/account/PhoneLoginCard";
import PushSettings from "@/components/tutor/PushSettings";
import PwaGuide from "@/components/tutor/PwaGuide";
import { FIELD_STYLE } from "@/components/tutor/shared";
import { KinPanel, KinStatus } from "@/components/kin";
import type { QuotaCard } from "@/lib/tutorQuota";

const ROWS = "divide-y divide-[var(--kin-vien-nhat)]";
const NOTE = { background: "var(--kin-nen-trang)", border: "1px dashed var(--kin-vien-thuong)" } as const;

function Switch({ id, checked, disabled, busy, onChange, label, hint }: { id: string; checked: boolean; disabled?: boolean; busy?: boolean; onChange?: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 py-3 min-h-[44px]" style={{ cursor: disabled ? "default" : "pointer" }}>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled || busy} onChange={e => onChange?.(e.target.checked)}
        className="mt-1 w-5 h-5 flex-shrink-0" style={{ accentColor: "var(--kin-nhan-nen)" }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[length:var(--kin-co-goc)] font-medium" style={{ color: "var(--kin-chu-chinh)" }}>
          {label}{disabled && <span className="ml-2 text-xs font-normal" style={{ color: "var(--kin-chu-phu)" }}>(luôn bật)</span>}
        </span>
        <span className="block text-[length:var(--kin-co-goc)] mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{hint}</span>
      </span>
    </label>
  );
}

export interface ClassLink { id: string; name: string; zaloGroupUrl: string | null }

export default function CaiDatClient({ initial, classes, phone, quota = null }: { initial: UserPreferences; classes: ClassLink[]; phone: string | null; quota?: QuotaCard[] | null }) {
  const router = useRouter();
  const notify = useNotify();
  const [prefs, setPrefs] = useState<UserPreferences>(initial);
  const [busy, setBusy] = useState(false);
  // BU-00: chưa chọn gì (`undefined`) = đủ module → công tắc hiện đúng "đang bật"; `[]` = gia sư đã tắt hết.
  const modules: OptionalTutorModule[] = prefs.modules ?? [...OPTIONAL_TUTOR_MODULES];
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
    // Luôn ghi DANH SÁCH các module còn bật (kể cả khi tắt một module lúc đang ở mặc định đủ) — không ghi `undefined`, vì vắng mặt nghĩa là đủ module.
    const next = on ? [...modules, key] : modules.filter(m => m !== key);
    void save({ modules: next }, on ? "Đã bật module — xem ở thanh bên." : "Đã ẩn module khỏi thanh bên. Dữ liệu vẫn giữ nguyên.");
  };

  return (
    <KinPage>
      <KinPageHeader title="Cài đặt" sub="Lưu theo tài khoản của bạn, đăng nhập ở máy nào cũng giống nhau. Bật hoặc tắt là lưu ngay, không cần nút lưu chung." />
      <nav aria-label="Các mục cài đặt" className="flex gap-2 overflow-x-auto border-b border-[var(--kin-vien-thuong)]">
        {[["#module", "Module và nhắc lịch"], ["#thong-bao", "Thông báo"], ["#ket-noi", "Kết nối"], ["#tai-khoan", "Tài khoản và giao diện"]].map(([href, label], i) => (
          <a key={href} href={href} className={`${KIN_TAB_BOX} -mb-px`}><KinTabInner active={i === 0}>{label}</KinTabInner></a>
        ))}
      </nav>

      <div className={`mt-8 ${KIN_TWO_COL}`}>
      <div className="space-y-[var(--kin-cach-muc)] min-w-0">
      <section id="module" aria-labelledby="h-module" className="scroll-mt-4">
        <KinSectionHead id="h-module" title="Module hiển thị" />
        <p className="text-[length:var(--kin-co-goc)] mt-4 mb-2" style={{ color: "var(--kin-chu-mo)" }}>
          Tắt module chỉ là ẩn khỏi thanh bên — dữ liệu giữ nguyên, bật lại là thấy đủ. Khi Hộp việc đang tắt, việc cần xử lý hiện thành chấm trên đúng buổi trong Lịch.
        </p>
        <div className={ROWS}>
          {TUTOR_MODULES.filter(m => m.always).map(m => <Switch key={m.key} id={`m-${m.key}`} checked disabled label={m.label} hint={m.hint} />)}
          {TUTOR_MODULES.filter(m => !m.always).map(m => (
            <Switch key={m.key} id={`m-${m.key}`} checked={modules.includes(m.key as OptionalTutorModule)}
              onChange={v => toggleModule(m.key as OptionalTutorModule, v)} label={m.label} hint={m.hint} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">{modules.length} module tuỳ chọn đang bật trên {OPTIONAL_TUTOR_MODULES.length}</p>
      </section>

      <section aria-labelledby="h-nhac" className="scroll-mt-4">
        <KinSectionHead id="h-nhac" title="Nhắc lịch" />
        <p className="text-[length:var(--kin-co-goc)] mt-4 mb-2" style={{ color: "var(--kin-chu-mo)" }}>
          Nhắc trước 24 giờ và trước 1 giờ mỗi buổi, không gửi trong giờ yên lặng 22:00–07:00. Tin soạn sẵn ở trang Lịch — bạn bấm một lần để mở Zalo và tự bấm gửi (KiN không dùng bot trên Zalo cá nhân).
        </p>
        <div className={ROWS}>
          <Switch id="r-parent" checked={channels.parent} onChange={v => void save({ reminders: { parent: v } }, v ? "Đã bật nhắc cho phụ huynh." : "Đã tắt nhắc cho phụ huynh.")} label="Nhắc phụ huynh" hint="Tin nhắc cho phụ huynh của từng học viên" />
          <Switch id="r-student" checked={channels.student} onChange={v => void save({ reminders: { student: v } }, v ? "Đã bật nhắc cho học sinh." : "Đã tắt nhắc cho học sinh.")} label="Nhắc học sinh" hint="Tin nhắc cho chính học sinh" />
        </div>
      </section>

      <section id="ket-noi" aria-labelledby="h-kn" className="scroll-mt-4">
        <KinSectionHead id="h-kn" title="Kết nối" />
        <p className="text-[length:var(--kin-co-goc)] mt-4 mb-3" style={{ color: "var(--kin-chu-mo)" }}>
          KiN không dùng bot trên Zalo cá nhân và không tự gửi tin: mọi tin đều soạn sẵn, bạn tự bấm gửi.
        </p>

        <div className="rounded-lg p-3 mb-3" style={NOTE}>
          <p className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Đăng nhập bằng Zalo <span className="ml-1 text-xs font-normal" style={{ color: "var(--kin-chu-phu)" }}>(chưa mở)</span></p>
          <p className="text-[length:var(--kin-co-goc)] mt-1" style={{ color: "var(--kin-chu-phu)" }}>Cần ứng dụng Zalo đã đăng ký cho KiN. Đăng nhập Zalo không trả về số điện thoại, nên số vẫn xác minh bằng mã OTP riêng. Hiện bạn vẫn gửi tin bằng Zalo trên máy như bình thường.</p>
        </div>

        <h3 className="text-[length:var(--kin-co-tieu-de)] font-medium mt-6" style={{ color: "var(--kin-chu-chinh)" }}>Nhóm Zalo của lớp</h3>
        <p className="text-[length:var(--kin-co-goc)] mt-1 mb-2" style={{ color: "var(--kin-chu-phu)" }}>
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

        <h3 className="text-[length:var(--kin-co-tieu-de)] font-medium mt-8" style={{ color: "var(--kin-chu-chinh)" }}>Trang Messenger</h3>
        <p className="text-[length:var(--kin-co-goc)] mt-1 mb-2" style={{ color: "var(--kin-chu-phu)" }}>Tên trang Facebook của bạn (m.me/<i>tên</i>). Hồ sơ công khai sẽ có nút “Nhắn Messenger” với tin điền sẵn.</p>
        <div className="flex gap-2 flex-wrap">
          <input aria-label="Tên trang Messenger" value={messenger} onChange={e => setMessenger(e.target.value)} placeholder="gia.su.lan hoặc https://m.me/gia.su.lan"
            className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} aria-invalid={!!msgErr} />
          <KinButton variant="secondary" disabled={busy || messenger.trim() === (prefs.connections?.messenger ?? "")} onClick={() => void saveMessenger()}>Lưu</KinButton>
        </div>
        {msgErr && <p role="alert" className="text-xs mt-1" style={{ color: "var(--kin-tt-chu-loi)" }}>{msgErr}</p>}
        {prefs.connections?.messenger && <p className="text-[length:var(--kin-co-goc)] mt-1 break-all" style={{ color: "var(--kin-chu-phu)" }}>Link: https://m.me/{prefs.connections.messenger}</p>}

        <div className={`mt-4 ${ROWS}`}>
          <Switch id="show-zalo" checked={!!prefs.connections?.showZalo} disabled={false} busy={busy || !zaloPhone}
            onChange={v => void save({ connections: { showZalo: v } }, v ? "Hồ sơ công khai sẽ hiện số Zalo của bạn." : "Đã ẩn số Zalo khỏi hồ sơ công khai.")}
            label="Hiện số Zalo trên hồ sơ công khai"
            hint={zaloPhone ? `Tắt sẵn. Bật thì ai cũng thấy số ${zaloPhone} và bấm được zalo.me/${zaloPhone} — số điện thoại của bạn sẽ lộ ra.` : "Hồ sơ chưa có số điện thoại hợp lệ nên chưa bật được. Tắt sẵn để không lộ số."} />
        </div>

        <div className="rounded-lg p-3 mt-3" style={NOTE}>
          <p className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Zalo OA <span className="ml-1 text-xs font-normal" style={{ color: "var(--kin-chu-phu)" }}>(đang khoá)</span></p>
          <p className="text-[length:var(--kin-co-goc)] mt-1" style={{ color: "var(--kin-chu-phu)" }}>Gửi tin tự động cần Zalo OA đã xác thực, mở khi KiN có pháp nhân. Cho tới lúc đó KiN soạn sẵn tin và bạn tự bấm gửi.</p>
        </div>

        <h3 className="text-[length:var(--kin-co-tieu-de)] font-medium mt-8" style={{ color: "var(--kin-chu-chinh)" }}>Google và lưu trữ</h3>
        <p className="text-[length:var(--kin-co-goc)] mt-1 mb-2" style={{ color: "var(--kin-chu-phu)" }}>KiN chưa kết nối với tài khoản Google nào và không xin quyền truy cập Google. Dưới đây là những gì đang có thật.</p>
        <ul className="space-y-3" data-testid="ket-noi-google">
          <li className="rounded-lg p-3" style={NOTE} data-conn="calendar">
            <p className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Google Calendar <KinStatus tone="mo" className="ml-2">Chưa có</KinStatus></p>
            <p className="text-[length:var(--kin-co-goc)] mt-1" style={{ color: "var(--kin-chu-phu)" }}>Chưa có đồng bộ lịch. Lịch lớp xem ngay trên KiN, ở trang Lịch.</p>
          </li>
          <li className="rounded-lg p-3" style={NOTE} data-conn="meet">
            <p className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Google Meet <KinStatus tone="mo" className="ml-2">Chưa có tích hợp</KinStatus></p>
            <p className="text-[length:var(--kin-co-goc)] mt-1" style={{ color: "var(--kin-chu-phu)" }}>KiN không tạo phòng họp. Bạn dán link Meet hoặc Zoom của riêng bạn vào từng lớp; link đó được in vào tin nhắc lịch.</p>
          </li>
          <li className="rounded-lg p-3" style={NOTE} data-conn="drive">
            <p className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Google Drive <KinStatus tone="mo" className="ml-2">Chưa có tích hợp</KinStatus></p>
            <p className="text-[length:var(--kin-co-goc)] mt-1" style={{ color: "var(--kin-chu-phu)" }}>Bạn dán link chia sẻ Drive vào bài giảng hoặc tài liệu; KiN chỉ mở link đó, không đọc Drive của bạn.</p>
          </li>
        </ul>

        {quota && (
          <div className="mt-8" data-testid="the-han-muc">
            <h3 className="text-[length:var(--kin-co-tieu-de)] font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Hạn mức và dung lượng</h3>
            <p className="text-[length:var(--kin-co-goc)] mt-1 mb-3" style={{ color: "var(--kin-chu-phu)" }}>Chỉ để xem số đang dùng. Mục nào chưa có hạn mức thì ghi rõ là chưa có.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {quota.map(c => (
                <KinPanel key={c.key} data-quota={c.key}>
                  <p className="text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>{c.label}</p>
                  <p className="mt-1 text-[22px] leading-7 font-medium tabular-nums break-words" style={{ color: "var(--kin-chu-chinh)" }}>{c.value}</p>
                  {c.pct !== null && (
                    <div className="mt-2 h-2 rounded-full" style={{ background: "var(--kin-vien-nhat)" }} role="progressbar" aria-label={`${c.label}: ${c.pct}%`} aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-2 rounded-full" style={{ width: `${c.pct}%`, background: c.tone === "loi" ? "var(--kin-tt-chu-loi)" : c.tone === "cho" ? "var(--kin-tt-cham-cho)" : "var(--kin-tt-cham-xong)" }} />
                    </div>
                  )}
                  <div className="mt-2"><KinStatus tone={c.tone}>{c.stateText}</KinStatus></div>
                  <p className="mt-1 text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>{c.hint}</p>
                </KinPanel>
              ))}
            </div>
          </div>
        )}
      </section>

      </div>

      <div className="space-y-[var(--kin-cach-muc)] min-w-0">
        <div id="thong-bao" className="scroll-mt-4"><PushSettings /></div>
        <PwaGuide />
        <PhoneLoginCard profilePhone={phone} plain />
      <section id="tai-khoan" aria-labelledby="h-gd" className="scroll-mt-4">
        <KinSectionHead id="h-gd" title="Giao diện" />
        <p className="text-[length:var(--kin-co-goc)] mt-4 mb-3" style={{ color: "var(--kin-chu-mo)" }}>Chủ đề màu và chế độ sáng/tối cũng lưu theo tài khoản.</p>
        <Link href="/cai-dat/chu-de" className={kinButtonClass("secondary")}>Chọn chủ đề màu</Link>
      </section>
      </div>
      </div>
    </KinPage>
  );
}
