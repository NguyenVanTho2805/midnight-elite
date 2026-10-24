// "Tạo lớp" của gia sư, WIZARD 3 BƯỚC (LO-03; Figma "Gia sư · Tạo lớp đầu tiên" 299:112849): Thông tin → Học sinh → Lịch học; nút cuối "Tạo lớp + N buổi".
// Bước 1 gồm cả "Cách tính học phí" (HP-15: chọn LÚC TẠO LỚP; mặc định giữ cách hiện tại; không đổi được hình thức của lớp đã tạo; số tiền do máy chủ tính).
// Bước 2: chỉ thêm được em ĐÃ học một lớp khác của gia sư (StudentPicker); em mới vào lớp bằng mã mời (KiN mở sẵn tab Mã mời sau khi tạo). Không thu thêm dữ liệu trẻ ở đây.
// Bước 3: một hoặc nhiều khung giờ hằng tuần + ngày buổi đầu + số tuần xem trước. "N buổi" là số buổi lịch lặp sinh ra trong khoảng đó (previewSessionCount) — chỉ để hiển thị;
// buổi học thật do lịch tuần sinh ra, KiN không ghi sẵn bản ghi từng buổi.
// Gọi đúng API cũ: POST /api/courses (giá/bài học mặc định 0), POST khung giờ, rồi POST /api/tutor/lop/[id]/hoc-sinh (nếu có chọn em). Lớp đã tạo mà một phần sau lỗi thì KHÔNG bắt tạo lại:
// đưa tới trang lớp và nói rõ phần nào chưa lưu. "Buổi đầu" mặc định là hôm nay giờ VN.
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toSlug } from "@/lib/slug";
import { ADMIN_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { vnDateKeyOf } from "@/lib/classSessions";
import { FEE_MODES, FEE_MODE_HINT, FEE_MODE_LABEL, FEE_MODE_LEGACY, FEE_RATE_UNIT, hourlyAmount, isNewFeeMode, validateFeeSetup, type FeeMode } from "@/lib/tuitionFee";
import {
  ADD_STUDENTS_MAX, WEEKDAY_LABEL, WIZARD_WEEKS_MAX, WIZARD_WEEKS_MIN, createButtonLabel, previewSessionCount, validateSlots, type WizardSlot,
} from "@/lib/tutorStudentView";
import { KinButton, kinButtonClass } from "@/components/kin";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinPageHeader, KIN_PAGE, KIN_TWO_COL, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import StudentPicker from "@/components/tutor/StudentPicker";
import { jfetch } from "@/components/tutor/studentUi";

const FIELD = KIN_FIELD;
const LABEL = KIN_LABEL;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const; // Thứ Hai đứng đầu
type Step = 1 | 2 | 3;
const STEPS: { n: Step; label: string }[] = [{ n: 1, label: "Thông tin" }, { n: 2, label: "Học sinh" }, { n: 3, label: "Lịch học" }];

export default function TaoLop() {
  const router = useRouter();
  const todayKey = vnDateKeyOf(new Date());
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [options, setOptions] = useState<string[]>([...ADMIN_CATEGORIES]);
  const [feeMode, setFeeMode] = useState<FeeMode>(FEE_MODE_LEGACY); // HP-15: mặc định = cách hiện tại
  const [feeRate, setFeeRate] = useState("");
  const [feeMinutes, setFeeMinutes] = useState("90");
  const [students, setStudents] = useState<string[]>([]);
  const [slots, setSlots] = useState<WizardSlot[]>([]);          // rỗng = chưa xếp lịch
  const [firstDate, setFirstDate] = useState(todayKey);
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories").then(r => (r.ok ? r.json() : { categories: [] }))
      .then(d => { const cats = (d.categories as { name: string }[]).map(c => c.name); if (cats.length) setOptions([...new Set([...ADMIN_CATEGORIES, ...cats])]); })
      .catch(() => {});
  }, []);

  const openKey = firstDate || todayKey;
  const sessionCount = previewSessionCount(slots, openKey, weeks);

  function checkInfo(): string | null {
    if (!name.trim()) return "Cô nhập tên lớp trước nhé.";
    if (isNewFeeMode(feeMode)) { const v = validateFeeSetup({ mode: feeMode, rate: Number(feeRate), sessionMinutes: Number(feeMinutes) }); if (!v.ok) return v.error; }
    return null;
  }
  function next() {
    if (step === 1) { const e = checkInfo(); if (e) { setError(e); return; } }
    setError(null); setStep(s => (s < 3 ? ((s + 1) as Step) : s));
  }
  function back() { setError(null); setStep(s => (s > 1 ? ((s - 1) as Step) : s)); }
  const patchSlot = (i: number, p: Partial<WizardSlot>) => { setSlots(s => s.map((x, k) => (k === i ? { ...x, ...p } : x))); setError(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (step < 3) { next(); return; } // Enter ở bước đầu = sang bước tiếp, không tạo lớp
    const clean = name.trim();
    const infoErr = checkInfo();
    if (infoErr) { setError(infoErr); setStep(1); return; }
    const slotErr = validateSlots(slots);
    if (slotErr) { setError(slotErr); return; }
    let fee: Record<string, unknown> = {};
    if (isNewFeeMode(feeMode)) {
      const v = validateFeeSetup({ mode: feeMode, rate: Number(feeRate), sessionMinutes: Number(feeMinutes) });
      if (v.ok) fee = { feeMode, feeRate: v.value.rate, ...(v.value.sessionMinutes != null ? { feeSessionMinutes: v.value.sessionMinutes } : {}) };
    }
    setBusy(true); setError(null);
    const slug = toSlug(clean);
    const cat = category.trim() || "Khác";
    try {
      const payload = {
        ...fee,
        id: slug, name: clean, adminName: clean, shortTitle: clean.toUpperCase().split(" ").slice(0, 2).join("\n"),
        category: cat, instructor: "KiN", teacherAvatar: "K", openDate: openKey.split("-").reverse().join("/"),
        types: ["Video"], tag: null, tagColor: null,
        bg: CATEGORY_GRADIENT[cat] ?? "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)",
        price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
      };
      await api.courses.create(payload);
    } catch (err) {
      setError(`Chưa tạo được lớp: ${err instanceof Error ? err.message : "lỗi không rõ"}. Cô kiểm tra tên lớp rồi bấm lại.`);
      setBusy(false);
      return;
    }
    // Lớp đã tạo: từ đây KHÔNG bắt tạo lại. Phần nào lỗi thì đưa tới trang lớp và nói rõ.
    let scheduleFailed = false;
    for (const s of slots) {
      try { await api.classSchedules.create(slug, { dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }); } catch { scheduleFailed = true; }
    }
    let added: number | null = null, addFailed = false;
    if (students.length) {
      const r = await jfetch(`/api/tutor/lop/${slug}/hoc-sinh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userIds: students }) });
      if (r.ok) added = r.json?.added ?? 0; else addFailed = true;
    }
    const qs = new URLSearchParams({ tab: "ma-moi", moi: "1" });
    if (scheduleFailed) qs.set("lich", "loi");
    if (added !== null) qs.set("them", String(added));
    if (addFailed) qs.set("them", "loi");
    router.push(`/lop-cua-toi/${slug}?${qs.toString()}`);
  }

  return (
    <form onSubmit={e => void submit(e)} className={KIN_PAGE} aria-label="Tạo lớp">
      <KinPageHeader title="Tạo lớp học" sub="Ba bước, cô có thể bỏ qua học sinh và lịch để làm sau."
        actions={<Link href="/lop-cua-toi/lop" className={kinButtonClass("ghost")}>Thoát</Link>} />

      <ol aria-label="Các bước tạo lớp" className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--kin-co-goc)]">
        {STEPS.map(s => (
          <li key={s.n} aria-current={step === s.n ? "step" : undefined} data-wizard-step={s.n}
            className={`inline-flex items-center gap-2 min-h-8 ${step === s.n ? "font-medium text-[var(--kin-chu-chinh)]" : step > s.n ? "text-[var(--kin-chu-chinh)]" : "text-[var(--kin-chu-mo)]"}`}>
            <span aria-hidden className={`inline-flex items-center justify-center size-6 rounded-full border text-[length:var(--kin-co-phu)] ${step === s.n ? "bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)] border-[var(--kin-nhan-nen)]" : "border-[var(--kin-vien-o-nhap)]"}`}>{s.n}</span>
            {s.label}{step > s.n ? " (xong)" : step === s.n ? " (đang làm)" : ""}
          </li>
        ))}
      </ol>

      <div className={KIN_TWO_COL}>
        <div className="min-w-0 space-y-[var(--kin-cach-muc)]">
          {step === 1 && (
            <>
              <section aria-labelledby="tl-info">
                <KinSectionHead id="tl-info" title="Thông tin lớp" aside="Bắt buộc" />
                <div className="pt-5 grid sm:grid-cols-2 gap-5">
                  <label className={LABEL}>Tên lớp *
                    <input value={name} onChange={e => { setName(e.target.value); setError(null); }} required placeholder="Ví dụ: Toán 9" className={`${FIELD} mt-2`} />
                  </label>
                  <label className={LABEL}>Môn · khối
                    <input list="tl-mon" value={category} onChange={e => setCategory(e.target.value)} placeholder="Ví dụ: Toán · Lớp 9" className={`${FIELD} mt-2`} />
                    <datalist id="tl-mon">{options.map(o => <option key={o} value={o} />)}</datalist>
                  </label>
                </div>
              </section>

              <section aria-labelledby="tl-phi">
                <KinSectionHead id="tl-phi" title="Cách tính học phí" aside="Chọn một lần" />
                <fieldset className="pt-5">
                  <legend className="sr-only">Cách tính học phí của lớp</legend>
                  <div className="space-y-2">
                    {FEE_MODES.map(m => (
                      <label key={m} className="flex items-start gap-3 min-h-[var(--kin-cham-toi-thieu)] py-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                        <input type="radio" name="tl-fee-mode" className="mt-1" checked={feeMode === m} onChange={() => { setFeeMode(m); setError(null); }} />
                        <span><span className="font-medium">{FEE_MODE_LABEL[m]}</span>{m === FEE_MODE_LEGACY ? " · mặc định" : ""}
                          <span className="block text-[var(--kin-chu-mo)]">{FEE_MODE_HINT[m]}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {isNewFeeMode(feeMode) && (
                  <div className="pt-4 grid sm:grid-cols-2 gap-5">
                    <label className={LABEL}>Đơn giá ({FEE_RATE_UNIT[feeMode]}) *
                      <input inputMode="numeric" value={feeRate} onChange={e => { setFeeRate(e.target.value.replace(/[^\d]/g, "")); setError(null); }}
                        placeholder="Ví dụ: 150000" className={`${FIELD} mt-2`} />
                    </label>
                    {feeMode === "per_hour" && (
                      <label className={LABEL}>Một buổi dài (phút) *
                        <input inputMode="numeric" value={feeMinutes} onChange={e => { setFeeMinutes(e.target.value.replace(/[^\d]/g, "")); setError(null); }} className={`${FIELD} mt-2`} />
                      </label>
                    )}
                    <p className="sm:col-span-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                      {feeMode === "per_hour" && Number(feeRate) > 0 && Number(feeMinutes) > 0
                        ? `Mỗi buổi ${Number(feeMinutes)} phút tính ${hourlyAmount(Number(feeRate), Number(feeMinutes)).toLocaleString("vi-VN")}đ (làm tròn từng buổi). `
                        : ""}
                      Học phí chỉ tính khi cô điểm danh em có mặt hoặc đi muộn. Phiếu đã chốt không bao giờ đổi khi cô đổi đơn giá sau này.
                    </p>
                  </div>
                )}
              </section>
            </>
          )}

          {step === 2 && (
            <section aria-labelledby="tl-hs">
              <KinSectionHead id="tl-hs" title="Học sinh" aside="Có thể để sau" />
              <p className="pt-4 pb-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
                Chọn em đã học một lớp khác của cô để thêm ngay. Em mới thì cô gửi mã mời sau khi tạo lớp (KiN mở sẵn tab Mã mời), em tự vào lớp.
              </p>
              <StudentPicker selected={students} onChange={ids => { setStudents(ids); setError(null); }} max={ADD_STUDENTS_MAX} />
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="tl-lich">
              <KinSectionHead id="tl-lich" title="Lịch học" aside="Có thể để sau" />
              {slots.length === 0 ? (
                <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa có khung giờ: lớp vẫn được tạo, lịch thêm sau ở trang lớp.</p>
              ) : (
                <ul className="pt-4 space-y-4" aria-label="Khung giờ hằng tuần">
                  {slots.map((s, i) => (
                    <li key={i} data-wizard-slot className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-3 items-end">
                      <label className={LABEL}>Ngày trong tuần
                        <select value={s.dayOfWeek} onChange={e => patchSlot(i, { dayOfWeek: Number(e.target.value) })} className={`${FIELD} mt-2`}>
                          {WEEKDAY_ORDER.map(d => <option key={d} value={d}>{WEEKDAY_LABEL[d]}</option>)}
                        </select>
                      </label>
                      <div className={LABEL}>
                        <span id={`tl-gio-${i}`}>Bắt đầu – kết thúc</span>
                        <div role="group" aria-labelledby={`tl-gio-${i}`} className="mt-2 flex items-center gap-2">
                          <input type="time" aria-label="Giờ bắt đầu" value={s.startTime} onChange={e => patchSlot(i, { startTime: e.target.value })} className={FIELD} />
                          <span aria-hidden className="text-[var(--kin-chu-mo)]">–</span>
                          <input type="time" aria-label="Giờ kết thúc" value={s.endTime} onChange={e => patchSlot(i, { endTime: e.target.value })} className={FIELD} />
                        </div>
                      </div>
                      <button type="button" onClick={() => { setSlots(x => x.filter((_, k) => k !== i)); setError(null); }} className={kinButtonClass("ghost")} aria-label={`Bỏ khung giờ ${i + 1}`}>Bỏ khung giờ</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-4">
                <button type="button" className={kinButtonClass("secondary")}
                  onClick={() => { setSlots(x => [...x, { dayOfWeek: x.length ? x[x.length - 1].dayOfWeek : 2, startTime: "19:00", endTime: "20:30" }]); setError(null); }}>Thêm khung giờ</button>
              </div>
              {slots.length > 0 && (
                <>
                  <div className="pt-5 grid sm:grid-cols-2 gap-5">
                    <label className={LABEL}>Buổi đầu từ ngày
                      <input type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)} className={`${FIELD} mt-2`} />
                    </label>
                    <label className={LABEL}>Xem trước số tuần
                      <select value={weeks} onChange={e => setWeeks(Number(e.target.value))} className={`${FIELD} mt-2`}>
                        {Array.from({ length: WIZARD_WEEKS_MAX - WIZARD_WEEKS_MIN + 1 }, (_, i) => WIZARD_WEEKS_MIN + i).map(w => <option key={w} value={w}>{w} tuần</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" data-wizard-preview>
                    Lịch lặp hằng tuần: trong {weeks} tuần kể từ {openKey.split("-").reverse().join("/")} có {sessionCount} buổi. Buổi học sinh ra từ lịch tuần; KiN không tạo sẵn bản ghi từng buổi.
                  </p>
                </>
              )}
            </section>
          )}

          {error && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{error}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {step > 1 && <button type="button" onClick={back} disabled={busy} className={kinButtonClass("secondary")}>Quay lại</button>}
            {step < 3
              ? <button type="button" onClick={next} className={kinButtonClass("primary")}>Tiếp tục</button>
              : <KinButton type="submit" loading={busy} loadingLabel="Đang tạo lớp…">{createButtonLabel(sessionCount)}</KinButton>}
            <Link href="/lop-cua-toi/lop" className={kinButtonClass("ghost")}>Hủy</Link>
            <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">KiN không gửi tin nhắn tự động.</span>
          </div>
        </div>

        <aside className="min-w-0 space-y-[var(--kin-cach-muc)]">
          <KinCallout title="Sổ dạy học, theo nhịp của cô">
            Tạo lớp, lên buổi, điểm danh, rồi mời học sinh vào lớp bằng mã.
          </KinCallout>
          <section aria-labelledby="tl-sau">
            <KinSectionHead id="tl-sau" title="Sau khi tạo lớp" />
            <ul className="pt-4 space-y-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
              <li>Mời học sinh bằng mã lớp (KiN mở sẵn tab Mã mời)</li>
              <li>Thêm khung giờ nếu chưa xếp lịch</li>
              <li>Điểm danh từng buổi ngay trong trang lớp</li>
            </ul>
            <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Tất cả đều tùy chọn và có thể làm sau.</p>
          </section>
          <section aria-labelledby="tl-ra-mat">
            <KinSectionHead id="tl-ra-mat" title="Giai đoạn ra mắt" />
            <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Miễn phí toàn bộ tính năng.</p>
            <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Không cần thẻ, không giới hạn lớp và học sinh đang áp dụng.</p>
          </section>
        </aside>
      </div>
    </form>
  );
}
