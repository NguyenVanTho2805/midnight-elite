// QZ-05 — nhập đề từ PDF / Word / ảnh của GIA SƯ (Figma 521:4165 chọn tệp và cấu trúc, 521:4405 rà soát câu hỏi và đáp án).
// AI chỉ TRÍCH câu hỏi có sẵn trong đề gốc (src/lib/aiExamImport.ts; hạn mức lượt AI đã có ở /api/exams/ai-extract-questions). Kết quả chỉ là GỢI Ý:
// gia sư rà từng câu (sửa / bỏ / xác nhận) rồi mới lưu thành BẢN NHÁP — không câu nào tới học sinh khi chưa phát hành.
// Nội dung tệp là dữ liệu, không phải lệnh (chỉ dẫn hệ thống ở máy chủ; ở đây chữ trong tệp chỉ được hiện qua MathText, đã escape).
// Quyết định của chủ: chỉ nhận đề gốc của gia sư; KHÔNG nhận bài làm / ảnh bài làm / tên học sinh — màn hình nói rõ điều này trước khi chọn tệp.
// Figma có nhưng CHƯA làm (không có dữ liệu thật): độ tin cậy từng ô nhận diện; "Gần giống ngân hàng"; lưu tệp nguồn để mở lại sau (tệp chỉ nằm trên máy cô trong lúc rà soát);
// tuỳ chọn "Giữ đề gốc + phiếu trả lời" (học sinh làm trên tệp — chưa có tính năng).
// "Tải mẫu Excel" CÓ làm: bảng mẫu (/api/tutor/quiz/mau-excel) + nhập lại ngay trên máy cô (quizSheetImport.ts), không AI, vẫn qua bước rà soát từng câu.
"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinTabs } from "@/components/kin/Tabs";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus } from "@/components/kin/Status";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { MathText } from "@/components/MathText";
import { AiQuotaNote } from "@/components/AiQuotaNote";
import { api } from "@/lib/api";
import { duplicateGroups, fmtPoints, QUIZ_TYPE_LABEL, validateQuizQuestion, type QuizQuestionInput } from "@/lib/quizQuestion";
import QuestionForm from "./QuestionForm";
import { answerText } from "./QuizEditor";
import { fileProblem, IMPORT_ACCEPT, qfetch, quizHref, sizeText, type QuizQ } from "./quizClient";
import { cellText, parseQuizSheet, SHEET_MAX_BYTES, type SheetRowError } from "@/lib/quizSheetImport";

type Step = "chon-tep" | "ra-soat";
interface Cand { key: string; q: QuizQuestionInput; confirmed: boolean }
interface Target { id: string; title: string; isDraft: boolean; questions: number }

let seq = 0;
const nextKey = () => `c${++seq}`;
const asQuizQ = (c: Cand, i: number): QuizQ => ({
  id: c.key, order: i, type: c.q.type, text: c.q.text, points: c.q.points, imageUrl: c.q.imageUrl ?? null, explanation: c.q.explanation ?? null, hint: c.q.hint ?? null,
  studentGuide: c.q.studentGuide ?? null, graderGuide: c.q.graderGuide ?? null, rubric: c.q.rubric ?? null, sectionLabel: c.q.sectionLabel ?? null,
  options: c.q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel ?? null })),
});

export default function QuizImport() {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [step, setStep] = useState<Step>("chon-tep");
  const [file, setFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractErr, setExtractErr] = useState<string | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [aiErrors, setAiErrors] = useState<{ block: number; message: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [compared, setCompared] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sheetName, setSheetName] = useState<string | null>(null); // tên bảng Excel/CSV đang rà soát (nhập không qua AI)
  const [sheetErrors, setSheetErrors] = useState<SheetRowError[]>([]);
  const [sheetBusy, setSheetBusy] = useState(false);
  const runRef = useRef(0);

  // Lớp và quiz nháp có sẵn để chọn nơi lưu — lỗi tải không chặn việc nhập (chỉ mất phần chọn).
  useEffect(() => {
    let alive = true;
    fetch("/api/tutor/bai-tap", { credentials: "same-origin", cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => { if (alive && d?.courses) setCourses(d.courses); }).catch(() => {});
    qfetch<{ items: Target[] }>("GET", "/api/tutor/quiz?editable=1").then(r => { if (alive && r.data) setTargets(r.data.items.filter(t => t.isDraft)); });
    return () => { alive = false; };
  }, []);

  // Xem trước tệp gốc ngay trên máy (không tải lên đâu): PDF và ảnh xem được; Word thì không.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function pick(f: File | null, kind: "exam" | "key") {
    if (!f) return;
    const p = fileProblem(f);
    if (p) { setFileErr(p); return; }
    setFileErr(null); setExtractErr(null);
    if (kind === "exam") { setFile(f); if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "")); } else setKeyFile(f);
  }

  async function extract() {
    if (!file) return;
    const run = ++runRef.current;
    setExtracting(true); setExtractErr(null);
    try {
      const r = await api.exams.aiExtractQuestions(file, keyFile ?? undefined);
      if (run !== runRef.current) return; // cô đã huỷ
      setCands(r.questions.map(q => ({
        key: nextKey(), confirmed: false,
        q: {
          type: q.type === "TRUE_FALSE_CLUSTER" || q.type === "ESSAY" ? q.type : "MC", text: q.text, points: q.points && q.points > 0 ? q.points : 1,
          imageUrl: q.imageUrl ?? null, explanation: null, hint: null, studentGuide: null, graderGuide: null, rubric: null, sectionLabel: null,
          options: q.type === "ESSAY" ? [] : q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel ?? null })),
        },
      })));
      setAiErrors(r.errors ?? []); setSheetName(null); setSheetErrors([]);
      setSelected(null); setEditing(null); setStep("ra-soat");
    } catch (e) {
      if (run !== runRef.current) return;
      setExtractErr(e instanceof Error ? e.message : "Chưa đọc được tệp. Thử lại sau ít phút.");
    } finally { if (run === runRef.current) setExtracting(false); }
  }
  function cancelExtract() { runRef.current++; setExtracting(false); }

  /** Đọc bảng Excel/CSV theo mẫu ngay trên máy: không gửi tệp đi đâu, không dùng AI. */
  async function pickSheet(f: File | null) {
    if (!f) return;
    setExtractErr(null); setSheetErrors([]);
    const lower = f.name.toLowerCase();
    if (!/\.(xlsx|csv)$/.test(lower)) { setFileErr(`Tệp "${f.name}" chưa đúng định dạng. Bảng mẫu là .xlsx (hoặc .csv).`); return; }
    if (f.size === 0) { setFileErr(`Tệp "${f.name}" trống.`); return; }
    if (f.size > SHEET_MAX_BYTES) { setFileErr(`Tệp "${f.name}" nặng hơn 1 MB. Cô tách thành các tệp nhỏ hơn.`); return; }
    setFileErr(null); setSheetBusy(true);
    try {
      let rows: unknown[][] = [];
      if (lower.endsWith(".csv")) {
        const Papa = (await import("papaparse")).default;
        rows = Papa.parse<string[]>(await f.text(), { skipEmptyLines: true }).data;
      } else {
        const mod = await import("exceljs");
        const { Workbook } = (mod as unknown as { default?: typeof mod }).default ?? mod;
        const wb = new Workbook();
        await wb.xlsx.load(await f.arrayBuffer());
        const ws = wb.worksheets[0];
        ws?.eachRow({ includeEmpty: true }, row => { const v = row.values as unknown[]; rows.push(v.slice(1).map(cellText)); });
      }
      const r = parseQuizSheet(rows);
      if (r.fatal) { setFileErr(r.fatal); return; }
      if (r.questions.length === 0) { setFileErr(r.errors.length ? `Chưa nhập được câu nào: ${r.errors.slice(0, 3).map(e => `hàng ${e.row}: ${e.message}`).join(" · ")}` : "Bảng chưa có câu hỏi nào. Cô nhập câu vào bảng mẫu rồi chọn lại."); return; }
      setCands(r.questions.map(q => ({ key: nextKey(), confirmed: false, q })));
      setSheetErrors(r.errors); setSheetName(f.name); setFile(null); setKeyFile(null); setAiErrors([]);
      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
      setSelected(null); setEditing(null); setStep("ra-soat");
    } catch {
      setFileErr(`Không đọc được "${f.name}". Cô kiểm tra tệp đúng là bảng mẫu của KiN (.xlsx hoặc .csv).`);
    } finally { setSheetBusy(false); }
  }

  const dups = useMemo(() => duplicateGroups(cands.map(c => c.q.text)), [cands]);
  const dupIdx = useMemo(() => new Set(dups.flat()), [dups]);
  const issues = useMemo(() => cands.map(c => validateQuizQuestion(c.q)), [cands]);
  const total = Math.round(cands.reduce((s, c) => s + c.q.points, 0) * 100) / 100;
  const confirmedCount = cands.filter(c => c.confirmed).length;
  const firstIssue = cands.findIndex((_, i) => issues[i]);
  const editingCand = editing && editing !== "new" ? cands.find(c => c.key === editing) ?? null : null;

  function openEdit(key: string) { setSelected(key); setEditing(key); setCompared(false); }
  async function onSaveCand(input: QuizQuestionInput): Promise<string | null> {
    if (!compared) return "Cô tích ô “Tôi đã đối chiếu câu này với tệp gốc” trước khi xác nhận.";
    if (editing === "new") { const k = nextKey(); setCands(cs => [...cs, { key: k, q: input, confirmed: true }]); setSelected(k); }
    else setCands(cs => cs.map(c => c.key === editing ? { ...c, q: input, confirmed: true } : c));
    setEditing(null); setCompared(false);
    return null;
  }
  async function dropCand(c: Cand, i: number) {
    if (!(await ask({ title: `Bỏ câu ${i + 1} khỏi bản nháp?`, message: "Câu này sẽ không được lưu. Cô nhập lại tệp nếu cần lấy lại.", confirmLabel: "Bỏ câu" }))) return;
    setCands(cs => cs.filter(x => x.key !== c.key));
    if (selected === c.key) setSelected(null);
    if (editing === c.key) setEditing(null);
  }
  function moveCand(i: number, d: -1 | 1) {
    setCands(cs => { const a = [...cs], j = i + d; if (j < 0 || j >= a.length) return cs; [a[i], a[j]] = [a[j], a[i]]; return a; });
  }

  async function save() {
    setSaving(true); setSaveErr(null);
    const r = await qfetch<{ id: string }>("POST", "/api/tutor/quiz/import-save", {
      title, courseId: courseId || null, targetExamId: targetId || null, fileName: file?.name ?? sheetName ?? "", questions: cands.map(c => c.q),
    });
    if (!r.ok || !r.data) { setSaving(false); setSaveErr(r.error); return; }
    router.push(quizHref(r.data.id));
  }

  const previewIsPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
  const previewIsImage = !!file && /^image\//.test(file.type);

  const sourcePreview = (height: string) => (
    <div className={`rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden ${height}`}>
      {sheetName ? <p className="p-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] break-words">Câu hỏi lấy từ bảng “{sheetName}” trên máy cô. Cô đối chiếu từng câu với bảng đó (mở bảng ở cửa sổ khác) rồi xác nhận.</p>
        : !file || !previewUrl ? <p className="p-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa có tệp.</p>
        : previewIsPdf ? <iframe title="Tệp gốc" src={previewUrl} className="w-full h-full" />
        // eslint-disable-next-line @next/next/no-img-element
        : previewIsImage ? <img src={previewUrl} alt="Ảnh đề gốc" className="w-full h-full object-contain" />
        : <p className="p-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tệp Word không xem trước được ở đây. Cô mở tệp trên máy để đối chiếu.</p>}
    </div>
  );

  return (
    <KinPage>
      <KinPageHeader title="Nhập đề từ tệp" back={{ href: "/lop-cua-toi/bai-tap", label: "Bài tập" }}
        sub={step === "chon-tep" ? "Bước 1/2 · Chọn tệp và cấu trúc" : "Bước 2/2 · Rà soát câu hỏi và đáp án · chưa phát hành"} />
      <KinTabs<Step> label="Các bước nhập đề" value={step} onChange={s => { if (s === "chon-tep" || cands.length > 0) setStep(s); }}
        tabs={[{ key: "chon-tep", label: "1. Chọn tệp và cấu trúc" }, { key: "ra-soat", label: "2. Rà soát câu hỏi và đáp án" }]} />

      {step === "chon-tep" && (
        <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-x-8 gap-y-8 items-start">
          <div className="min-w-0 space-y-6">
            <KinCallout title="Chỉ tải đề gốc của cô" tone="nhan">
              Tải đề và đáp án do cô soạn. Không tải bài làm, ảnh bài làm hay tên của học sinh. KiN gửi nội dung tệp tới dịch vụ AI để tách câu hỏi có sẵn; chữ trong tệp chỉ được đọc như dữ liệu của đề.
            </KinCallout>

            <section aria-labelledby="qi-src">
              <KinSectionHead id="qi-src" title="Chọn nguồn đề" />
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0] ?? null, "exam"); }}
                className={`mt-4 rounded-[var(--kin-bo-md)] border border-dashed p-6 ${dragOver ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-o-nhap)]"}`}>
                <p className="text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]">Kéo thả đề vào đây hoặc chọn tệp</p>
                <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">PDF, Word (.docx) hoặc ảnh · tối đa 4 MB mỗi tệp</p>
                <label className={`${kinButtonClass("secondary")} mt-4 cursor-pointer`}>
                  Chọn tệp
                  <input type="file" accept={IMPORT_ACCEPT} className="sr-only" aria-label="Chọn tệp đề" onChange={e => { pick(e.target.files?.[0] ?? null, "exam"); e.target.value = ""; }} />
                </label>
              </div>
              {fileErr && <p role="alert" className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{fileErr}</p>}
            </section>

            <section aria-labelledby="qi-sheet" className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-5">
              <h2 id="qi-sheet" className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Hoặc nhập từ bảng Excel</h2>
              <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Tải bảng mẫu, nhập câu trắc nghiệm vào đúng cột rồi chọn lại ở đây. Đọc ngay trên máy cô, không gửi tệp đi đâu và không tốn lượt AI; cô vẫn rà từng câu trước khi lưu.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="/api/tutor/quiz/mau-excel" download className={kinButtonClass("secondary")} data-tai-mau-excel>Tải bảng mẫu Excel</a>
                <label className={`${kinButtonClass("secondary")} cursor-pointer`}>
                  {sheetBusy ? "Đang đọc bảng…" : "Chọn bảng đã nhập (.xlsx, .csv)"}
                  <input type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Chọn bảng Excel đã nhập" disabled={sheetBusy} onChange={e => { void pickSheet(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                </label>
              </div>
            </section>

            {file && (
              <section aria-labelledby="qi-file" className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h2 id="qi-file" className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Tệp đã chọn</h2>
                    <p className="mt-2 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] break-words">{file.name}</p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{sizeText(file.size)} · còn nằm trên máy cô, chưa gửi đi</p></div>
                  <KinButton variant="ghost" onClick={() => { setFile(null); setExtractErr(null); }}>Bỏ tệp</KinButton>
                </div>
                <div className="mt-4">
                  <label className={`${kinButtonClass("secondary")} cursor-pointer`}>
                    {keyFile ? "Đổi tệp đáp án" : "Thêm tệp đáp án (không bắt buộc)"}
                    <input type="file" accept={IMPORT_ACCEPT} className="sr-only" aria-label="Chọn tệp đáp án" onChange={e => { pick(e.target.files?.[0] ?? null, "key"); e.target.value = ""; }} />
                  </label>
                  {keyFile && <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] break-words">Đáp án: {keyFile.name} · {sizeText(keyFile.size)} <button type="button" className="underline min-h-11 px-2" onClick={() => setKeyFile(null)}>Bỏ</button></p>}
                  <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Có tệp đáp án thì KiN đối chiếu với tệp đó; không có thì AI tự giải để gợi ý đáp án — kém tin cậy hơn, cô cần rà kỹ.</p>
                </div>
              </section>
            )}

            <section aria-labelledby="qi-dest" className="space-y-4">
              <KinSectionHead id="qi-dest" title="Lưu vào đâu" />
              <div><label htmlFor="qi-title" className={`${KIN_LABEL} mb-2`}>Tên quiz nháp</label><input id="qi-title" className={KIN_FIELD} value={title} maxLength={150} onChange={e => setTitle(e.target.value)} disabled={!!targetId} /></div>
              <div><label htmlFor="qi-course" className={`${KIN_LABEL} mb-2`}>Lớp (chọn sau cũng được)</label>
                <select id="qi-course" className={KIN_FIELD} value={courseId} onChange={e => setCourseId(e.target.value)} disabled={!!targetId}>
                  <option value="">Chưa chọn lớp</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              {targets.length > 0 && (
                <div><label htmlFor="qi-target" className={`${KIN_LABEL} mb-2`}>Hoặc thêm vào quiz nháp đã có</label>
                  <select id="qi-target" className={KIN_FIELD} value={targetId} onChange={e => setTargetId(e.target.value)}>
                    <option value="">Tạo quiz nháp mới</option>{targets.map(t => <option key={t.id} value={t.id}>{t.title} · {t.questions} câu</option>)}
                  </select></div>
              )}
            </section>

            <section aria-labelledby="qi-how">
              <KinSectionHead id="qi-how" title="Cách sử dụng đề" />
              <div className="mt-4 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-5">
                <p className="text-[length:var(--kin-co-body)] font-medium text-[var(--kin-chu-chinh)]">Tách thành câu hỏi có cấu trúc</p>
                <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Cần cô rà soát nội dung và đáp án. Công thức, số thứ tự và lựa chọn có thể bị nhận sai; KiN không tự phát hành.</p>
              </div>
            </section>

            {extractErr && <div role="alert" className="border-l-2 border-[var(--kin-tt-chu-loi)] pl-4 py-2"><p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-tt-chu-loi)]">Chưa đọc được tệp</p><p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{extractErr} Cô thử lại, hoặc <Link href="/lop-cua-toi/bai-tap/quiz/moi" className="underline">soạn tay từng câu</Link>.</p></div>}

            <div className="flex flex-wrap gap-3">
              <Link href="/lop-cua-toi/bai-tap" className={kinButtonClass("secondary")}>Huỷ nhập</Link>
              {extracting
                ? <KinButton variant="secondary" onClick={cancelExtract}>Dừng chờ</KinButton>
                : null}
              <KinButton onClick={() => void extract()} disabled={!file || extracting} loading={extracting} loadingLabel="Đang đọc đề… có thể mất tới vài phút">Tiếp tục rà soát</KinButton>
            </div>
            <div aria-live="polite"><AiQuotaNote busy={extracting} /></div>
          </div>

          <aside aria-label="Xem trước tệp gốc" className="min-w-0 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-6">
            <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Xem trước tệp gốc</h2>
            <p className="mt-1 mb-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{file ? "Xem ngay trên máy cô. KiN chưa lưu tệp này ở đâu cả." : "Chọn tệp để xem trước ở đây."}</p>
            {sourcePreview("h-[420px]")}
            <KinCallout title="Trước khi tiếp tục" className="mt-4">Bản tách chỉ là gợi ý. Chưa có đáp án chính thức hay điểm nào được công bố cho học sinh.</KinCallout>
          </aside>
        </div>
      )}

      {step === "ra-soat" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]" role="status">
            <span>{cands.length} câu phát hiện · {fmtPoints(total)} điểm (mặc định 1 điểm/câu, cô chỉnh từng câu)</span>
            <span>Trùng trong tệp: {dups.length}</span>
            <span>Đã xác nhận: {confirmedCount}/{cands.length}</span>
            {firstIssue >= 0 && <KinStatus tone="loi">Câu {String(firstIssue + 1).padStart(2, "0")}: {issues[firstIssue]}</KinStatus>}
          </div>

          {sheetErrors.length > 0 && (
            <KinCallout title={`${sheetErrors.length} hàng trong bảng chưa nhập được`} tone="nhan">
              <ul className="list-disc pl-5">{sheetErrors.slice(0, 8).map((e, i) => <li key={i}>Hàng {e.row}: {e.message}</li>)}</ul>
              {sheetErrors.length > 8 && <p className="mt-2">Và {sheetErrors.length - 8} hàng nữa. Cô sửa trong bảng rồi chọn lại, hoặc thêm câu bằng tay ở nút “Thêm câu thủ công”.</p>}
            </KinCallout>
          )}

          {aiErrors.length > 0 && (
            <KinCallout title={`${aiErrors.length} phần AI đọc chưa trọn vẹn`} tone="nhan">
              <ul className="list-disc pl-5">{aiErrors.slice(0, 6).map((e, i) => <li key={i}>{e.message}</li>)}</ul>
              <p className="mt-2">Cô thêm câu thay thế bằng tay ở nút “Thêm câu thủ công”, đối chiếu với tệp gốc.</p>
            </KinCallout>
          )}
          {dups.length > 0 && <KinCallout title="Có câu lặp lại trong tệp">{dups.map(g => `Câu ${g.map(i => i + 1).join(", ")}`).join(" · ")} có nội dung giống nhau. Cô đối chiếu trước khi lưu; KiN không tự gộp hay xoá câu nào.</KinCallout>}

          {cands.length === 0 && !editing ? (
            <KinEmptyState title={sheetName ? "Bảng chưa có câu nào" : "AI chưa tách được câu nào"} action={<div className="flex flex-wrap gap-3 justify-center"><KinButton onClick={() => { setEditing("new"); setCompared(false); }}>Thêm câu thủ công</KinButton><KinButton variant="secondary" onClick={() => setStep("chon-tep")}>Chọn tệp khác</KinButton></div>}>
              Tệp có thể là ảnh mờ hoặc không có câu hỏi dạng đề. Cô thử tệp khác, hoặc nhập tay.
            </KinEmptyState>
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-x-8 gap-y-8 items-start">
              <section aria-labelledby="qi-list" className="min-w-0">
                <KinSectionHead id="qi-list" title="Câu hỏi đã ánh xạ" aside={`${cands.length} câu`} />
                <ol aria-label="Các câu đã tách">
                  {cands.map((c, i) => (
                    <li key={c.key} className={`py-3 border-b border-[var(--kin-vien-nhat)] ${selected === c.key ? "bg-[var(--kin-nen-bang)]" : ""}`} data-import-q={c.key}>
                      <div className="px-2 grid sm:grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 items-start">
                        <div className="min-w-0">
                          <button type="button" className="block w-full text-left min-h-11 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] break-words" aria-pressed={selected === c.key} onClick={() => { setSelected(c.key); setEditing(null); }}>
                            <span className="font-medium">{String(i + 1).padStart(2, "0")}.</span> {c.q.text.length > 140 ? c.q.text.slice(0, 140) + "…" : c.q.text}
                          </button>
                          <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{QUIZ_TYPE_LABEL[c.q.type]} · {answerText(asQuizQ(c, i))} · {fmtPoints(c.q.points)} điểm{dupIdx.has(i) ? " · trùng trong tệp" : ""}</p>
                          <KinStatus tone={issues[i] ? "loi" : c.confirmed ? "xong" : "cho"} className="mt-1">{issues[i] ?? (c.confirmed ? "Đã xác nhận" : "Chưa xác nhận")}</KinStatus>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <KinButton variant="secondary" aria-label={`Sửa câu ${i + 1}`} onClick={() => openEdit(c.key)}>Sửa</KinButton>
                          <KinButton variant="ghost" aria-label={`Đưa câu ${i + 1} lên`} disabled={i === 0} onClick={() => moveCand(i, -1)}>↑</KinButton>
                          <KinButton variant="ghost" aria-label={`Đưa câu ${i + 1} xuống`} disabled={i === cands.length - 1} onClick={() => moveCand(i, 1)}>↓</KinButton>
                          <KinButton variant="danger" aria-label={`Bỏ câu ${i + 1}`} onClick={() => void dropCand(c, i)}>Bỏ</KinButton>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <KinButton variant="secondary" className="mt-4" onClick={() => { setEditing("new"); setSelected(null); setCompared(false); }}>+ Thêm câu thủ công</KinButton>
              </section>

              <section aria-labelledby="qi-detail" className="min-w-0 space-y-4">
                <KinSectionHead id="qi-detail" title={editing === "new" ? "Câu thủ công" : editingCand ? `Câu ${String(cands.indexOf(editingCand) + 1).padStart(2, "0")} · Đối chiếu tệp gốc` : "Đối chiếu tệp gốc"} />
                {sourcePreview("h-[260px]")}
                {editing ? (
                  <>
                    <label className="flex items-center gap-3 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={compared} onChange={e => setCompared(e.target.checked)} />Tôi đã đối chiếu câu này (công thức, lựa chọn, đáp án) với tệp gốc</label>
                    <QuestionForm key={editing} initial={editingCand ? asQuizQ(editingCand, cands.indexOf(editingCand)) : null} saveLabel="Xác nhận câu" onSave={onSaveCand} onCancel={() => { setEditing(null); setCompared(false); }} />
                  </>
                ) : selected ? (() => {
                  const i = cands.findIndex(c => c.key === selected); const c = cands[i];
                  return c ? (
                    <div className="rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-5">
                      <div className="text-[length:var(--kin-co-body)] leading-relaxed text-[var(--kin-chu-chinh)] break-words"><MathText text={c.q.text} /></div>
                      <ul className="mt-3 space-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{c.q.options.map((o, k) => <li key={k} className="break-words">{c.q.type === "TRUE_FALSE_CLUSTER" ? `${o.subLabel}) ` : `${String.fromCharCode(65 + k)}. `}<MathText text={o.text} />{o.isCorrect ? (c.q.type === "TRUE_FALSE_CLUSTER" ? " — Đúng" : " ✓") : c.q.type === "TRUE_FALSE_CLUSTER" ? " — Sai" : ""}</li>)}</ul>
                      <KinButton className="mt-4" onClick={() => openEdit(c.key)}>Sửa và xác nhận câu này</KinButton>
                    </div>
                  ) : null;
                })() : <KinCallout>Chọn một câu ở danh sách để đối chiếu với tệp gốc, sửa rồi xác nhận.</KinCallout>}
              </section>
            </div>
          )}

          <section aria-labelledby="qi-save" className="max-w-[640px] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-6 space-y-4">
            <h2 id="qi-save" className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Lưu bản nháp</h2>
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{confirmedCount}/{cands.length} câu đã kiểm tra. Bản nháp độc lập, không thay đề đang có và không tới học sinh khi chưa phát hành.</p>
            {cands.length - confirmedCount > 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{cands.length - confirmedCount} câu chưa xác nhận vẫn được lưu để cô làm tiếp sau. Câu còn lỗi thì chưa phát hành được.</p>}
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label htmlFor="qi-title2" className={`${KIN_LABEL} mb-2`}>Tên quiz nháp</label><input id="qi-title2" className={KIN_FIELD} value={title} maxLength={150} disabled={!!targetId} onChange={e => setTitle(e.target.value)} /></div>
              {targets.length > 0 && (
                <div><label htmlFor="qi-target2" className={`${KIN_LABEL} mb-2`}>Lưu vào</label>
                  <select id="qi-target2" className={KIN_FIELD} value={targetId} onChange={e => setTargetId(e.target.value)}>
                    <option value="">Quiz nháp mới</option>{targets.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select></div>
              )}
            </div>
            {saveErr && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{saveErr}</p>}
            <div className="flex flex-wrap gap-3">
              <KinButton onClick={() => void save()} disabled={cands.length === 0 || (!targetId && !title.trim()) || !!editing} loading={saving} loadingLabel="Đang lưu…">Lưu bản nháp</KinButton>
              <KinButton variant="secondary" onClick={() => setStep("chon-tep")}>Quay lại bước 1</KinButton>
            </div>
            {editing && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Xác nhận hoặc huỷ câu đang sửa trước khi lưu.</p>}
          </section>
        </div>
      )}
      {dialog}
    </KinPage>
  );
}
