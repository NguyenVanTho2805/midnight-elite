// BU-03 P1 · S2 — Nhập câu hỏi từ Word theo mẫu Azota vào NGÂN HÀNG (/lop-cua-toi/de-thi/ngan-hang-cau-hoi/nhap-word). KHÔNG DÙNG AI, không tốn lượt AI.
// Ba bước: 1 chọn tệp → 2 xem lại (loại câu, đáp án + nguồn đáp án, cờ, mức, nút đích) → 3 lưu. Xem trước KHÔNG ghi DB; chỉ bước lưu mới ghi (luu-nhieu, câu luôn là NHÁP của cô).
// Cờ đỏ chặn lưu: câu còn nhãn ⟦công thức⟧ chưa sửa; câu thiếu / mâu thuẫn đáp án cho tới khi cô chọn đáp án (KiN không tự đoán). Muốn bỏ qua câu thì bỏ tích “Lưu câu này”.
// Mức NB/TH/VD/VDC: đặt cho tất cả hoặc từng câu; luu-nhieu nhận `difficulty` trên TỪNG câu nên lưu đúng MỘT lần gọi (câu chưa có mức vẫn gửi, máy chủ tính vào skippedInvalid).
// Hai đích: ngân hàng câu hỏi (mặc định) hoặc ĐỀ NHÁP MỚI (?dich=de, dùng import-save có sẵn — lối "Từ Word" của màn Tạo đề).
"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { MathText } from "@/components/MathText";
import { QUIZ_TYPE_LABEL, validateQuizQuestion } from "@/lib/quizQuestion";
import {
  ANSWER_SOURCE_LABEL, deThiDetailHref, fetchCategories, flattenCategories, formulaProblem, hasFormulaPlaceholder, importSave, LEVEL_LABEL, LEVELS, luuNhieu, nganHangHref, nganHangNodeHref, nhapWordHref,
  taoDeHref, tierLabel, toBankInput, toExamInputs, uploadWord, wordFileProblem, WORD_MAX_QUESTIONS, type AzotaFlag, type AzotaQuestion, type Level, type LuuNhieuRes, type NhapWordRes,
} from "./deThiClient";

interface Item {
  q: AzotaQuestion;
  include: boolean;
  difficulty: Level | null;
  text: string;
  options: { text: string; isCorrect: boolean; subLabel?: string }[];
  answerTouched: boolean; // cô đã tự chọn đáp án (mở khoá câu thiếu / mâu thuẫn đáp án)
  editing: boolean;
}
type Step = "chon-tep" | "xem-lai" | "xong";

const FLAG_TEXT: Record<AzotaFlag, { tone: "loi" | "cho"; text: string }> = {
  answer_missing: { tone: "loi", text: "Chưa tìm thấy đáp án" },
  answer_conflict: { tone: "loi", text: "Các nguồn đáp án mâu thuẫn, KiN không tự chọn" },
  formula_unread: { tone: "loi", text: "Còn công thức chưa đọc được" },
  image_unreadable: { tone: "cho", text: "Có hình không hiển thị được" },
  formula_image: { tone: "cho", text: "Công thức này hiện bằng ảnh" },
};

/** Lý do một câu (đang được tích lưu) chưa lưu được; null = ổn. */
function blockReason(it: Item, toExam: boolean): string | null {
  if (hasFormulaPlaceholder(it.text) || it.options.some(o => hasFormulaPlaceholder(o.text))) return "Còn nhãn ⟦công thức⟧: bấm “Sửa câu” và gõ lại công thức (dạng $...$).";
  const fp = formulaProblem(it.text) ?? it.options.map(o => formulaProblem(o.text)).find(Boolean) ?? null;
  if (fp) return fp;
  if (it.q.type !== "ESSAY" && (it.q.flags.includes("answer_missing") || it.q.flags.includes("answer_conflict")) && !it.answerTouched) return "Chưa có đáp án chắc chắn: bấm “Sửa câu” và chọn đáp án đúng.";
  if (!toExam && !it.difficulty) return "Chọn mức NB / TH / VD / VDC cho câu này (ngân hàng cần mức để bốc đề, KiN không tự đoán).";
  return validateQuizQuestion(toBankInput({ type: it.q.type, text: it.text, imageUrl: it.q.imageUrl, explanation: it.q.explanation, options: it.options }));
}

export default function NhapWord() {
  const params = useSearchParams();
  const router = useRouter();
  const toExam = params.get("dich") === "de"; // lưu thành đề nháp mới thay vì vào ngân hàng
  const [examTitle, setExamTitle] = useState("");
  const [step, setStep] = useState<Step>("chon-tep");
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [res, setRes] = useState<NhapWordRes | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [nodes, setNodes] = useState<{ id: string; label: string }[] | null>(null);
  const [nodesErr, setNodesErr] = useState<string | null>(null);
  const [target, setTarget] = useState(params.get("nut") ?? "");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [done, setDone] = useState<LuuNhieuRes | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const runRef = useRef(0);

  const [nodesTry, setNodesTry] = useState(0);
  useEffect(() => {
    let alive = true;
    void fetchCategories().then(r => {
      if (!alive) return;
      if (!r.ok || !r.data) { setNodesErr(r.error ?? "Chưa tải được cây ngân hàng."); return; }
      setNodes(flattenCategories(r.data).map(c => ({ id: c.id, label: `${"\u00A0\u00A0".repeat(c.depth)}${c.name} · ${tierLabel(c.depth)}` })));
    });
    return () => { alive = false; };
  }, [nodesTry]);
  function retryNodes() { setNodesErr(null); setNodes(null); setNodesTry(n => n + 1); }

  function pick(f: File | null) {
    if (!f) return;
    const p = wordFileProblem(f);
    if (p) { setFileErr(p); return; }
    setFileErr(null); setReadErr(null); setFile(f);
  }

  async function read() {
    if (!file) return;
    const run = ++runRef.current;
    setBusy(true); setReadErr(null);
    const r = await uploadWord(file);
    if (run !== runRef.current) return;
    setBusy(false);
    if (!r.ok || !r.data) { setReadErr(r.error ?? "Chưa đọc được tệp."); return; }
    if (r.data.fatal) { setReadErr(r.data.fatal); return; }
    setRes(r.data);
    setItems(r.data.questions.map(q => ({ q, include: true, difficulty: q.difficulty, text: q.text, options: q.options.map(o => ({ ...o })), answerTouched: false, editing: false })));
    setSaveErr(null); setStep("xem-lai");
  }

  const patch = (key: string, p: Partial<Item>) => setItems(a => a.map(it => it.q.key === key ? { ...it, ...p } : it));
  function chooseAnswer(it: Item, idx: number) {
    const t = it.q.type;
    const options = it.options.map((o, i) => t === "MC" ? { ...o, isCorrect: i === idx } : t === "MC_MULTI" ? (i === idx ? { ...o, isCorrect: !o.isCorrect } : o) : o);
    patch(it.q.key, { options, answerTouched: true });
  }
  function setTf(it: Item, idx: number, v: boolean) {
    patch(it.q.key, { options: it.options.map((o, i) => i === idx ? { ...o, isCorrect: v } : o), answerTouched: true });
  }

  const reasons = useMemo(() => new Map(items.map(it => [it.q.key, it.include ? blockReason(it, toExam) : null])), [items, toExam]);
  const chosen = items.filter(i => i.include);
  const blocked = chosen.filter(i => reasons.get(i.q.key));
  const noLevel = chosen.filter(i => !i.difficulty).length;
  const canSave = (toExam ? !!examTitle.trim() : !!target) && chosen.length > 0 && blocked.length === 0 && !saving;
  const whyNot = toExam && !examTitle.trim() ? "Đặt tên cho đề." : !toExam && !target ? "Chọn nút đích trong ngân hàng." : chosen.length === 0 ? "Chưa tích câu nào để lưu." : blocked.length > 0 ? `Còn ${blocked.length} câu cần xử lý hoặc bỏ tích.` : null;

  async function save() {
    setSaving(true); setSaveErr(null);
    if (toExam) {
      const r = await importSave({ title: examTitle.trim(), fileName: file?.name, questions: toExamInputs(chosen.map(it => ({ type: it.q.type, text: it.text, imageUrl: it.q.imageUrl, explanation: it.q.explanation, options: it.options }))) });
      if (!r.ok || !r.data) { setSaving(false); setSaveErr(r.error ?? "Chưa lưu được đề."); return; }
      router.push(deThiDetailHref(r.data.id));
      return;
    }
    // Một lần gọi: mức nằm trên từng câu (luu-nhieu nhận difficulty/categoryId trên từng item).
    const r = await luuNhieu({
      categoryId: target,
      items: chosen.map(it => ({ ...toBankInput({ type: it.q.type, text: it.text, imageUrl: it.q.imageUrl, explanation: it.q.explanation, options: it.options }), ...(it.difficulty ? { difficulty: it.difficulty } : {}) })),
    });
    setSaving(false);
    if (!r.ok || !r.data) { setSaveErr(r.error ?? "Chưa lưu được. Cô bấm Lưu lại; câu trùng sẽ tự được bỏ qua."); return; }
    setDone(r.data); setStep("xong");
  }

  const stepSub = step === "chon-tep" ? "Bước 1/3 · Chọn tệp Word" : step === "xem-lai" ? "Bước 2/3 · Xem lại câu đã đọc" : "Bước 3/3 · Đã lưu";

  return (
    <KinPage>
      <KinPageHeader title={toExam ? "Tạo đề từ Word" : "Nhập câu hỏi từ Word"} back={toExam ? { href: taoDeHref(), label: "Tạo đề" } : { href: nganHangHref(), label: "Ngân hàng câu hỏi" }} sub={stepSub} />

      {step === "chon-tep" && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-x-8 gap-y-8 items-start">
          <div className="min-w-0 space-y-6">
            <KinCallout title="Không tốn lượt AI" tone="nhan">
              KiN đọc tệp Word theo mẫu Azota ngay trên máy chủ của KiN, không gửi nội dung cho dịch vụ AI nào. Cô vẫn xem lại từng câu trước khi lưu; chưa có gì được ghi vào ngân hàng ở bước này.
            </KinCallout>
            <section aria-labelledby="nw-src">
              <KinSectionHead id="nw-src" title="Chọn tệp Word" />
              <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0] ?? null); }}
                className={`mt-4 rounded-[var(--kin-bo-md)] border border-dashed p-6 ${dragOver ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-o-nhap)]"}`}>
                <p className="text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]">Kéo thả tệp .docx vào đây hoặc chọn tệp</p>
                <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Word .docx theo mẫu Azota · tối đa 4 MB · tối đa {WORD_MAX_QUESTIONS} câu một lần</p>
                <label className={`${kinButtonClass("secondary")} mt-4 cursor-pointer`}>
                  Chọn tệp Word
                  <input type="file" accept=".docx" className="sr-only" aria-label="Chọn tệp Word" onChange={e => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                </label>
              </div>
              {fileErr && <p role="alert" className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{fileErr}</p>}
              {file && <p className="mt-3 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] break-words">Đã chọn: {file.name} <button type="button" className="underline min-h-11 px-2" onClick={() => { setFile(null); setReadErr(null); }}>Bỏ tệp</button></p>}
            </section>

            {readErr && (
              <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa đọc được tệp" actions={<KinButton onClick={() => void read()} disabled={!file}>Thử lại</KinButton>}>
                {readErr} Cô kiểm tra tệp đúng là Word .docx theo mẫu Azota,.
              </KinStateCard>
            )}
            <div className="flex flex-wrap gap-3">
              <Link href={toExam ? taoDeHref() : nganHangHref()} className={kinButtonClass("secondary")}>Huỷ nhập</Link>
              <KinButton onClick={() => void read()} disabled={!file || busy} loading={busy} loadingLabel="Đang đọc tệp…">Đọc tệp và xem lại</KinButton>
            </div>
          </div>
          <aside aria-label="Mẫu Azota" className="min-w-0 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-6">
            <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">KiN đọc được gì</h2>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">
              <li>Các phần PHẦN I, II, III…: trắc nghiệm, nhiều đáp án, đúng-sai, trả lời ngắn.</li>
              <li>Đáp án đúng: gạch chân ở nhãn, dấu *, bảng đáp án cuối đề, hoặc lời giải. Nguồn nào được dùng đều hiện rõ ở bước sau.</li>
              <li>Hình ảnh trong đề; bảng trong đề; lời giải.</li>
              <li>Công thức Word thường (OMML) và công thức MathType được KiN đọc tự động và chuyển thành $...$. Câu nào KiN chưa đọc được vẫn có nhãn ⟦công thức⟧ và bị chặn lưu, cô bấm “Sửa câu” để gõ lại.</li>
            </ul>
            <p className="mt-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Mức NB/TH/VD/VDC chỉ lấy từ nhãn [n, MỨC] của ý đúng-sai; còn lại cô đặt ở bước xem lại, KiN không đoán.</p>
          </aside>
        </div>
      )}

      {step === "xem-lai" && res && (
        <div className="space-y-6">
          <KinCallout title="Không tốn lượt AI" tone="nhan">{toExam ? "Chưa có gì được ghi. Cô đặt tên đề, xử lý các câu có cờ đỏ rồi bấm Tạo đề nháp. Đề là bản nháp, học sinh chưa thấy." : "Chưa có gì được ghi. Cô chọn nút đích, đặt mức, xử lý các câu có cờ đỏ rồi bấm Lưu vào ngân hàng. Câu lưu vào là bản nháp của riêng cô."}</KinCallout>

          <div className="flex flex-wrap gap-x-8 gap-y-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]" role="status">
            <span>{res.stats.total} câu đã đọc · {res.stats.withAnswer} có đáp án</span>
            {res.stats.withImage > 0 && <span>{res.stats.withImage} có hình</span>}
            {typeof res.stats.formulaDecoded === "number" && (res.stats.formulaDecoded + (res.stats.formulaFailed ?? 0)) > 0 && <span>KiN đọc được {res.stats.formulaDecoded}/{res.stats.formulaDecoded + (res.stats.formulaFailed ?? 0)} công thức MathType</span>}
            {(res.stats.withFormulaImage ?? 0) > 0 && <KinStatus tone="cho">{res.stats.withFormulaImage} câu có công thức hiện bằng ảnh</KinStatus>}
            {res.stats.withFormulaUnread > 0 && <KinStatus tone="loi">{res.stats.withFormulaUnread} câu còn công thức chưa đọc</KinStatus>}
            {res.errors.length > 0 && <KinStatus tone="cho">{res.errors.length} phần bị bỏ</KinStatus>}
          </div>

          {res.errors.length > 0 && (
            <KinCallout title={`${res.errors.length} phần trong tệp chưa đọc được`} tone="nhan">
              <ul className="list-disc pl-5">{res.errors.slice(0, 6).map((e, i) => <li key={i}>{e.message}</li>)}</ul>
              {res.errors.length > 6 && <p className="mt-1">Và {res.errors.length - 6} phần nữa. Cô sửa trong tệp rồi nhập lại, hoặc thêm câu bằng tay sau.</p>}
            </KinCallout>
          )}
          {res.warnings.length > 0 && (
            <KinCallout title={`${res.warnings.length} lưu ý`}>
              <ul className="list-disc pl-5">{res.warnings.slice(0, 6).map((w, i) => <li key={i}>{w.question ? `${w.question}: ` : ""}{w.message}</li>)}</ul>
              {res.warnings.length > 6 && <p className="mt-1">Và {res.warnings.length - 6} lưu ý nữa.</p>}
            </KinCallout>
          )}

          <section aria-labelledby="nw-dest" className="grid md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="min-w-0 md:col-span-2"><KinSectionHead id="nw-dest" title={toExam ? "Đặt tên đề" : "Lưu vào đâu"} /></div>
            {toExam ? (
              <div className="min-w-0">
                <label htmlFor="nw-title" className={`${KIN_LABEL} mb-2`}>Tên đề *</label>
                <input id="nw-title" className={KIN_FIELD} value={examTitle} maxLength={150} onChange={e => setExamTitle(e.target.value)} placeholder="Ví dụ: Kiểm tra giữa kỳ 1 · Toán 12" />
                <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đề là bản nháp, tổng 10 điểm chia đều. Cô chọn lớp và giao đề sau.</p>
              </div>
            ) : (
            <div className="min-w-0">
              <label htmlFor="nw-target" className={`${KIN_LABEL} mb-2`}>Nút đích trong ngân hàng *</label>
              {nodesErr ? (
                <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{nodesErr} <button type="button" className="underline min-h-11 px-2" onClick={retryNodes}>Thử lại</button></p>
              ) : !nodes ? (
                <p role="status" aria-busy="true" className="min-h-11 flex items-center text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải cây ngân hàng…</p>
              ) : nodes.length === 0 ? (
                <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Ngân hàng chưa có nút nào. Nút gốc “Môn” do quản trị tạo; cô <Link href="/lop-cua-toi/ho-tro" className="underline">nhắn hỗ trợ</Link> để mở môn.</p>
              ) : (
                <select id="nw-target" className={KIN_FIELD} value={target} onChange={e => setTarget(e.target.value)}>
                  <option value="">Chọn nút…</option>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              )}
              <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Nên chọn nút Yêu cầu cần đạt hoặc Chương; câu trùng nội dung trong cùng nút sẽ tự được bỏ qua.</p>
            </div>
            )}
            {!toExam && (
            <div className="min-w-0">
              <p className={`${KIN_LABEL} mb-2`} id="nw-all">Đặt mức cho tất cả câu đang tích</p>
              <div role="group" aria-labelledby="nw-all" className="flex flex-wrap gap-2">
                {LEVELS.map(l => <KinButton key={l} variant="secondary" onClick={() => setItems(a => a.map(it => it.include ? { ...it, difficulty: l } : it))} title={LEVEL_LABEL[l]}>{l}</KinButton>)}
                <KinButton variant="ghost" onClick={() => setItems(a => a.map(it => it.include ? { ...it, difficulty: null } : it))}>Xoá mức</KinButton>
              </div>
              <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{noLevel > 0 ? `${noLevel} câu đang tích chưa có mức. Ngân hàng cần mức để bốc đề nên cô đặt mức (hoặc bỏ tích) rồi mới lưu được.` : "Mọi câu đang tích đều có mức."}</p>
            </div>
            )}
          </section>

          <section aria-labelledby="nw-list">
            <KinSectionHead id="nw-list" title="Các câu đã đọc" aside={`${chosen.length}/${items.length} câu sẽ lưu`} />
            {items.length === 0 ? (
              <KinEmptyState title="Chưa đọc được câu nào" action={<KinButton onClick={() => { setStep("chon-tep"); setRes(null); }}>Chọn tệp khác</KinButton>}>
                Tệp có thể không theo mẫu Azota (không có “Câu 1.”, “A.”…). Cô thử tệp khác hoặc soạn tay từng câu.
              </KinEmptyState>
            ) : (
              <ul aria-label="Các câu đã đọc" className="mt-2 divide-y divide-[var(--kin-vien-nhat)]">
                {items.map(it => <Row key={it.q.key} it={it} reason={reasons.get(it.q.key) ?? null} patch={p => patch(it.q.key, p)} onAnswer={i => chooseAnswer(it, i)} onTf={(i, v) => setTf(it, i, v)} />)}
              </ul>
            )}
          </section>

          {saveErr && <div role="alert" className="border-l-2 border-[var(--kin-tt-chu-loi)] pl-4 py-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{saveErr}</div>}

          <div className="sticky bottom-0 z-10 -mx-4 md:mx-0 px-4 md:px-0 py-3 bg-[var(--kin-nen-trang)] border-t border-[var(--kin-vien-nhat)] flex flex-wrap items-center gap-3">
            <KinButton variant="secondary" onClick={() => { setStep("chon-tep"); setRes(null); setItems([]); }}>Chọn tệp khác</KinButton>
            <KinButton onClick={() => void save()} disabled={!canSave} loading={saving} loadingLabel="Đang lưu…">{toExam ? `Tạo đề nháp với ${chosen.length} câu` : `Lưu ${chosen.length} câu vào ngân hàng`}</KinButton>
            {whyNot && <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] min-w-0">{whyNot}</p>}
          </div>
        </div>
      )}

      {step === "xong" && done && (
        <div className="space-y-6">
          <KinStateCard kicker="Xong" title={done.saved > 0 ? `Đã lưu ${done.saved} câu vào ngân hàng` : "Không có câu nào được lưu mới"}
            status={<KinStatus tone={done.saved > 0 ? "xong" : "cho"}>{done.saved > 0 ? "Câu là bản nháp của riêng cô" : "Mọi câu đều đã có trong nút này hoặc không hợp lệ"}</KinStatus>}
            actions={<><Link href={nganHangNodeHref(target)} className={kinButtonClass("primary")}>Xem nút vừa nhập</Link><Link href={nhapWordHref(target)} className={kinButtonClass("secondary")}>Nhập tệp khác</Link><Link href={nganHangHref()} className={kinButtonClass("secondary")}>Về ngân hàng</Link></>}
            note="Không tốn lượt AI. Câu nháp chỉ cô thấy; gửi duyệt để dùng chung.">
            {done.skippedDuplicate > 0 && <p>{done.skippedDuplicate} câu trùng nội dung trong nút này đã được bỏ qua.</p>}
            {done.skippedInvalid > 0 && <p>{done.skippedInvalid} câu không hợp lệ đã được bỏ qua.</p>}
          </KinStateCard>
        </div>
      )}
    </KinPage>
  );
}

function Row({ it, reason, patch, onAnswer, onTf }: {
  it: Item; reason: string | null; patch: (p: Partial<Item>) => void; onAnswer: (idx: number) => void; onTf: (idx: number, v: boolean) => void;
}) {
  const q = it.q;
  const idBase = `nw-${q.key}`;
  const correct = it.options.filter(o => o.isCorrect);
  const answerText = q.type === "ESSAY" ? "Tự luận, chấm thủ công"
    : q.type === "SHORT_ANSWER" ? (correct[0]?.text || "—")
    : q.type === "TRUE_FALSE_CLUSTER" ? it.options.map(o => `${o.subLabel ?? "?"}) ${o.isCorrect ? "Đ" : "S"}`).join(" · ")
    : correct.length ? correct.map(o => String.fromCharCode(65 + it.options.indexOf(o))).join(", ") : "chưa có";
  return (
    <li className={`py-4 ${it.include ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <label className="inline-flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
          <input type="checkbox" className="w-5 h-5" checked={it.include} onChange={e => patch({ include: e.target.checked })} aria-label={`Lưu câu ${q.number} (${q.sectionLabel || `phần ${q.sectionIndex + 1}`})`} />
          Lưu câu này
        </label>
        <p className="min-w-0 flex-1 basis-48 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] pt-3">
          Câu {q.number} · {q.sectionLabel || `Phần ${q.sectionIndex + 1}`} · {QUIZ_TYPE_LABEL[q.type]}
        </p>
        <div className="flex items-center gap-2 min-h-11">
          <label htmlFor={`${idBase}-lv`} className="sr-only">Mức của câu {q.number}</label>
          <select id={`${idBase}-lv`} className={`${KIN_FIELD} !w-auto`} value={it.difficulty ?? ""} onChange={e => patch({ difficulty: (e.target.value || null) as Level | null })}>
            <option value="">Chưa đặt mức</option>
            {LEVELS.map(l => <option key={l} value={l}>{l} · {LEVEL_LABEL[l]}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-2 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] break-words"><MathText text={it.text || "(trống)"} /></div>
      {q.imageUrl && (/* eslint-disable-next-line @next/next/no-img-element */
        <img src={q.imageUrl} alt={`Hình của câu ${q.number}`} className="mt-2 max-h-48 max-w-full object-contain rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-nhat)]" />
      )}
      {(q.type === "MC" || q.type === "MC_MULTI") && (
        <ol className="mt-2 space-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
          {it.options.map((o, i) => <li key={i} className="break-words"><span className={o.isCorrect ? "font-medium text-[var(--kin-tt-chu-xong)]" : ""}>{String.fromCharCode(65 + i)}. </span><MathText text={o.text} />{o.isCorrect && <span className="text-[var(--kin-tt-chu-xong)]"> (đúng)</span>}</li>)}
        </ol>
      )}
      {q.type === "TRUE_FALSE_CLUSTER" && (
        <ol className="mt-2 space-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
          {it.options.map((o, i) => <li key={i} className="break-words">{o.subLabel ?? "?"}) <MathText text={o.text} /> <span className="font-medium">· {o.isCorrect ? "Đúng" : "Sai"}</span></li>)}
        </ol>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--kin-co-goc)]">
        <span className="text-[var(--kin-chu-phu)]">Đáp án: <b className="font-medium">{answerText}</b> · nguồn: {ANSWER_SOURCE_LABEL[q.answerSource]}</span>
        {q.flags.map(f => <KinStatus key={f} tone={FLAG_TEXT[f].tone}>{FLAG_TEXT[f].text}</KinStatus>)}
        {q.flags.includes("answer_conflict") && it.answerTouched && <KinStatus tone="xong">Cô đã chọn đáp án</KinStatus>}
      </div>
      {reason && it.include && <p role="alert" className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{reason}</p>}

      <div className="mt-2">
        <KinButton variant="secondary" aria-expanded={it.editing} aria-controls={`${idBase}-ed`} onClick={() => patch({ editing: !it.editing })}>{it.editing ? `Xong sửa câu ${q.number}` : `Sửa câu ${q.number}`}</KinButton>
      </div>
      {it.editing && (
        <div id={`${idBase}-ed`} className="mt-3 space-y-4 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-4">
          <div>
            <label htmlFor={`${idBase}-tx`} className={`${KIN_LABEL} mb-2`}>Nội dung câu {q.number}</label>
            <textarea id={`${idBase}-tx`} className={`${KIN_FIELD} py-2 min-h-24`} value={it.text} onChange={e => patch({ text: e.target.value })} />
            <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Công thức gõ trong $...$ (ví dụ $x^2 + 1$). Bên dưới là bản KiN vẽ ra để cô đối chiếu.</p>
            <FormulaPreview id={`${idBase}-tx-pv`} text={it.text} />
          </div>
          {q.type !== "ESSAY" && (
            <fieldset className="min-w-0">
              <legend className={`${KIN_LABEL} mb-2`}>{q.type === "SHORT_ANSWER" ? "Đáp án" : q.type === "TRUE_FALSE_CLUSTER" ? "Các ý và đáp án" : "Các phương án và đáp án đúng"}</legend>
              <div className="space-y-3">
                {it.options.map((o, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {(q.type === "MC" || q.type === "MC_MULTI") && (
                      <label className="inline-flex items-center gap-2 min-h-11">
                        <input type={q.type === "MC" ? "radio" : "checkbox"} name={`${idBase}-ans`} className="w-5 h-5" checked={o.isCorrect} onChange={() => onAnswer(i)} aria-label={`Phương án ${String.fromCharCode(65 + i)} là đáp án đúng`} />
                        <span className="text-[length:var(--kin-co-goc)]">{String.fromCharCode(65 + i)}</span>
                      </label>
                    )}
                    {q.type === "TRUE_FALSE_CLUSTER" && (
                      <span className="inline-flex items-center gap-3">
                        <span className="text-[length:var(--kin-co-goc)]">{o.subLabel ?? "?"})</span>
                        {([true, false] as const).map(v => (
                          <label key={String(v)} className="inline-flex items-center gap-1 min-h-11 text-[length:var(--kin-co-goc)]">
                            <input type="radio" name={`${idBase}-tf${i}`} className="w-5 h-5" checked={o.isCorrect === v} onChange={() => onTf(i, v)} aria-label={`Ý ${o.subLabel ?? i + 1} ${v ? "Đúng" : "Sai"}`} />{v ? "Đúng" : "Sai"}
                          </label>
                        ))}
                      </span>
                    )}
                    <label htmlFor={`${idBase}-o${i}`} className="sr-only">Nội dung {q.type === "SHORT_ANSWER" ? "đáp án" : `phương án ${i + 1}`}</label>
                    <input id={`${idBase}-o${i}`} className={`${KIN_FIELD} flex-1 basis-48 min-w-0`} value={o.text} aria-describedby={o.text.includes("$") ? `${idBase}-o${i}-pv` : undefined}
                      onChange={e => patch({ options: it.options.map((x, k) => k === i ? { ...x, text: e.target.value } : x), ...(q.type === "SHORT_ANSWER" ? { answerTouched: true } : {}) })} />
                    <div className="basis-full min-w-0"><FormulaPreview id={`${idBase}-o${i}-pv`} text={o.text} /></div>
                  </div>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </li>
  );
}

/** Xem trước trực tiếp công thức $...$ trong ô sửa; báo lỗi KaTeX bằng lời KiN. Không hiện gì nếu chưa có công thức. */
function FormulaPreview({ id, text }: { id: string; text: string }) {
  if (!text.includes("$")) return null;
  const problem = formulaProblem(text);
  return (
    <div id={id} className="mt-2 min-w-0">
      <div className="rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-bang)] p-3 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] break-words overflow-x-auto">
        <MathText text={text} />
      </div>
      {problem
        ? <p role="alert" className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{problem} Câu này chưa lưu được cho tới khi công thức vẽ ra đúng.</p>
        : <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Công thức vẽ được.</p>}
    </div>
  );
}
