// HP-LOP-TRUONG — panel "Bảng bậc và môn" của lớp tính học phí theo bảng tháng (mục 5.2): danh sách môn (1–6), bảng bậc theo số môn (1–8 dòng),
// ngày bắt đầu kỳ thu (1–28, 1 = tháng dương lịch). Điền sẵn từ `suggestedConfig` (lớp bảng tháng gần nhất của cô) khi lớp chưa có bảng; sửa được.
// `enable`: lớp CHƯA là bảng tháng (và chưa có tiền) — lưu thì máy chủ bật cả chế độ. Chỉ HIỂN THỊ + gửi; kiểm thật nằm ở máy chủ (PUT /cau-hinh).
// Dùng chung cho tab Học phí (LopBangHocPhi) và lời mời bật chế độ ở lớp cũ (LopHocPhi).
"use client";
import { useState } from "react";
import { KinButton } from "@/components/kin";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { callApi, useNotify } from "@/components/tutor/shared";
import { sheetErrorText, tiersAscending, validateConfigDraft, type SheetConfig } from "@/components/tutor/bangHocPhiTypes";

const digits = (s: string) => s.replace(/[^\d]/g, "");
interface TierDraft { subjects: string; rate: string }

export default function BangHocPhiCauHinh({ courseId, config, suggested, enable = false, hasRows = false, onSaved, onClose }: {
  courseId: string;
  /** Bảng đang dùng (null = chưa đặt). */
  config: SheetConfig | null;
  /** Bảng của lớp bảng-tháng gần nhất của cô, chỉ dùng khi `config` null. */
  suggested: SheetConfig | null;
  /** Lưu kèm bật chế độ bảng tháng cho lớp chưa có tiền. */
  enable?: boolean;
  /** Lớp đã có dòng học phí → không đổi được ngày bắt đầu kỳ thu (máy chủ 409 HAS_ROWS). */
  hasRows?: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const notify = useNotify();
  const from = config ?? suggested;
  const prefilled = !config && !!suggested;
  const [subjects, setSubjects] = useState<string[]>(from?.subjects.length ? from.subjects : [""]);
  const [tiers, setTiers] = useState<TierDraft[]>(from?.tiers.length
    ? from.tiers.map(t => ({ subjects: String(t.subjects), rate: String(t.rate) }))
    : [{ subjects: "1", rate: "" }]);
  const [startDay, setStartDay] = useState(String(from?.periodStartDay ?? 1));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nTiers = tiers.map(t => ({ subjects: Number(t.subjects || 0), rate: Number(t.rate || 0) }));
  const ascending = tiersAscending(nTiers);

  async function save() {
    if (busy) return;
    const draft = { subjects: subjects.map(s => s.trim()), tiers: nTiers, periodStartDay: Number(startDay || 0) };
    const bad = validateConfigDraft(draft);
    if (bad) { setErr(bad); return; }
    setBusy(true); setErr(null);
    const r = await callApi<{ code?: string }>(`/api/tutor/lop/${encodeURIComponent(courseId)}/bang-hoc-phi/cau-hinh`, {
      method: "PUT", body: JSON.stringify({ ...draft, ...(enable ? { enable: true } : {}) }),
    });
    setBusy(false);
    if (!r.ok) { setErr(sheetErrorText(r.status, r.data)); return; }
    notify.ok(enable ? "Đã bật bảng học phí tháng cho lớp." : "Đã lưu bảng bậc.");
    onSaved();
  }

  const small = "inline-flex items-center justify-center min-h-11 min-w-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] enabled:hover:bg-[var(--kin-nen-re-chuot)] disabled:opacity-45";

  return (
    <section aria-labelledby="bh-ch-t" data-bh-cau-hinh className="space-y-5">
      <KinSectionHead id="bh-ch-t" title={config ? "Sửa bảng bậc và môn" : "Đặt bảng bậc và môn"} aside={<button type="button" onClick={onClose} className="min-h-11 px-2 underline text-[var(--kin-nhan-link)]">Đóng</button>} />

      {prefilled && <KinCallout title="Điền sẵn từ lớp trước của cô">Cô xem lại, sửa được trước khi lưu. Bảng này chỉ của riêng lớp này, đổi ở đây không đổi lớp khác.</KinCallout>}
      {enable && <KinCallout title="Lớp sẽ chuyển sang tính theo bảng học phí tháng">Chỉ chuyển được khi lớp chưa có học phí nào. Sau khi lưu không quay lại cách cũ được.</KinCallout>}

      <fieldset>
        <legend className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Các môn của lớp <span className="font-normal text-[var(--kin-chu-mo)]">(1 đến 6 môn)</span></legend>
        <ul className="pt-3 space-y-2">
          {subjects.map((s, i) => (
            <li key={i} className="flex gap-2 items-center">
              <label className="flex-1 min-w-0">
                <span className="sr-only">Tên môn {i + 1}</span>
                <input value={s} maxLength={40} onChange={e => { const v = e.target.value; setSubjects(cur => cur.map((x, j) => (j === i ? v : x))); setErr(null); }}
                  placeholder={i === 0 ? "Ví dụ: Toán" : "Tên môn"} className={KIN_FIELD} autoComplete="off" />
              </label>
              <button type="button" className={small} disabled={subjects.length <= 1} aria-label={`Bỏ môn ${i + 1}`}
                onClick={() => { setSubjects(cur => cur.filter((_, j) => j !== i)); setErr(null); }}>Bỏ</button>
            </li>
          ))}
        </ul>
        <button type="button" className={`${small} mt-3`} disabled={subjects.length >= 6} onClick={() => setSubjects(cur => [...cur, ""])}>Thêm môn</button>
      </fieldset>

      <fieldset>
        <legend className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Bảng bậc <span className="font-normal text-[var(--kin-chu-mo)]">(đơn giá một buổi theo số môn em học)</span></legend>
        <ul className="pt-3 space-y-3">
          {tiers.map((t, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 items-end">
              <label className={KIN_LABEL}>{i === 0 ? "Số môn" : <span className="sr-only">Số môn</span>}
                <input inputMode="numeric" value={t.subjects} aria-label={`Số môn của bậc ${i + 1}`} onChange={e => { const v = digits(e.target.value); setTiers(cur => cur.map((x, j) => (j === i ? { ...x, subjects: v } : x))); setErr(null); }}
                  className={`${KIN_FIELD} ${i === 0 ? "mt-2" : ""}`} />
              </label>
              <label className={KIN_LABEL}>{i === 0 ? "Đơn giá một buổi (đ)" : <span className="sr-only">Đơn giá một buổi</span>}
                <input inputMode="numeric" value={t.rate} aria-label={`Đơn giá của bậc ${i + 1}`} placeholder="Ví dụ: 70000" onChange={e => { const v = digits(e.target.value); setTiers(cur => cur.map((x, j) => (j === i ? { ...x, rate: v } : x))); setErr(null); }}
                  className={`${KIN_FIELD} ${i === 0 ? "mt-2" : ""}`} />
              </label>
              <button type="button" className={small} disabled={tiers.length <= 1} aria-label={`Bỏ bậc ${i + 1}`}
                onClick={() => { setTiers(cur => cur.filter((_, j) => j !== i)); setErr(null); }}>Bỏ</button>
            </li>
          ))}
        </ul>
        <button type="button" className={`${small} mt-3`} disabled={tiers.length >= 8}
          onClick={() => setTiers(cur => [...cur, { subjects: String((Number(cur[cur.length - 1]?.subjects) || 0) + 1), rate: "" }])}>Thêm bậc</button>
        <p className="pt-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Em học nhiều môn hơn bậc cuối thì dùng đơn giá của bậc cuối.</p>
        {ascending && <p role="status" data-bh-canh-bao className="pt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-tt-chu-cho)]">Lưu ý: đơn giá một bậc cao hơn bậc trước, thường học nhiều môn thì đơn giá thấp hơn. Cô kiểm lại nếu chưa đúng ý.</p>}
      </fieldset>

      <div>
        <label className={KIN_LABEL}>Ngày bắt đầu kỳ thu (1–28, mặc định 1 = tháng dương lịch)
          <input inputMode="numeric" value={startDay} disabled={hasRows} onChange={e => { setStartDay(digits(e.target.value)); setErr(null); }} className={`${KIN_FIELD} mt-2`} />
        </label>
        <p className="pt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
          {hasRows
            ? "Lớp đã có học phí nhập rồi nên không đổi ngày này được."
            : "Để 1 thì mỗi kỳ là một tháng dương lịch. Ví dụ nhập 15 thì kỳ 11/2026 chạy từ 15/11 đến 14/12. Đặt một lần trước khi nhập học phí, sau đó không đổi được."}
        </p>
      </div>

      {err && <p role="alert" data-bh-loi className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      <div className="flex gap-2 flex-wrap">
        <KinButton loading={busy} loadingLabel="Đang lưu…" onClick={() => void save()}>{enable ? "Lưu và bật bảng học phí tháng" : "Lưu bảng bậc"}</KinButton>
        <KinButton variant="ghost" onClick={onClose}>Huỷ</KinButton>
      </div>
    </section>
  );
}
