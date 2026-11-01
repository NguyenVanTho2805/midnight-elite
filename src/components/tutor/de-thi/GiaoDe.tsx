// BU-03 P3 · S7 — Giao đề (/lop-cua-toi/de-thi/[id]/giao): cấu hình rút gọn trong 4 nhóm (Đối tượng · Thời gian · Truy cập · Hiển thị) + chế độ Luyện tập / Kiểm tra.
// Dữ liệu: GET/PATCH/POST /api/tutor/de-thi/[id]/giao (hợp đồng BU-03 mục P3.3) + GET /api/tutor/quiz/[id] (có sẵn: tên đề, active, số lượt làm, câu hỏi để quét nhãn ⟦công thức⟧)
// + POST /api/tutor/quiz/[id]/publish (có sẵn) cho nút Phát hành. KHÔNG có ô giá, không có "cho khách" (TIỀN, đã LOẠI P27).
// Mật khẩu: chỉ ghi, KHÔNG BAO GIỜ hiện lại — sau khi lưu chỉ còn chữ “Đã đặt”. Giám sát thoát màn hình: chỉ ghi nhận, không phạt, không tự nộp.
// Chặn phát hành luôn kèm LÝ DO: công thức chưa đọc, đề nhiều mã khi phòng thi chưa hỗ trợ, “giao theo link” khi cờ chưa bật, kiểm tra thiếu giờ, chưa chọn lớp.
// Khi đã có lượt làm (HAS_ATTEMPTS): khoá chế độ, lớp, thời lượng — phần còn lại vẫn sửa được.
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPanel } from "@/components/kin/Panel";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import { KinToast } from "@/components/kin/Toast";
import { KinChevron } from "@/components/kin/Fold";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { qfetch, type QuizDetail } from "@/components/tutor/quiz/quizClient";
import { AUDIENCE_LINK_READY, VARIANT_STUDENT_SUPPORT } from "@/lib/deThiAssign";
import {
  deThiDetailHref, deThiKetQuaHref, deThiListHref, deThiSubHref, dongMoGiao, fetchCourseNames, fetchGiao, giaoProblem, GIAO_ERROR_TEXT, hasFormulaPlaceholder,
  LOCKED_WHEN_ATTEMPTS, MODE_BLURB, MODE_DEFAULTS, MODE_LABEL, patchGiao, PUBLISH_BLOCK_TEXT, viewLevelOf, VIEW_LEVELS, warningText,
  type ExamMode, type GiaoCfg, type GiaoPatch, type ViewLevel,
} from "./deThiClient";

interface Form {
  mode: ExamMode | ""; audience: "lop" | "link"; courseId: string;
  dateKey: string; time: string; duration: string;
  unlimited: boolean; attempts: string;
  level: ViewLevel; hideWrong: boolean; board: boolean;
  password: string;
}

const variantsOf = (v: GiaoCfg["variants"]): number => Array.isArray(v) ? v.length : Number(v) || 0;

function formFrom(c: GiaoCfg, lop: string | null): Form {
  const link = AUDIENCE_LINK_READY && !c.courseId && c.status !== "draft";
  return {
    mode: c.mode ?? "", audience: link ? "link" : "lop", courseId: c.courseId ?? (c.status === "draft" && lop ? lop : ""),
    dateKey: c.dateKey ?? "", time: c.time ?? "", duration: c.durationMin ? String(c.durationMin) : "",
    unlimited: c.maxAttempts == null, attempts: String(c.maxAttempts ?? 1),
    level: viewLevelOf(c), hideWrong: c.hideAnswerForWrong, board: c.showLeaderboard, password: "",
  };
}

/** Phần khác biệt giữa biểu mẫu và cấu hình đang lưu → thân PATCH. Các khoá bị khoá (đã có lượt làm) không bao giờ được gửi. */
function patchOf(f: Form, c: GiaoCfg, locked: boolean): GiaoPatch {
  const p: GiaoPatch = {};
  const lockedKey = (k: (typeof LOCKED_WHEN_ATTEMPTS)[number]) => locked && (LOCKED_WHEN_ATTEMPTS as readonly string[]).includes(k);
  if (f.mode && f.mode !== c.mode && !lockedKey("mode")) p.mode = f.mode;
  const course = f.audience === "link" ? null : f.courseId || null;
  if (course !== c.courseId && !lockedKey("courseId")) p.courseId = course;
  if ((f.dateKey || null) !== (c.dateKey ?? null)) p.dateKey = f.dateKey || null;
  if ((f.time || null) !== (c.time || null)) p.time = f.time || null;
  const dur = f.duration.trim() ? Number(f.duration) : null;
  if (dur !== (c.durationMin ?? null) && !lockedKey("durationMin")) p.durationMin = dur;
  const att = f.unlimited ? null : Number(f.attempts);
  if (att !== c.maxAttempts) p.maxAttempts = att;
  const hold = f.level === "hold";
  if (hold !== c.holdUntilPublish) p.holdUntilPublish = hold;
  if (f.level !== "hold" && f.level !== c.answerVisibility) p.answerVisibility = f.level;
  if (hold && c.answerVisibility === "never") p.answerVisibility = "after_submit";
  if (f.hideWrong !== c.hideAnswerForWrong) p.hideAnswerForWrong = f.hideWrong;
  if (f.board !== c.showLeaderboard) p.showLeaderboard = f.board;
  if (f.password) p.password = f.password;
  return p;
}

function Group({ id, title, hint, children, open = true }: { id: string; title: string; hint?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]" data-giao-nhom={id}>
      <summary className="flex items-center justify-between gap-3 min-h-11 px-4 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{title}</span>
          {hint && <span className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{hint}</span>}
        </span>
        <span aria-hidden className="flex-shrink-0 text-[var(--kin-chu-mo)] group-open:rotate-180 transition-transform"><KinChevron open={false} /></span>
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-4 min-w-0">{children}</div>
    </details>
  );
}

function Radio({ name, checked, onChange, disabled, label, hint, value }: { name: string; checked: boolean; onChange: () => void; disabled?: boolean; label: string; hint?: string; value: string }) {
  return (
    <label className={`flex items-start gap-3 min-h-11 py-2 ${disabled ? "opacity-70" : "cursor-pointer"}`}>
      <input type="radio" name={name} value={value} className="w-5 h-5 mt-0.5 flex-shrink-0" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="min-w-0">
        <span className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{label}</span>
        {hint && <span className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{hint}</span>}
      </span>
    </label>
  );
}

function phaseOf(q: QuizDetail["exam"] | null): { tone: StatusTone; text: string } {
  if (!q || q.isDraft) return { tone: "cho", text: "Chưa giao" };
  if (!q.active || q.status === "completed") return { tone: "mo", text: "Đã đóng" };
  return q.status === "upcoming" ? { tone: "mo", text: "Đã lên lịch" } : { tone: "xong", text: "Đang mở" };
}

export default function GiaoDe({ id }: { id: string }) {
  const lop = useSearchParams().get("lop");
  const { ask, dialog } = useKinConfirm();
  const [cfg, setCfg] = useState<GiaoCfg | null>(null);
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [lockedByServer, setLockedByServer] = useState(false);
  const [busy, setBusy] = useState<"luu" | "phat-hanh" | "dong-mo" | "xoa-mk" | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "xong" | "loi"; title: string; detail?: string } | null>(null);
  const [modeNote, setModeNote] = useState<string | null>(null);

  const load = useCallback(async (keepForm = false) => {
    const [g, q, c] = await Promise.all([fetchGiao(id), qfetch<QuizDetail>("GET", `/api/tutor/quiz/${id}`), fetchCourseNames()]);
    const bad = !g.ok || !g.data ? g : !q.ok || !q.data ? q : null;
    if (bad) {
      if (bad.code === "IS_VARIANT") { setGone("Đây là một mã đề con nên không có cấu hình giao riêng. Cô mở đề gốc để giao đề."); return; }
      if (bad.status === 403 || bad.status === 404) { setGone(bad.status === 403 ? "Đề này không phải của cô." : "Đề có thể đã bị xoá."); return; }
      setErr(bad.error ?? "Chưa tải được cấu hình giao đề."); return;
    }
    setErr(null); setGone(null); setCfg(g.data); setQuiz(q.data); setCourses(c.length ? c : q.data!.courses);
    if (!keepForm) setForm(formFrom(g.data!, lop));
  }, [id, lop]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const exam = quiz?.exam ?? null;
  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);
  const locked = lockedByServer || (cfg?.attemptCount ?? exam?.attemptCount ?? 0) > 0;
  const superseded = !!exam?.supersededById;
  const draft = !!exam?.isDraft;
  const patch = useMemo(() => (cfg && form ? patchOf(form, cfg, locked) : {}), [cfg, form, locked]);
  const dirty = Object.keys(patch).length > 0;
  const nVariants = cfg ? variantsOf(cfg.variants) : 1;
  const formulaQs = useMemo(() => questions.map((q, i) => ({ n: i + 1, bad: hasFormulaPlaceholder(q.text) || q.options.some(o => hasFormulaPlaceholder(o.text)) })).filter(x => x.bad).map(x => x.n), [questions]);

  const set = (p: Partial<Form>) => setForm(f => (f ? { ...f, ...p } : f));
  function pickMode(m: ExamMode) {
    if (!form || locked) return;
    const d = MODE_DEFAULTS[m];
    set({ mode: m, unlimited: d.maxAttempts == null, attempts: String(d.maxAttempts ?? 1), level: d.answerVisibility, hideWrong: d.hideAnswerForWrong, board: d.showLeaderboard });
    setModeNote(`Đã đặt sẵn các mục theo chế độ ${MODE_LABEL[m]}. Cô chỉnh tiếp ở các nhóm bên dưới nếu muốn.`);
  }

  // Merge để kiểm: giá trị sau khi áp biểu mẫu lên cấu hình đang lưu.
  const merged = useMemo(() => cfg && form ? {
    mode: (form.mode || cfg.mode) as ExamMode | null, dateKey: form.dateKey || null, time: form.time || null,
    durationMin: form.duration.trim() ? Number(form.duration) : null, maxAttempts: form.unlimited ? null : Number(form.attempts),
  } : null, [cfg, form]);
  const problem = merged ? giaoProblem(merged) : null;

  const blockers: string[] = [];
  if (form && cfg) {
    if (formulaQs.length) blockers.push(`${PUBLISH_BLOCK_TEXT.FORMULA_UNREAD} (Câu ${formulaQs.slice(0, 8).join(", ")}${formulaQs.length > 8 ? "…" : ""}.)`);
    if (nVariants > 1 && !VARIANT_STUDENT_SUPPORT) blockers.push(PUBLISH_BLOCK_TEXT.VARIANTS_NOT_READY);
    if (form.audience === "link" && !AUDIENCE_LINK_READY) blockers.push("Giao theo link chưa mở: phòng thi của học sinh chưa tách riêng đề giao theo link khỏi danh sách chung. Cô giao cho một lớp.");
    if (form.audience === "lop" && !form.courseId) blockers.push("Cô chọn lớp sẽ làm đề này.");
    if (problem) blockers.push(problem);
    if (questions.length === 0) blockers.push("Đề chưa có câu nào. Cô thêm câu ở trình soạn đề.");
  }

  async function save(): Promise<boolean> {
    if (!cfg || !form) return false;
    if (problem) { setFormErr(problem); return false; }
    if (!dirty) return true;
    setBusy("luu"); setFormErr(null); setToast(null);
    const r = await patchGiao(id, patch);
    if (!r.ok) {
      setBusy(null);
      if (r.code === "HAS_ATTEMPTS") setLockedByServer(true);
      setFormErr((r.code && GIAO_ERROR_TEXT[r.code]) || r.error || "Chưa lưu được cấu hình.");
      return false;
    }
    const warns = (r.data?.warnings ?? []).map(warningText).filter(Boolean);
    await load();
    setBusy(null);
    setToast({ tone: "xong", title: "Đã lưu cấu hình giao đề", detail: warns[0] });
    return true;
  }

  async function publish() {
    if (!(await ask({ title: "Phát hành đề này?", message: `Học sinh trong lớp sẽ thấy đề ngay.${nVariants > 1 ? ` Cả ${nVariants} mã đề cùng được phát hành.` : ""} Sau khi phát hành, cô vẫn đóng được đề.`, confirmLabel: "Phát hành", tone: "thuong" }))) return;
    if (!(await save())) return;
    setBusy("phat-hanh"); setFormErr(null);
    const r = await qfetch<unknown>("POST", `/api/tutor/quiz/${id}/publish`);
    if (!r.ok) { setBusy(null); setFormErr((r.code && PUBLISH_BLOCK_TEXT[r.code]) || r.error || "Chưa phát hành được."); return; }
    await load(); setBusy(null);
    setToast({ tone: "xong", title: "Đã phát hành đề", detail: "Học sinh trong lớp đã thấy đề." });
  }

  async function closeOrReopen(action: "close" | "reopen") {
    if (action === "close" && !(await ask({ title: "Đóng đề này?", message: "Học sinh không vào làm được nữa. Bài đã nộp vẫn giữ nguyên. Cô mở lại được bất cứ lúc nào.", confirmLabel: "Đóng đề", tone: "thuong" }))) return;
    setBusy("dong-mo"); setFormErr(null); setToast(null);
    const r = await dongMoGiao(id, action);
    if (!r.ok) { setBusy(null); setFormErr(r.error ?? "Chưa thực hiện được."); return; }
    await load(true); setBusy(null);
    setToast({ tone: "xong", title: action === "close" ? "Đã đóng đề" : "Đã mở lại đề" });
  }

  async function clearPassword() {
    if (!(await ask({ title: "Xoá mật khẩu?", message: "Sau khi xoá, học sinh vào làm bài không cần mật khẩu.", confirmLabel: "Xoá mật khẩu", tone: "nguy-hiem" }))) return;
    setBusy("xoa-mk"); setFormErr(null); setToast(null);
    const r = await patchGiao(id, { password: null });
    if (!r.ok) { setBusy(null); setFormErr(r.error ?? "Chưa xoá được mật khẩu."); return; }
    await load(true); setBusy(null);
    set({ password: "" });
    setToast({ tone: "xong", title: "Đã xoá mật khẩu" });
  }

  if (gone) {
    return <KinPage><KinEmptyState title="Không mở được màn giao đề" action={<Link href={deThiListHref()} className={kinButtonClass("primary")}>Về Đề thi</Link>}>{gone}</KinEmptyState></KinPage>;
  }
  if (err) {
    return (
      <KinPage>
        <KinPageHeader title="Giao đề" back={{ href: deThiDetailHref(id), label: "Về đề" }} />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được cấu hình giao đề" actions={<KinButton onClick={() => { setErr(null); void load(); }}>Thử lại</KinButton>}>{err}</KinStateCard>
      </KinPage>
    );
  }
  if (!cfg || !form || !exam) return <KinPageSkeleton label="Đang tải cấu hình giao đề" rows={5} />;

  const phase = phaseOf(exam);
  const off = busy !== null || superseded;
  const courseName = courses.find(c => c.id === form.courseId)?.name;
  const test = form.mode === "test";
  const summary: [string, string][] = [
    ["Chế độ", form.mode ? MODE_LABEL[form.mode] : "Chưa chọn"],
    ["Đối tượng", form.audience === "link" ? "Giao theo link" : courseName ?? "Chưa chọn lớp"],
    ["Giờ làm", form.dateKey && form.time ? `${form.dateKey.split("-").reverse().join("/")} lúc ${form.time}${form.duration ? `, ${form.duration} phút` : ""}` : form.duration ? `${form.duration} phút, mở bất cứ lúc nào` : "Mở bất cứ lúc nào"],
    ["Số lần làm", form.unlimited ? "Không giới hạn" : `${form.attempts} lần`],
    ["Mật khẩu", cfg.hasPassword || form.password ? "Đã đặt" : "Chưa đặt"],
    ["Xem đáp án", VIEW_LEVELS.find(v => v.value === form.level)?.label ?? ""],
  ];

  return (
    <KinPage>
      {dialog}
      <KinPageHeader title={`Giao đề · ${exam.title}`} back={{ href: deThiDetailHref(id), label: "Về đề" }} sub={`${exam.questionCount} câu${nVariants > 1 ? ` · ${nVariants} mã đề` : ""}`}
        actions={<><KinStatus tone={phase.tone}>{phase.text}</KinStatus>{!draft && <Link href={deThiKetQuaHref(id)} className={kinButtonClass("secondary")}>Xem kết quả</Link>}</>} />
      {toast && <div className="mb-4"><KinToast tone={toast.tone} title={toast.title} detail={toast.detail} onClose={() => setToast(null)} /></div>}
      {superseded && <KinCallout tone="nhan" className="mb-4" title="Đây là bản cũ của đề">Cô mở phiên bản đang dùng để giao. <Link href={deThiSubHref(exam.supersededById!, "giao")} className="underline">Mở phiên bản đang dùng</Link></KinCallout>}
      {locked && !superseded && <KinCallout className="mb-4" title="Đã có học sinh làm bài">{GIAO_ERROR_TEXT.HAS_ATTEMPTS}</KinCallout>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-x-8 gap-y-6 items-start">
        <form className="min-w-0 space-y-4" onSubmit={e => { e.preventDefault(); void save(); }} aria-label="Cấu hình giao đề" noValidate>
          <fieldset disabled={superseded} className="contents">
            <Group id="che-do" title="Chế độ" hint="Luyện tập hoặc Kiểm tra">
              <div role="radiogroup" aria-label="Chế độ làm bài" className="grid sm:grid-cols-2 gap-3">
                {(["practice", "test"] as const).map(m => (
                  <label key={m} className={`rounded-[var(--kin-bo-md)] border p-3 min-h-11 ${form.mode === m ? "border-[var(--kin-nhan-link)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-thuong)]"} ${locked ? "opacity-70" : "cursor-pointer"}`}>
                    <span className="flex items-center gap-3">
                      <input type="radio" name="mode" value={m} className="w-5 h-5" checked={form.mode === m} disabled={locked || off} onChange={() => pickMode(m)} />
                      <span className="font-medium text-[var(--kin-chu-chinh)]">{MODE_LABEL[m]}</span>
                    </span>
                    <span className="block mt-1 pl-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{MODE_BLURB[m]}</span>
                  </label>
                ))}
              </div>
              {!form.mode && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đề này chưa chọn chế độ nên học sinh làm như cách cũ (giống Kiểm tra). Cô chọn một chế độ để KiN đặt sẵn các mục còn lại.</p>}
              {modeNote && <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{modeNote}</p>}
            </Group>

            <Group id="doi-tuong" title="Đối tượng" hint="Lớp nhận đề">
              <div role="radiogroup" aria-label="Giao cho ai">
                <Radio name="aud" value="lop" label="Giao cho một lớp" checked={form.audience === "lop"} onChange={() => set({ audience: "lop" })} disabled={locked || off} />
                {form.audience === "lop" && (
                  <div className="pl-8 max-w-[420px]">
                    <label htmlFor="gd-lop" className={`${KIN_LABEL} mb-2`}>Lớp</label>
                    <select id="gd-lop" className={KIN_FIELD} value={form.courseId} onChange={e => set({ courseId: e.target.value })} disabled={locked || off}>
                      <option value="">Chọn lớp…</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {courses.length === 0 && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Cô chưa có lớp. <Link className="underline" href="/lop-cua-toi/lop/tao">Tạo lớp</Link> trước rồi quay lại.</p>}
                  </div>
                )}
                <Radio name="aud" value="link" label="Giao theo link" checked={form.audience === "link"} onChange={() => set({ audience: "link" })} disabled={!AUDIENCE_LINK_READY || locked || off}
                  hint={AUDIENCE_LINK_READY ? "Ai có link đều vào được, không cần thuộc lớp." : "Chưa dùng được: phòng thi của học sinh chưa tách đề giao theo link khỏi danh sách chung, nên đề sẽ lọt vào danh sách công khai. Sẽ mở sau khi phòng thi cập nhật."} />
              </div>
            </Group>

            <Group id="thoi-gian" title="Thời gian" hint={test ? "Bài kiểm tra bắt buộc có ngày, giờ và thời lượng" : "Luyện tập không bắt buộc"}>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <label htmlFor="gd-ngay" className={`${KIN_LABEL} mb-2`}>Ngày mở{test ? " (bắt buộc)" : ""}</label>
                  <input id="gd-ngay" type="date" className={KIN_FIELD} value={form.dateKey} onChange={e => set({ dateKey: e.target.value })} disabled={off} />
                </div>
                <div className="min-w-0">
                  <label htmlFor="gd-gio" className={`${KIN_LABEL} mb-2`}>Giờ mở{test ? " (bắt buộc)" : ""}</label>
                  <input id="gd-gio" type="time" className={KIN_FIELD} value={form.time} onChange={e => set({ time: e.target.value })} disabled={off} />
                </div>
                <div className="min-w-0">
                  <label htmlFor="gd-tl" className={`${KIN_LABEL} mb-2`}>Thời lượng (phút){test ? " (bắt buộc)" : ""}</label>
                  <input id="gd-tl" type="number" inputMode="numeric" min={1} max={300} className={KIN_FIELD} value={form.duration} onChange={e => set({ duration: e.target.value })} disabled={locked || off} placeholder="Ví dụ: 45" />
                </div>
              </div>
              <KinCallout title="Về khung giờ">Hiện KiN ghi khung giờ để hiển thị cho học sinh. Phòng thi chưa chặn học sinh vào ngoài giờ cho tới khi phòng thi cập nhật.</KinCallout>
            </Group>

            <Group id="truy-cap" title="Truy cập" hint="Mật khẩu và số lần làm">
              <div className="max-w-[420px]">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <label htmlFor="gd-mk" className={KIN_LABEL}>Mật khẩu vào làm bài</label>
                  {cfg.hasPassword ? <KinStatus tone="xong">Đã đặt</KinStatus> : <KinStatus tone="mo">Chưa đặt</KinStatus>}
                </div>
                <input id="gd-mk" type="password" autoComplete="new-password" className={KIN_FIELD} value={form.password} onChange={e => set({ password: e.target.value })} disabled={off}
                  placeholder={cfg.hasPassword ? "Nhập để đổi mật khẩu" : "Để trống nếu không cần"} />
                <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">KiN không hiện lại mật khẩu sau khi lưu. Cô ghi lại hoặc gửi cho học sinh.</p>
                {cfg.hasPassword && <KinButton type="button" variant="secondary" className="mt-2" onClick={() => void clearPassword()} loading={busy === "xoa-mk"} loadingLabel="Đang xoá…" disabled={off}>Xoá mật khẩu</KinButton>}
              </div>
              <div className="max-w-[420px]">
                <p className={`${KIN_LABEL} mb-1`}>Số lần làm</p>
                <label className="flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)]">
                  <input type="checkbox" className="w-5 h-5" checked={form.unlimited} onChange={e => set({ unlimited: e.target.checked })} disabled={off} />Không giới hạn số lần
                </label>
                {!form.unlimited && (
                  <div className="mt-1">
                    <label htmlFor="gd-lan" className={`${KIN_LABEL} mb-2`}>Mỗi học sinh làm tối đa (lần)</label>
                    <input id="gd-lan" type="number" inputMode="numeric" min={1} max={20} className={KIN_FIELD} value={form.attempts} onChange={e => set({ attempts: e.target.value })} disabled={off} />
                  </div>
                )}
              </div>
              <KinCallout title="Giám sát thoát màn hình">KiN chỉ ghi nhận số lần học sinh rời màn hình làm bài và hiện ở bảng điểm. Không phạt, không tự nộp bài, không dùng camera.</KinCallout>
            </Group>

            <Group id="hien-thi" title="Hiển thị" hint="Khi nào học sinh thấy điểm và đáp án">
              <div role="radiogroup" aria-label="Khi nào học sinh xem điểm và đáp án">
                {VIEW_LEVELS.map(v => <Radio key={v.value} name="level" value={v.value} label={v.label} hint={v.hint} checked={form.level === v.value} onChange={() => set({ level: v.value })} disabled={off} />)}
              </div>
              <label className="flex items-start gap-2 min-h-11 text-[length:var(--kin-co-goc)]">
                <input type="checkbox" className="w-5 h-5 mt-0.5" checked={form.hideWrong} onChange={e => set({ hideWrong: e.target.checked })} disabled={off || form.level === "never"} />
                <span>Không hiện đáp án đúng ở câu học sinh làm sai<span className="block text-[var(--kin-chu-mo)]">Em vẫn thấy mình đúng hay sai, nhưng không thấy đáp án để đưa cho bạn.</span></span>
              </label>
              <label className="flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)]">
                <input type="checkbox" className="w-5 h-5" checked={form.board} onChange={e => set({ board: e.target.checked })} disabled={off} />Hiện bảng xếp hạng cho học sinh
              </label>
            </Group>
          </fieldset>
          {formErr && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)] break-words">{formErr}</p>}
        </form>

        <aside aria-label="Tóm tắt" className="min-w-0 lg:sticky lg:top-4 space-y-4">
          <KinPanel variant="nhan">
            <p className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Tóm tắt</p>
            <dl className="mt-3 space-y-2 text-[length:var(--kin-co-goc)]">
              {summary.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-[var(--kin-chu-mo)] flex-shrink-0">{k}</dt><dd className="text-right text-[var(--kin-chu-chinh)] break-words min-w-0">{v}</dd></div>)}
            </dl>
          </KinPanel>
          {draft && blockers.length > 0 && (
            <KinCallout title="Chưa phát hành được vì">
              <ul className="list-disc pl-5 space-y-1" data-giao-chan>{blockers.map((b, i) => <li key={i} className="break-words">{b}</li>)}</ul>
            </KinCallout>
          )}
          {!draft && !superseded && (
            <KinPanel>
              <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{exam.active ? "Đóng đề để học sinh không vào làm được nữa. Bài đã nộp vẫn giữ." : "Đề đang đóng. Mở lại để học sinh vào làm tiếp."}</p>
              <KinButton variant="secondary" className="mt-3" onClick={() => void closeOrReopen(exam.active ? "close" : "reopen")} loading={busy === "dong-mo"} loadingLabel="Đang thực hiện…" disabled={off}>{exam.active ? "Đóng đề" : "Mở lại đề"}</KinButton>
            </KinPanel>
          )}
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 md:mx-0 px-4 md:px-0 py-3 mt-6 border-t border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] flex flex-wrap gap-3" data-giao-thanh-hanh-dong>
        <KinButton onClick={() => void save()} variant={draft ? "secondary" : "primary"} loading={busy === "luu"} loadingLabel="Đang lưu…" disabled={off || !dirty}>Lưu cấu hình</KinButton>
        {draft && <KinButton onClick={() => void publish()} loading={busy === "phat-hanh"} loadingLabel="Đang phát hành…" disabled={off || blockers.length > 0}>Phát hành</KinButton>}
        {!dirty && !draft && <Link href={deThiKetQuaHref(id)} className={kinButtonClass("secondary")}>Xem kết quả</Link>}
      </div>
    </KinPage>
  );
}
