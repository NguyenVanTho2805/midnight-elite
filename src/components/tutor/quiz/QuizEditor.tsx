// QZ-04 — tạo quiz: "Nội dung đề" (danh sách câu + trình soạn từng câu) và "Đáp án và phát hành" (bảng đáp án, cài đặt, phát hành).
// QZ-07 — quiz đã có người làm KHÔNG sửa đè: mọi ô sửa bị khoá, hiện hộp "Tạo phiên bản mới". Bản nháp phiên bản mới sửa tự do cho tới khi phát hành.
// Dữ liệu: /api/tutor/quiz/[id] (+ /questions, /publish, /new-version). Luật kiểm ở máy chủ; ở đây chỉ báo sớm bằng cùng bộ luật (src/lib/quizQuestion.ts).
// Chưa có dữ liệu thật cho Figma 464:4159 / 464:4369 (không có trong thư mục ảnh): bảng đáp án và cài đặt dựng từ các trường Exam đang có, không bịa thêm.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinTabs } from "@/components/kin/Tabs";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import { KinToast } from "@/components/kin/Toast";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { MathText } from "@/components/MathText";
import { describeValidity, fmtPoints, QUIZ_TYPE_LABEL, type QuizQuestionInput } from "@/lib/quizQuestion";
import QuestionForm from "./QuestionForm";
import SaveToBank from "./SaveToBank";
import { qfetch, quizHref, versionsHref, IMPORT_HREF, type QuizDetail, type QuizQ } from "./quizClient";

type Tab = "noi-dung" | "dap-an";
const STATUS_LABEL: Record<string, { tone: StatusTone; text: string }> = {
  draft: { tone: "cho", text: "Bản nháp · chưa phát hành" }, upcoming: { tone: "mo", text: "Đã lên lịch" },
  available: { tone: "xong", text: "Đang mở" }, completed: { tone: "mo", text: "Đã đóng" },
};
const VISIBILITY: { v: string; label: string }[] = [
  { v: "after_submit", label: "Ngay sau khi học sinh nộp bài" },
  { v: "after_exam_ends", label: "Sau khi hết thời hạn làm bài của quiz" },
  { v: "never", label: "Không hiện đáp án" },
];

const toInput = (q: QuizQ): QuizQuestionInput => ({
  type: q.type, text: q.text, points: q.points, imageUrl: q.imageUrl, explanation: q.explanation, hint: q.hint, studentGuide: q.studentGuide,
  graderGuide: q.graderGuide, rubric: q.rubric, sectionLabel: q.sectionLabel, options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })),
});

/** Đáp án đúng của một câu, dạng chữ ngắn cho bảng đáp án. */
export function answerText(q: QuizQ): string {
  if (q.type === "ESSAY") return q.rubric?.length ? `Chấm thủ công · ${q.rubric.length} tiêu chí` : "Chấm thủ công";
  if (q.type === "SHORT_ANSWER") return q.options[0]?.text || "—";
  if (q.type === "TRUE_FALSE_CLUSTER") return q.options.map(o => `${o.subLabel}) ${o.isCorrect ? "Đ" : "S"}`).join(" · ");
  const letters = q.options.map((o, i) => (o.isCorrect ? String.fromCharCode(65 + i) : "")).filter(Boolean);
  return letters.length ? letters.join(", ") : "Chưa chọn";
}

export default function QuizEditor({ id }: { id: string }) {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [data, setData] = useState<QuizDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("noi-dung");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [toast, setToast] = useState<{ tone: "xong" | "loi" | "tin"; title: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bankFor, setBankFor] = useState<string | null>(null); // câu đang mở hộp "Lưu vào ngân hàng"
  const [versionNote, setVersionNote] = useState("");
  const [form, setForm] = useState({ title: "", courseId: "", dateKey: "", time: "19:00", durationMin: "15", answerVisibility: "after_submit", hideAnswerForWrong: false, showLeaderboard: true, password: "", clearPassword: false });

  const syncForm = useCallback((d: QuizDetail) => setForm({
    title: d.exam.title, courseId: d.exam.courseId ?? "", dateKey: d.exam.dateKey ?? "", time: d.exam.time, durationMin: String(d.exam.durationMin),
    answerVisibility: d.exam.answerVisibility, hideAnswerForWrong: d.exam.hideAnswerForWrong, showLeaderboard: d.exam.showLeaderboard, password: "", clearPassword: false,
  }), []);

  const load = useCallback(async () => {
    const r = await qfetch<QuizDetail>("GET", `/api/tutor/quiz/${id}`);
    if (!r.ok || !r.data) {
      if (r.status === 404 || r.status === 403) setNotFound(true);
      setLoadErr(r.error ?? "Không tải được quiz.");
      return;
    }
    setLoadErr(null); setData(r.data); syncForm(r.data);
  }, [id, syncForm]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const exam = data?.exam ?? null;
  const questions = useMemo(() => data?.questions ?? [], [data]);
  const locked = !!exam && (!exam.canEditInPlace || !!exam.supersededById);
  const say = (tone: "xong" | "loi" | "tin", title: string, detail?: string) => setToast({ tone, title, detail });

  const problems = useMemo(() => {
    const p: string[] = [];
    if (!exam) return p;
    if (!form.title.trim()) p.push("Quiz chưa có tên.");
    if (!exam.courseId) p.push("Chọn lớp sẽ làm quiz này (ở mục Cài đặt bên dưới rồi bấm Lưu cài đặt).");
    if (questions.length === 0) p.push("Quiz chưa có câu nào.");
    questions.forEach((q, i) => { const v = describeValidity(toInput(q)); if (!v.ok) p.push(`Câu ${i + 1}: ${v.message}.`); });
    return p;
  }, [exam, form.title, questions]);

  async function saveQuestion(input: QuizQuestionInput): Promise<string | null> {
    const editingQ = editing && editing !== "new" ? editing : null;
    const r = await qfetch<{ questions: QuizQ[] }>(editingQ ? "PUT" : "POST", `/api/tutor/quiz/${id}/questions${editingQ ? `/${editingQ}` : ""}`, input);
    if (!r.ok || !r.data) { if (r.code === "HAS_ATTEMPTS") void load(); return r.error; }
    await load(); setEditing(null); say("xong", editingQ ? "Đã lưu câu hỏi" : "Đã thêm câu hỏi");
    return null;
  }

  async function removeQuestion(q: QuizQ, idx: number) {
    if (!(await ask({ title: `Bỏ câu ${idx + 1}?`, message: "Câu này sẽ bị xoá khỏi quiz. Quiz chưa có học sinh làm nên bỏ được.", confirmLabel: "Bỏ câu", tone: "nguy-hiem" }))) return;
    setBusy(`del-${q.id}`);
    const r = await qfetch("DELETE", `/api/tutor/quiz/${id}/questions/${q.id}`);
    setBusy(null);
    if (!r.ok) { say("loi", "Chưa bỏ được câu", r.error ?? undefined); if (r.code === "HAS_ATTEMPTS") void load(); return; }
    await load(); say("xong", "Đã bỏ câu");
  }

  async function move(idx: number, dir: -1 | 1) {
    const ids = questions.map(q => q.id), j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setBusy("reorder");
    const r = await qfetch("POST", `/api/tutor/quiz/${id}/questions/reorder`, { ids });
    setBusy(null);
    if (!r.ok) { say("loi", "Chưa đổi được thứ tự", r.error ?? undefined); return; }
    await load();
  }

  async function saveSettings() {
    if (!exam) return;
    setBusy("settings");
    const body: Record<string, unknown> = {
      title: form.title, courseId: form.courseId || null, dateKey: form.dateKey, time: form.time, durationMin: Number(form.durationMin),
      answerVisibility: form.answerVisibility, hideAnswerForWrong: form.hideAnswerForWrong, showLeaderboard: form.showLeaderboard,
    };
    if (form.clearPassword) body.password = "";
    else if (form.password.trim()) body.password = form.password;
    const r = await qfetch("PATCH", `/api/tutor/quiz/${id}`, body);
    setBusy(null);
    if (!r.ok) { say("loi", "Chưa lưu được cài đặt", r.error ?? undefined); if (r.code === "HAS_ATTEMPTS") void load(); return; }
    await load(); say("xong", "Đã lưu cài đặt");
  }

  async function publish() {
    if (!exam) return;
    const first = exam.versionNo === 1;
    if (!(await ask({
      title: first ? "Phát hành quiz này?" : `Phát hành phiên bản v${exam.versionNo}?`,
      message: first ? "Học sinh trong lớp sẽ thấy và làm được quiz. Sau khi có người làm, KiN không sửa đè mà lưu phiên bản mới."
        : `Học sinh làm mới sẽ nhận phiên bản v${exam.versionNo}. Bài đã làm và điểm của phiên bản cũ giữ nguyên.`,
      confirmLabel: "Phát hành", tone: "thuong",
    }))) return;
    setBusy("publish");
    const r = await qfetch("POST", `/api/tutor/quiz/${id}/publish`);
    setBusy(null);
    if (!r.ok) { say("loi", "Chưa phát hành được", r.error ?? undefined); return; }
    await load(); say("xong", first ? "Đã phát hành quiz" : `Đã phát hành v${exam.versionNo}`, first ? "Học sinh trong lớp đã thấy quiz." : "Phiên bản cũ giữ nguyên bài làm và điểm.");
  }

  async function makeVersion() {
    setBusy("version");
    const r = await qfetch<{ id: string; existed: boolean }>("POST", `/api/tutor/quiz/${id}/new-version`, { note: versionNote });
    setBusy(null);
    if (!r.ok || !r.data) { say("loi", "Chưa tạo được phiên bản mới", r.error ?? undefined); return; }
    router.push(quizHref(r.data.id));
  }

  async function discardDraft() {
    if (!exam) return;
    const isVersion = exam.versionNo > 1;
    if (!(await ask({ title: isVersion ? "Bỏ đề xuất này?" : "Xoá quiz nháp này?", message: isVersion ? "Bản nháp phiên bản mới sẽ bị xoá. Phiên bản đang dùng giữ nguyên." : "Quiz nháp và các câu trong đó sẽ bị xoá.", confirmLabel: isVersion ? "Bỏ đề xuất" : "Xoá nháp" }))) return;
    setBusy("discard");
    const r = await qfetch<{ rootId: string }>("DELETE", `/api/tutor/quiz/${id}`);
    setBusy(null);
    if (!r.ok || !r.data) { say("loi", "Chưa xoá được", r.error ?? undefined); return; }
    router.push(isVersion ? quizHref(r.data.rootId) : "/lop-cua-toi/bai-tap");
  }

  if (notFound) {
    return (
      <KinPage>
        <KinEmptyState title="Không tìm thấy quiz này" action={<Link href="/lop-cua-toi/bai-tap" className={kinButtonClass("primary")}>Về Bài tập</Link>}>
          Quiz có thể đã bị xoá, hoặc không nằm trong các quiz của cô.
        </KinEmptyState>
      </KinPage>
    );
  }
  if (!exam) {
    return (
      <KinPage>
        {loadErr ? <ErrorStrip message={loadErr} onRetry={() => void load()} /> : <div aria-busy="true" aria-label="Đang tải quiz" className="space-y-3"><div className="kin-skel kin-skel--soft h-9 w-64 rounded" /><div className="kin-skel kin-skel--soft h-[220px] rounded" /></div>}
      </KinPage>
    );
  }

  const st = STATUS_LABEL[exam.status];
  const editingQuestion = editing && editing !== "new" ? questions.find(q => q.id === editing) ?? null : null;
  const totalLabel = fmtPoints(questions.reduce((s, q) => s + q.points, 0));

  return (
    <KinPage>
      <KinPageHeader
        title={exam.title}
        back={{ href: "/lop-cua-toi/bai-tap", label: "Bài tập" }}
        sub={<>{st.text} · v{exam.versionNo} · {questions.length} câu · tổng {totalLabel} điểm</>}
        actions={<>
          <Link href={versionsHref(id)} className={kinButtonClass("secondary")}>Phiên bản</Link>
          {exam.isDraft && <KinButton variant="danger" onClick={() => void discardDraft()} loading={busy === "discard"} loadingLabel="Đang xoá…">{exam.versionNo > 1 ? "Bỏ đề xuất" : "Xoá nháp"}</KinButton>}
        </>}
      />

      {toast && <div className="mb-4"><KinToast tone={toast.tone} title={toast.title} detail={toast.detail} onClose={() => setToast(null)} /></div>}
      {loadErr && <ErrorStrip message={loadErr} onRetry={() => void load()} />}

      {exam.supersededById && (
        <KinCallout title="Đây là phiên bản cũ, chỉ để xem" className="mb-6">
          <p>Quiz đã có phiên bản mới nên bản này không sửa được; bài làm và điểm của học sinh ở bản này giữ nguyên.</p>
          <Link href={quizHref(exam.supersededById)} className={`${kinButtonClass("secondary")} mt-3`}>Mở phiên bản đang dùng</Link>
        </KinCallout>
      )}
      {!exam.supersededById && !exam.canEditInPlace && (
        <KinCallout title={`Đã có ${exam.attemptCount} lượt làm — KiN không sửa đè`} className="mb-6">
          <p>Muốn chỉnh câu hỏi, đáp án hay điểm, cô tạo phiên bản mới. Học sinh đã làm vẫn thuộc phiên bản này và điểm cũ không đổi.</p>
          <div className="mt-3 max-w-[560px]">
            <label htmlFor="qe-vnote" className={`${KIN_LABEL} mb-2`}>Lý do chỉnh (không bắt buộc, ghi vào nhật ký)</label>
            <input id="qe-vnote" className={KIN_FIELD} value={versionNote} maxLength={500} onChange={e => setVersionNote(e.target.value)} />
          </div>
          <KinButton className="mt-3" onClick={() => void makeVersion()} loading={busy === "version"} loadingLabel="Đang tạo…">Tạo phiên bản mới</KinButton>
        </KinCallout>
      )}
      {exam.isDraft && exam.versionNo > 1 && (
        <KinCallout title={`Bản đề xuất v${exam.versionNo}`} tone="nhan" className="mb-6">
          <p>Học sinh chưa thấy bản này. Chỉnh xong thì phát hành ở tab “Đáp án và phát hành”; bản cũ giữ nguyên.{exam.versionNote ? ` Lý do: ${exam.versionNote}` : ""}</p>
        </KinCallout>
      )}

      <KinTabs<Tab> label="Các phần của quiz" value={tab} onChange={t => { setTab(t); setEditing(null); }}
        tabs={[{ key: "noi-dung", label: `Nội dung đề · ${questions.length} câu` }, { key: "dap-an", label: "Đáp án và phát hành" }]} />

      {tab === "noi-dung" && (
        <section className="mt-6" aria-labelledby="qe-nd">
          {editing ? (
            <>
              <KinSectionHead id="qe-nd" title={editingQuestion ? `Sửa câu ${questions.indexOf(editingQuestion) + 1}` : "Thêm câu hỏi"} />
              <div className="mt-6"><QuestionForm key={editing} initial={editingQuestion} onSave={saveQuestion} onCancel={() => setEditing(null)} /></div>
            </>
          ) : (
            <>
              <KinSectionHead id="qe-nd" title="Các câu hỏi" aside={`${questions.length} câu · ${totalLabel} điểm`} />
              {questions.length === 0 ? (
                <KinEmptyState title="Quiz chưa có câu nào" action={!locked && (
                  <div className="flex flex-wrap gap-3 justify-center">
                    <KinButton onClick={() => setEditing("new")}>Thêm câu đầu tiên</KinButton>
                    <Link href={IMPORT_HREF} className={kinButtonClass("secondary")}>Nhập đề từ tệp</Link>
                  </div>
                )}>
                  Cô soạn từng câu ở đây, hoặc nhập cả đề từ tệp PDF, Word hay ảnh rồi rà soát từng câu trước khi lưu.
                </KinEmptyState>
              ) : (
                <ol aria-label="Danh sách câu hỏi">
                  {questions.map((q, i) => {
                    const v = describeValidity(toInput(q));
                    return (
                      <li key={q.id} className="py-4 border-b border-[var(--kin-vien-nhat)] grid sm:grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 items-start" data-quiz-q={q.id}>
                        <div className="min-w-0">
                          <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] break-words"><span className="font-medium">Câu {i + 1}.</span> <MathText text={q.text.length > 220 ? q.text.slice(0, 220) + "…" : q.text} /></p>
                          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{QUIZ_TYPE_LABEL[q.type]} · {fmtPoints(q.points)} điểm · Đáp án: {answerText(q)}</p>
                          <KinStatus tone={v.ok ? "xong" : "loi"} className="mt-1">{v.message}</KinStatus>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          {!locked && <>
                            <KinButton variant="secondary" aria-label={`Sửa câu ${i + 1}`} onClick={() => setEditing(q.id)}>Sửa</KinButton>
                            <KinButton variant="ghost" aria-label={`Đưa câu ${i + 1} lên`} disabled={i === 0 || busy === "reorder"} onClick={() => void move(i, -1)}>↑</KinButton>
                            <KinButton variant="ghost" aria-label={`Đưa câu ${i + 1} xuống`} disabled={i === questions.length - 1 || busy === "reorder"} onClick={() => void move(i, 1)}>↓</KinButton>
                            <KinButton variant="danger" aria-label={`Bỏ câu ${i + 1}`} loading={busy === `del-${q.id}`} loadingLabel="Đang bỏ…" onClick={() => void removeQuestion(q, i)}>Bỏ</KinButton>
                          </>}
                          {q.inBank ? <KinStatus tone="xong" className="self-center">Đã lưu vào ngân hàng</KinStatus>
                            : <KinButton variant="ghost" aria-label={`Lưu câu ${i + 1} vào ngân hàng câu hỏi`} aria-expanded={bankFor === q.id} onClick={() => setBankFor(bankFor === q.id ? null : q.id)}>Lưu vào ngân hàng</KinButton>}
                        </div>
                        {bankFor === q.id && !q.inBank && <SaveToBank examId={id} questionId={q.id} type={q.type} onCancel={() => setBankFor(null)} onDone={msg => { setBankFor(null); setToast({ tone: "xong", title: msg }); void load(); }} />}
                      </li>
                    );
                  })}
                </ol>
              )}
              {!locked && questions.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <KinButton onClick={() => setEditing("new")}>+ Thêm câu</KinButton>
                  <Link href={IMPORT_HREF} className={kinButtonClass("secondary")}>Nhập đề từ tệp</Link>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "dap-an" && (
        <section className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-x-8 gap-y-8 items-start" aria-labelledby="qe-da">
          <div className="min-w-0">
            <KinSectionHead id="qe-da" title="Bảng đáp án" aside={`${questions.length} câu · ${totalLabel} điểm`} />
            {questions.length === 0 ? <KinEmptyState title="Chưa có câu nào">Thêm câu ở tab “Nội dung đề” thì bảng đáp án hiện ở đây.</KinEmptyState> : (
              <table className="w-full mt-2 text-[length:var(--kin-co-goc)]">
                <caption className="sr-only">Đáp án đúng và điểm của từng câu</caption>
                <thead><tr className="text-left text-[var(--kin-chu-mo)] bg-[var(--kin-nen-bang)]"><th scope="col" className="px-3 py-3 font-normal">Câu</th><th scope="col" className="px-3 py-3 font-normal">Dạng</th><th scope="col" className="px-3 py-3 font-normal">Đáp án đúng</th><th scope="col" className="px-3 py-3 font-normal text-right">Điểm</th></tr></thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={q.id} className="border-b border-[var(--kin-vien-nhat)] align-top">
                      <th scope="row" className="px-3 py-3 font-normal">{i + 1}</th>
                      <td className="px-3 py-3 text-[var(--kin-chu-mo)]">{QUIZ_TYPE_LABEL[q.type]}</td>
                      <td className="px-3 py-3 break-words">{answerText(q)}</td>
                      <td className="px-3 py-3 text-right font-mono">{fmtPoints(q.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="min-w-0 space-y-6">
            <div>
              <KinSectionHead title="Cài đặt" />
              <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); void saveSettings(); }}>
                <fieldset disabled={locked} className="space-y-4 min-w-0 disabled:opacity-70">
                  <div><label htmlFor="qs-title" className={`${KIN_LABEL} mb-2`}>Tên quiz</label><input id="qs-title" className={KIN_FIELD} value={form.title} maxLength={150} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                  <div><label htmlFor="qs-course" className={`${KIN_LABEL} mb-2`}>Lớp</label>
                    <select id="qs-course" className={KIN_FIELD} value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })}>
                      <option value="">Chưa chọn lớp</option>
                      {data!.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {data!.courses.length === 0 && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Cô chưa có lớp. <Link className="underline" href="/lop-cua-toi/lop/tao">Tạo lớp</Link> trước rồi quay lại.</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label htmlFor="qs-date" className={`${KIN_LABEL} mb-2`}>Ngày mở</label><input id="qs-date" type="date" className={KIN_FIELD} value={form.dateKey} onChange={e => setForm({ ...form, dateKey: e.target.value })} /></div>
                    <div><label htmlFor="qs-time" className={`${KIN_LABEL} mb-2`}>Giờ mở</label><input id="qs-time" type="time" className={KIN_FIELD} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
                  </div>
                  <div className="max-w-[200px]"><label htmlFor="qs-dur" className={`${KIN_LABEL} mb-2`}>Thời lượng (phút)</label><input id="qs-dur" inputMode="numeric" className={KIN_FIELD} value={form.durationMin} onChange={e => setForm({ ...form, durationMin: e.target.value })} /></div>
                  <div><label htmlFor="qs-vis" className={`${KIN_LABEL} mb-2`}>Học sinh xem đáp án</label>
                    <select id="qs-vis" className={KIN_FIELD} value={form.answerVisibility} onChange={e => setForm({ ...form, answerVisibility: e.target.value })}>
                      {VISIBILITY.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-3 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={form.hideAnswerForWrong} onChange={e => setForm({ ...form, hideAnswerForWrong: e.target.checked })} />Câu làm sai chỉ hiện “Sai”, không lộ đáp án đúng</label>
                  <label className="flex items-center gap-3 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={form.showLeaderboard} onChange={e => setForm({ ...form, showLeaderboard: e.target.checked })} />Cho học sinh xem bảng xếp hạng</label>
                  <div>
                    <label htmlFor="qs-pw" className={`${KIN_LABEL} mb-2`}>Mật khẩu vào thi {exam.hasPassword ? "(đang đặt — để trống để giữ nguyên)" : "(không bắt buộc)"}</label>
                    <input id="qs-pw" type="password" autoComplete="new-password" className={KIN_FIELD} value={form.password} onChange={e => setForm({ ...form, password: e.target.value, clearPassword: false })} />
                    {exam.hasPassword && <label className="mt-2 flex items-center gap-3 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={form.clearPassword} onChange={e => setForm({ ...form, clearPassword: e.target.checked, password: "" })} />Bỏ mật khẩu</label>}
                    <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">KiN chỉ lưu bản băm của mật khẩu, không đọc lại được.</p>
                  </div>
                </fieldset>
                {!locked && <KinButton type="submit" variant="secondary" loading={busy === "settings"} loadingLabel="Đang lưu…">Lưu cài đặt</KinButton>}
              </form>
            </div>

            {exam.isDraft && (
              <div>
                <KinSectionHead title="Phát hành" />
                <div className="mt-4 space-y-3">
                  {problems.length === 0
                    ? <KinStatus tone="xong"><span role="status">Đủ điều kiện phát hành.</span></KinStatus>
                    : <ul aria-label="Việc còn lại trước khi phát hành" className="space-y-2">{problems.map((p, i) => <li key={i}><KinStatus tone="loi">{p}</KinStatus></li>)}</ul>}
                  <KinButton onClick={() => void publish()} disabled={problems.length > 0} loading={busy === "publish"} loadingLabel="Đang phát hành…">{exam.versionNo > 1 ? `Phát hành v${exam.versionNo}` : "Phát hành quiz"}</KinButton>
                  <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Phát hành xong học sinh trong lớp mới thấy quiz. Bản nháp thì học sinh không thấy.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      {dialog}
    </KinPage>
  );
}
