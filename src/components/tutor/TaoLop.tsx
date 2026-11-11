// BU-01: 3 bước đổi thành Thông tin → Lịch học → Cách vào lớp. Bước 1 có "Học phí: Miễn phí | Có học phí" (Miễn phí ẩn "Cách tính học phí", gửi tag "Miễn phí", không gửi feeMode/feeRate);
// bước 3 chọn Cô duyệt (mặc định) / Chỉ mã mời / Vào ngay (chỉ khi Miễn phí) và có mục gập "Thêm sẵn em đã học lớp khác" (StudentPicker, không mất tính năng cũ). Figma khung mới: chưa dựng.
// "Tạo lớp" của gia sư, WIZARD 3 BƯỚC (LO-03; Figma "Gia sư · Tạo lớp đầu tiên" 299:112849, bản cũ: Thông tin → Học sinh → Lịch học); nút cuối "Tạo lớp + N buổi".
// Bước 1 gồm cả "Cách tính học phí" (HP-15: chọn LÚC TẠO LỚP; HOCPHI-THEO-BUOI: mặc định Theo buổi, Theo giờ/Theo khoá nằm trong mục gập, cách cũ bỏ khỏi lớp mới; không đổi được hình thức của lớp đã tạo; số tiền do máy chủ tính).
// Bước 2: chỉ thêm được em ĐÃ học một lớp khác của gia sư (StudentPicker); em mới vào lớp bằng mã mời (KiN mở sẵn mục Mã mời sau khi tạo). Không thu thêm dữ liệu trẻ ở đây.
// TUT-lich-keo-tha: bước Lịch học BẮT BUỘC — dựng bằng WeekScheduleEditor (kéo-thả, chế độ cục bộ) và gửi cùng một lần POST /api/courses kèm schedules[] + requireSchedule
// (tạo lớp + khung giờ nguyên tử). Lối thoát duy nhất: "Lớp này học buổi lẻ, không lặp hằng tuần" -> KinConfirm -> noFixedSchedule.
// (Mô tả cũ bên dưới về "gửi khung tuần tự sau khi tạo lớp" không còn đúng.)
// Bước 3 (cũ): một hoặc nhiều khung giờ hằng tuần + ngày buổi đầu + số tuần xem trước. "N buổi" là số buổi lịch lặp sinh ra trong khoảng đó (previewSessionCount) — chỉ để hiển thị;
// buổi học thật do lịch tuần sinh ra, KiN không ghi sẵn bản ghi từng buổi.
// Gọi đúng API cũ: POST /api/courses (giá/bài học mặc định 0), POST khung giờ, rồi POST /api/tutor/lop/[id]/hoc-sinh (nếu có chọn em). Lớp đã tạo mà một phần sau lỗi thì KHÔNG bắt tạo lại:
// đưa tới trang lớp và nói rõ phần nào chưa lưu. "Buổi đầu" mặc định là hôm nay giờ VN.
"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toSlug } from "@/lib/slug";
import { ADMIN_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { vnDateKeyOf } from "@/lib/classSessions";
import { FEE_MODE_HINT, FEE_MODE_SHEET, FEE_RATE_MIN, FEE_MODE_LABEL, FEE_RATE_UNIT, hourlyAmount, isNewFeeMode, validateFeeSetup, type NewFeeMode } from "@/lib/tuitionFee";
import {
  ADD_STUDENTS_MAX, WIZARD_WEEKS_MAX, WIZARD_WEEKS_MIN, createButtonLabel, previewSessionCount,
} from "@/lib/tutorStudentView";
import WeekScheduleEditor from "@/components/tutor/WeekScheduleEditor";
import { WEEKDAY_NAMES, applyOp, formatDuration, fromApiRow, toApiSlot, toWizardSlots, validateBlocks, weeklyMinutes, WEEK_ORDER, type OpResult, type ScheduleBlock, type ScheduleOp } from "@/lib/scheduleDrag";
import { classAccentFor } from "@/lib/classColor";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { hmOf } from "@/lib/classSessions";
import { KinButton, kinButtonClass } from "@/components/kin";
import { KinInput } from "@/components/kin/Input";
import { useFieldValidation } from "@/components/kin/useFieldValidation";
import { required, type FieldRule } from "@/lib/fieldRules";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinPageHeader, KIN_PAGE, KIN_TWO_COL, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import StudentPicker from "@/components/tutor/StudentPicker";
import { jfetch } from "@/components/tutor/studentUi";
import { FREE_CLASS_TAG, type JoinPolicy } from "@/lib/joinRequest";
import { legacyClassTarget } from "@/lib/tutorClassRoutes";

const FIELD = KIN_FIELD;
const LABEL = KIN_LABEL;
const hmText = (m: number) => (m >= 1440 ? "24:00" : hmOf(m));
type Step = 1 | 2 | 3;
const STEPS: { n: Step; label: string }[] = [{ n: 1, label: "Thông tin" }, { n: 2, label: "Lịch học" }, { n: 3, label: "Cách vào lớp" }];
const POLICY_CARDS: { value: JoinPolicy; title: string; hint: string }[] = [
  { value: "approve", title: "Cô duyệt", hint: "Học sinh xin vào lớp, cô duyệt từng bạn. Nên chọn khi lớp công khai." },
  { value: "invite_only", title: "Chỉ mã mời", hint: "Chỉ ai có mã cô gửi mới vào được, vào ngay không cần duyệt." },
  { value: "open", title: "Vào ngay", hint: "Học sinh bấm Vào lớp là vào ngay. Chỉ dành cho lớp miễn phí." },
];

export default function TaoLop() {
  const router = useRouter();
  const todayKey = vnDateKeyOf(new Date());
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [options, setOptions] = useState<string[]>([...ADMIN_CATEGORIES]);
  const [feeMode, setFeeMode] = useState<NewFeeMode>("per_session"); // HOCPHI-THEO-BUOI: lớp mới mặc định theo buổi; cách cũ không còn trong lựa chọn
  const [feeRate, setFeeRate] = useState("");
  const [feeMinutes, setFeeMinutes] = useState("90");
  const [free, setFree] = useState(false);                       // BU-01: "Miễn phí" (dấu do gia sư tick) — mặc định "Có học phí" = hành vi cũ
  const [policy, setPolicy] = useState<JoinPolicy>("approve");  // BU-01: mặc định Cô duyệt
  const [students, setStudents] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);        // khung giờ hằng tuần (bước Lịch học, BẮT BUỘC ≥ 1 hoặc chọn "buổi lẻ")
  const [noFixed, setNoFixed] = useState(false);                     // "Lớp này học buổi lẻ" đã qua KinConfirm
  const [ghosts, setGhosts] = useState<ScheduleBlock[]>([]);         // khung của lớp khác của cô: chỉ để cảnh báo trùng giờ
  const [ghostState, setGhostState] = useState<"loading" | "ok" | "error">("loading");
  const { ask, dialog: confirmDialog } = useKinConfirm();
  const [firstDate, setFirstDate] = useState(todayKey);
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories").then(r => (r.ok ? r.json() : { categories: [] }))
      .then(d => { const cats = (d.categories as { name: string }[]).map(c => c.name); if (cats.length) setOptions([...new Set([...ADMIN_CATEGORIES, ...cats])]); })
      .catch(() => {});
  }, []);

  // Khung lớp khác của cô (một lần). Lỗi KHÔNG chặn tạo lớp, chỉ mất cảnh báo trùng giờ.
  useEffect(() => {
    let live = true;
    fetch("/api/tutor/khung-gio", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (!live) return; setGhosts((Array.isArray(d.rules) ? d.rules : []).map((x: unknown) => fromApiRow(x)).filter((b: ScheduleBlock | null): b is ScheduleBlock => !!b)); setGhostState("ok"); })
      .catch(() => { if (live) setGhostState("error"); });
    return () => { live = false; };
  }, []);

  // HT-02: kiểm tại chỗ ở bước 1. Câu báo không chứa nội dung cô đã gõ; đơn giá/phút dùng đúng luật máy chủ (validateFeeSetup).
  const formRef = useRef<HTMLFormElement>(null);
  const rules = useMemo<Record<string, readonly FieldRule[]>>(() => {
    const r: Record<string, readonly FieldRule[]> = { name: [required("Cô nhập tên lớp trước nhé.")] };
    // HP-LOP-TRUONG: "Theo bảng học phí tháng" không hỏi đơn giá lúc tạo lớp (cô đặt bảng bậc ở tab Học phí sau).
    if (!free && isNewFeeMode(feeMode) && feeMode !== FEE_MODE_SHEET) {
      r.feeRate = [v => { const x = validateFeeSetup({ mode: feeMode, rate: Number(v), sessionMinutes: 90 }); return x.ok ? null : x.error; }];
      if (feeMode === "per_hour") r.feeMinutes = [v => { const x = validateFeeSetup({ mode: feeMode, rate: FEE_RATE_MIN, sessionMinutes: Number(v) }); return x.ok ? null : x.error; }];
    }
    return r;
  }, [feeMode, free]);
  const fv = useFieldValidation(rules);

  const openKey = firstDate || todayKey;
  const className = name.trim() || "Lớp mới";
  const shownBlocks = useMemo(() => blocks.map(b => ({ ...b, courseName: className })), [blocks, className]);
  const activeBlocks = blocks.filter(b => b.active !== false);
  const sessionCount = previewSessionCount(toWizardSlots(blocks), openKey, weeks);
  // Chế độ cục bộ: mọi thao tác chỉ đổi state, ghi thật khi bấm "Tạo lớp".
  const onLocalOp = (op: ScheduleOp): OpResult => {
    setBlocks(cur => applyOp(cur, op));
    if (op.type === "create") setNoFixed(false);
    setError(null);
    return { ok: true };
  };

  function checkInfo(): string | null {
    if (!name.trim()) return "Cô nhập tên lớp trước nhé.";
    if (!free && isNewFeeMode(feeMode) && feeMode !== FEE_MODE_SHEET) { const v = validateFeeSetup({ mode: feeMode, rate: Number(feeRate), sessionMinutes: Number(feeMinutes) }); if (!v.ok) return v.error; }
    return null;
  }
  function next() {
    if (step === 1 && !fv.validateAll({ name, feeRate, feeMinutes })) { setError(checkInfo()); fv.focusFirst(formRef.current); return; }
    if (step === 2) {
      const bad = validateBlocks(blocks);
      if (bad) { setError(bad); return; }
      if (activeBlocks.length === 0 && !noFixed) {
        setError("Cô thêm ít nhất một khung giờ học hằng tuần, hoặc chọn 'Lớp này học buổi lẻ' bên dưới.");
        formRef.current?.querySelector<HTMLElement>("[data-add-block]")?.focus();
        return;
      }
    }
    setError(null); setStep(s => (s < 3 ? ((s + 1) as Step) : s));
  }
  function back() { setError(null); setStep(s => (s > 1 ? ((s - 1) as Step) : s)); }
  async function chooseOneOff() {
    const ok = await ask({
      title: "Tạo lớp không có lịch cố định?",
      message: "Lớp sẽ chưa có lịch cố định. KiN sẽ nhắc cô ở Hộp việc cho tới khi cô đặt lịch. Vẫn tạo lớp không lịch?",
      confirmLabel: "Vẫn tạo không lịch", cancelLabel: "Quay lại", tone: "thuong",
    });
    if (ok) { setNoFixed(true); setError(null); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (step < 3) { next(); return; } // Enter ở bước đầu = sang bước tiếp, không tạo lớp
    const clean = name.trim();
    const infoErr = checkInfo();
    if (infoErr) { setError(infoErr); setStep(1); fv.validateAll({ name, feeRate, feeMinutes }); fv.focusFirst(formRef.current); return; }
    const slotErr = validateBlocks(blocks);
    if (slotErr) { setError(slotErr); setStep(2); return; }
    if (activeBlocks.length === 0 && !noFixed) { setError("Cô thêm ít nhất một khung giờ học hằng tuần, hoặc chọn 'Lớp này học buổi lẻ'."); setStep(2); return; }
    let fee: Record<string, unknown> = {};
    if (!free && feeMode === FEE_MODE_SHEET) {
      fee = { feeMode: FEE_MODE_SHEET }; // không gửi feeRate: lớp bảng tháng không có đơn giá lớp
    } else if (!free && isNewFeeMode(feeMode)) {
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
        types: ["Video"], tag: free ? FREE_CLASS_TAG : null, tagColor: null,
        bg: CATEGORY_GRADIENT[cat] ?? "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)",
        joinPolicy: policy, price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
        // Tạo lớp + khung giờ trong MỘT giao dịch (không còn cảnh "lớp có rồi, khung giờ lỗi").
        schedules: activeBlocks.map(toApiSlot), requireSchedule: true, noFixedSchedule: activeBlocks.length === 0 && noFixed,
      };
      await api.courses.create(payload);
    } catch (err) {
      setError(`Chưa tạo được lớp: ${err instanceof Error ? err.message : "lỗi không rõ"}. Cô kiểm tra tên lớp rồi bấm lại.`);
      setBusy(false);
      return;
    }
    // Lớp (kèm khung giờ) đã tạo: từ đây KHÔNG bắt tạo lại. Chỉ phần thêm em còn có thể lỗi riêng.
    let added: number | null = null, addFailed = false;
    if (students.length) {
      const r = await jfetch(`/api/tutor/lop/${slug}/hoc-sinh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userIds: students }) });
      if (r.ok) added = r.json?.added ?? 0; else addFailed = true;
    }
    // "Cách học sinh vào lớp": lớp dùng mã (Chỉ mã mời / Cô duyệt) có sẵn MỘT mã lớp ngay khi tạo (idempotent: ensure). Lỗi thì không chặn, trang lớp có nút "Tạo mã lớp".
    let codeFailed = false;
    if (policy !== "open") {
      try {
        const r = await jfetch(`/api/courses/${slug}/invites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ensure: true }) });
        if (!r.ok) codeFailed = true;
      } catch { codeFailed = true; }
    }
    const qs = new URLSearchParams({ tab: "ma-moi", moi: "1" });
    if (added !== null) qs.set("them", String(added));
    if (addFailed) qs.set("them", "loi");
    if (codeFailed) qs.set("ma", "loi"); // trang lớp báo một dòng, không chặn việc tạo lớp
    // GS-LOP-GON: lớp mới hạ cánh thẳng ở tab Học sinh › Mã mời (cùng đích mà /lop-cua-toi/<slug>?tab=ma-moi&moi=1 sẽ chuyển tới), không vòng qua chuyển hướng.
    router.push(legacyClassTarget(slug, qs));
  }

  return (
    <form ref={formRef} noValidate onSubmit={e => void submit(e)} className={KIN_PAGE} aria-label="Tạo lớp">
      <KinPageHeader title="Tạo lớp học" sub="Ba bước. Lớp nào cũng cần lịch học để học sinh thấy buổi và để KiN nhắc lịch."
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
                  <KinInput label="Tên lớp *" value={name} onChange={e => { setName(e.target.value); setError(null); }} placeholder="Ví dụ: Toán 9" autoComplete="off"
                    aria-required {...fv.bind("name", name)} />
                  <label className={LABEL}>Môn · khối
                    <input list="tl-mon" value={category} onChange={e => setCategory(e.target.value)} placeholder="Ví dụ: Toán · Lớp 9" className={`${FIELD} mt-2`} />
                    <datalist id="tl-mon">{options.map(o => <option key={o} value={o} />)}</datalist>
                  </label>
                </div>
              </section>

              <section aria-labelledby="tl-hp">
                <KinSectionHead id="tl-hp" title="Học phí" aside="Chọn một" />
                <fieldset className="pt-5">
                  <legend className="sr-only">Lớp có thu học phí không</legend>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {([[true, "Miễn phí", "Lớp không thu học phí. Cô vẫn có thể tự nhập đơn giá sau nếu cần."], [false, "Có học phí", "Chọn cách tính học phí ngay bên dưới."]] as const).map(([v, t, h]) => (
                      <label key={t} className={`flex items-start gap-3 min-h-[var(--kin-cham-toi-thieu)] p-3 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] ${free === v ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-o-nhap)]"}`}>
                        <input type="radio" name="tl-free" className="mt-1" checked={free === v}
                          onChange={() => { setFree(v); setError(null); if (!v && policy === "open") setPolicy("approve"); }} />
                        <span><span className="font-medium text-[var(--kin-chu-chinh)]">{t}</span><span className="block text-[var(--kin-chu-mo)]">{h}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>

              {free ? (
                <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" data-fee-free-note>Lớp miễn phí không có học phí.</p>
              ) : <section aria-labelledby="tl-phi">
                <KinSectionHead id="tl-phi" title="Cách tính học phí" aside="Theo buổi là mặc định" />
                <fieldset className="pt-5">
                  <legend className="sr-only">Cách tính học phí của lớp</legend>
                  <label className="flex items-start gap-3 min-h-[var(--kin-cham-toi-thieu)] p-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                    <input type="radio" name="tl-fee-mode" className="mt-1" checked={feeMode === "per_session"} onChange={() => { setFeeMode("per_session"); setError(null); }} />
                    <span><span className="font-medium">{FEE_MODE_LABEL.per_session}</span> · mặc định
                      <span className="block text-[var(--kin-chu-mo)]">{FEE_MODE_HINT.per_session}</span></span>
                  </label>
                </fieldset>
                <div className="pt-4 grid sm:grid-cols-2 gap-5">
                  {feeMode !== FEE_MODE_SHEET && <KinInput label={`Đơn giá (${FEE_RATE_UNIT[feeMode]}) *`} inputMode="numeric" value={feeRate} onChange={e => { setFeeRate(e.target.value.replace(/[^\d]/g, "")); setError(null); }}
                    placeholder="Ví dụ: 150000" aria-required {...fv.bind("feeRate", feeRate)} />}
                  {feeMode === "per_hour" && (
                    <KinInput label="Một buổi dài (phút) *" inputMode="numeric" value={feeMinutes} onChange={e => { setFeeMinutes(e.target.value.replace(/[^\d]/g, "")); setError(null); }}
                      aria-required {...fv.bind("feeMinutes", feeMinutes)} />
                  )}
                  {feeMode === FEE_MODE_SHEET ? (
                    <p className="sm:col-span-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]" data-fee-sheet-note>
                      Cô chưa cần nhập đơn giá lúc này. Sau khi tạo lớp, cô vào tab Học phí để đặt bảng bậc theo số môn (KiN điền sẵn từ lớp trước của cô nếu có), rồi mỗi tháng nhập số buổi từng môn của từng em từ Excel hoặc Google Sheet. KiN cho cô xem trước, cô xác nhận mới ghi.
                    </p>
                  ) : (
                  <p className="sm:col-span-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                    {feeMode === "per_hour" && Number(feeRate) > 0 && Number(feeMinutes) > 0
                      ? `Mỗi buổi ${Number(feeMinutes)} phút tính ${hourlyAmount(Number(feeRate), Number(feeMinutes)).toLocaleString("vi-VN")}đ (làm tròn từng buổi). `
                      : ""}
                    Học phí sinh ra khi cô bấm Đã dạy xong, cho em có mặt hoặc đi muộn. Em vắng hoặc có phép không tính. Phiếu đã chốt không đổi khi cô đổi đơn giá sau.
                  </p>
                  )}
                </div>
                <details className="mt-4 border-t border-[var(--kin-vien-nhat)] pt-2" data-fee-other open={feeMode !== "per_session"}>
                  <summary className="inline-flex items-center min-h-11 cursor-pointer text-[var(--kin-nhan-link)] underline">Cách tính khác (ít dùng){feeMode !== "per_session" ? ` · đang chọn: ${FEE_MODE_LABEL[feeMode]}` : ""}</summary>
                  <fieldset className="pt-2">
                    <legend className="sr-only">Cách tính học phí khác</legend>
                    <div className="space-y-2">
                      {(["per_hour", "per_course", FEE_MODE_SHEET] as const).map(m => (
                        <label key={m} className="flex items-start gap-3 min-h-[var(--kin-cham-toi-thieu)] py-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                          <input type="radio" name="tl-fee-mode" className="mt-1" checked={feeMode === m} onChange={() => { setFeeMode(m); setError(null); }} />
                          <span><span className="font-medium">{FEE_MODE_LABEL[m]}</span>
                            <span className="block text-[var(--kin-chu-mo)]">{FEE_MODE_HINT[m]}</span></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </details>
              </section>}
            </>
          )}

          {step === 3 && (
            <>
              <section aria-labelledby="tl-vao">
                <KinSectionHead id="tl-vao" title="Cách vào lớp" aside="Đổi được sau" />
                <fieldset className="pt-5">
                  <legend className="sr-only">Cách học sinh vào lớp</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {POLICY_CARDS.map(c => {
                      const locked = c.value === "open" && !free;
                      return (
                        <label key={c.value} data-policy={c.value} className={`flex items-start gap-3 min-h-[var(--kin-cham-toi-thieu)] p-3 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] ${locked ? "opacity-60" : ""} ${policy === c.value ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-o-nhap)]"}`}>
                          <input type="radio" name="tl-policy" className="mt-1" checked={policy === c.value} disabled={locked} onChange={() => { setPolicy(c.value); setError(null); }} />
                          <span><span className="font-medium text-[var(--kin-chu-chinh)]">{c.title}</span>
                            <span className="block text-[var(--kin-chu-mo)]">{locked ? "Chỉ chọn được khi lớp miễn phí. Cô quay lại bước 1 để chọn Miễn phí." : c.hint}</span></span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                {policy === "open" && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Lớp hiện ở trang Khóa học công khai, ai có tài khoản học sinh cũng vào được.</p>}
                {policy === "approve" && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Học sinh xin vào lớp, cô duyệt ở tab Học sinh của lớp.</p>}
              </section>
              <details className="border-t border-[var(--kin-vien-nhat)] pt-4" data-wizard-students>
                <summary className="inline-flex items-center min-h-11 cursor-pointer text-[var(--kin-nhan-link)] underline">Thêm sẵn em đã học lớp khác của cô (không bắt buộc){students.length ? ` · đã chọn ${students.length}` : ""}</summary>
                <p className="pt-3 pb-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
                  Chọn em đã học một lớp khác của cô để thêm ngay. Em mới thì cô gửi mã mời hoặc link lớp sau khi tạo lớp, em tự vào lớp.
                </p>
                <StudentPicker selected={students} onChange={ids => { setStudents(ids); setError(null); }} max={ADD_STUDENTS_MAX} />
              </details>
            </>
          )}

          {step === 2 && (
            <section aria-labelledby="tl-lich" data-wizard-schedule>
              <KinSectionHead id="tl-lich" title="Lịch học" aside="Bắt buộc" />
              <p className="pt-3 pb-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Kéo trên lưới để đặt giờ học hằng tuần của lớp. Bấm vào khối để sửa chi tiết hoặc đổi giờ bằng bộ chọn.</p>
              <WeekScheduleEditor blocks={shownBlocks} ghosts={ghosts} accent={classAccentFor(toSlug(className) || "lop")} state="ready" onOp={onLocalOp} courseLabel={className} />
              {ghostState === "loading" && <p role="status" data-ghost-loading className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang kiểm lịch các lớp khác của cô…</p>}
              {ghostState === "error" && <p role="status" data-ghost-error className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa kiểm được trùng với lớp khác — vẫn tạo được.</p>}

              <div className="pt-5" data-wizard-summary>
                <KinSectionHead title="Tóm tắt lịch" aside={<span className="tabular-nums">{activeBlocks.length ? `Tổng ${formatDuration(weeklyMinutes(blocks))} mỗi tuần` : ""}</span>} />
                {activeBlocks.length === 0 ? (
                  <p className="pt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{noFixed ? "Lớp này sẽ tạo không có lịch cố định (buổi lẻ). Thêm một khung giờ nếu cô muốn lịch lặp hằng tuần." : "Lớp chưa có khung giờ. Kéo trên lưới để thêm."}</p>
                ) : (
                  <ul className="pt-3 space-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" aria-label="Khung giờ hằng tuần">
                    {[...activeBlocks].sort((x, y) => WEEK_ORDER.indexOf(x.dayOfWeek as typeof WEEK_ORDER[number]) - WEEK_ORDER.indexOf(y.dayOfWeek as typeof WEEK_ORDER[number]) || x.startMin - y.startMin).map(b => (
                      <li key={b.id} data-wizard-slot className="tabular-nums">{WEEKDAY_NAMES[b.dayOfWeek]} {hmText(b.startMin)}–{hmText(b.endMin)} · {formatDuration(b.endMin - b.startMin)}</li>
                    ))}
                  </ul>
                )}
                {activeBlocks.length === 0 && !noFixed && (
                  <button type="button" onClick={() => void chooseOneOff()} data-one-off className="mt-3 inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Lớp này học buổi lẻ, không lặp hằng tuần</button>
                )}
              </div>

              {activeBlocks.length > 0 && (
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
              <li>Mời học sinh bằng mã lớp (KiN mở sẵn mục Mã mời)</li>
              <li>Lịch học đặt ngay ở bước 2; đổi lại bằng lưới kéo-thả ở trang lớp.</li>
              <li>Điểm danh từng buổi ngay trong trang lớp</li>
            </ul>
          </section>
          <section aria-labelledby="tl-ra-mat">
            <KinSectionHead id="tl-ra-mat" title="Giai đoạn ra mắt" />
            <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Miễn phí toàn bộ tính năng.</p>
            <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Không cần thẻ, không giới hạn lớp và học sinh đang áp dụng.</p>
          </section>
        </aside>
      </div>
      {confirmDialog}
    </form>
  );
}
