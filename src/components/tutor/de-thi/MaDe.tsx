// BU-03 P2 · S6 — Mã đề của một đề gốc (/lop-cua-toi/de-thi/[id]/ma-de): tạo N mã (101, 102…), đảo thứ tự câu / phương án, ghim vị trí câu cố định.
// Mã đề con LUÔN suy ra từ đề gốc: có nhãn "Đã khoá", không có trang riêng, sửa câu bị máy chủ chặn (409 VARIANT_LOCKED) — muốn đổi thì sửa đề gốc rồi "Tạo lại mã đề".
// Phát hành cả nhóm nguyên tử (POST /api/tutor/quiz/[id]/publish). Bị chặn, KÈM LÝ DO, khi: còn nhãn ⟦công thức⟧ (422 FORMULA_UNREAD) hoặc cờ VARIANT_STUDENT_SUPPORT=false
// (422 VARIANTS_NOT_READY: phía học sinh chưa làm được đề nhiều mã, chờ BU-04). Dữ liệu: GET/POST …/ma-de + GET /api/tutor/quiz/[id] (có sẵn, để đọc tiêu đề, trạng thái và quét nhãn công thức).
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { KinToast } from "@/components/kin/Toast";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { qfetch, type QuizDetail } from "@/components/tutor/quiz/quizClient";
import {
  deThiDetailHref, deThiListHref, deThiSubHref, fetchMaDe, hasFormulaPlaceholder, MA_DE_MAX, MA_DE_MIN, PUBLISH_BLOCK_TEXT, taoMaDe, variantCodeOf, warningText,
  type MaDeRes,
} from "./deThiClient";

// Phương án kiểu "Cả A và B" dựa vào thứ tự nên đảo là sai đề: máy chủ (optionsShuffleUnsafe) không đảo câu đó; ở đây báo trước cho cô, mô tả cùng nhóm cụm từ.
const UNSAFE_OPTION = /(c[ảa]\s+[a-d]\s+(v[àa]|,)\s+[a-d])|(t[ấa]t\s+c[ảa]\s+(c[áa]c\s+)?([đd][áa]p\s+[áa]n|ph[ưu][ơo]ng\s+[áa]n)\s+tr[êe]n)|(kh[ôo]ng\s+([đd][áa]p\s+[áa]n|ph[ưu][ơo]ng\s+[áa]n)\s+n[àa]o)|(\b[a-d]\s+v[àa]\s+[a-d]\b)/i;

function parseFixed(text: string, max: number): { ok: true; positions: number[] } | { ok: false; error: string } {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const out = new Set<number>();
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > max) return { ok: false, error: `“${p}” không phải số thứ tự câu hợp lệ (đề có ${max} câu, đánh số từ 1).` };
    out.add(n);
  }
  return { ok: true, positions: [...out].sort((a, b) => a - b) };
}

export default function MaDe({ id }: { id: string }) {
  const failedFromBuilder = useSearchParams().get("loi") === "1";
  const { ask, dialog } = useKinConfirm();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [ma, setMa] = useState<MaDeRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [isVariant, setIsVariant] = useState(false);
  const [count, setCount] = useState(3);
  const [shufQ, setShufQ] = useState(true);
  const [shufO, setShufO] = useState(true);
  const [fixedText, setFixedText] = useState("");
  const [busy, setBusy] = useState<"tao" | "phat-hanh" | null>(null);
  const [toast, setToast] = useState<{ tone: "xong" | "loi"; title: string; detail?: string } | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState<{ code: string | null; text: string } | null>(null);

  const load = useCallback(async () => {
    const [q, m] = await Promise.all([qfetch<QuizDetail>("GET", `/api/tutor/quiz/${id}`), fetchMaDe(id)]);
    if (!q.ok || !q.data) { if (q.status === 404 || q.status === 403) setGone(true); setErr(q.error ?? "Chưa tải được đề."); return; }
    if (!m.ok || !m.data) {
      if (m.code === "IS_VARIANT") { setIsVariant(true); setErr(null); setQuiz(q.data); return; }
      if (m.status === 404 || m.status === 403) setGone(true);
      setErr(m.error ?? "Chưa tải được danh sách mã đề."); return;
    }
    setErr(null); setQuiz(q.data); setMa(m.data);
    const n = m.data.variants.length;
    if (n >= MA_DE_MIN) setCount(Math.min(MA_DE_MAX, n)); // n gồm cả đề gốc
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);
  const formulaQs = useMemo(() => questions.map((q, i) => ({ n: i + 1, bad: hasFormulaPlaceholder(q.text) || q.options.some(o => hasFormulaPlaceholder(o.text)) })).filter(x => x.bad).map(x => x.n), [questions]);
  const serverWarnings = useMemo(() => (ma?.warnings ?? []).map(warningText).filter(Boolean), [ma]);
  const unsafeQs = useMemo(() => questions.map((q, i) => ({ n: i + 1, bad: q.type === "MC" || q.type === "MC_MULTI" ? q.options.some(o => UNSAFE_OPTION.test(o.text)) : false })).filter(x => x.bad).map(x => x.n), [questions]);

  const exam = quiz?.exam ?? null;
  const variants = ma?.variants ?? [];
  const hasVariants = ma?.hasVariants ?? variants.length >= MA_DE_MIN;
  const draft = !!exam?.isDraft;
  const noSupport = hasVariants && ma?.studentSupport !== true; // cờ VARIANT_STUDENT_SUPPORT từ máy chủ; thiếu cờ coi như chưa hỗ trợ (chặn an toàn)
  const blockers: string[] = [];
  if (hasVariants && formulaQs.length > 0) blockers.push(`${PUBLISH_BLOCK_TEXT.FORMULA_UNREAD} (Câu ${formulaQs.slice(0, 8).join(", ")}${formulaQs.length > 8 ? "…" : ""}.)`);
  if (noSupport) blockers.push(PUBLISH_BLOCK_TEXT.VARIANTS_NOT_READY);
  if (hasVariants && questions.some(q => q.type === "ESSAY")) blockers.push(PUBLISH_BLOCK_TEXT.VARIANTS_ESSAY); // máy chủ chặn ở cổng phát hành (VARIANTS_ESSAY)

  async function create() {
    if (!shufQ && !shufO) { setFormErr("Cô bật ít nhất một kiểu đảo (câu hoặc phương án), nếu không các mã đề giống hệt nhau."); return; }
    const fx = parseFixed(fixedText, questions.length);
    if (!fx.ok) { setFormErr(fx.error); return; }
    if (hasVariants && !(await ask({ title: "Tạo lại mã đề?", message: `Các mã đề con hiện có sẽ bị xoá và tạo lại từ đề gốc với ${count} mã. Đề gốc giữ nguyên.`, confirmLabel: "Tạo lại", tone: "thuong" }))) return;
    setFormErr(null); setBusy("tao"); setToast(null);
    const r = await taoMaDe(id, { count, shuffleQuestions: shufQ, shuffleOptions: shufO, fixed: fx.positions });
    if (!r.ok) { setBusy(null); setFormErr(r.code === "IS_VARIANT" ? "Đây là mã đề con, không tạo thêm mã từ đây. Cô mở đề gốc." : r.error ?? "Chưa tạo được mã đề."); return; }
    await load(); setBusy(null);
    setToast({ tone: "xong", title: `Đã tạo ${count} mã đề`, detail: `Mã ${variantCodeOf(1)} đến ${variantCodeOf(count)}.` });
  }

  async function publish() {
    if (!exam) return;
    if (!(await ask({ title: `Phát hành đề cùng ${variants.length} mã?`, message: "Cả nhóm mã đề được phát hành cùng lúc. Sau khi phát hành, cô không đổi được số mã.", confirmLabel: "Phát hành", tone: "thuong" }))) return;
    setBusy("phat-hanh"); setPublishErr(null); setToast(null);
    const r = await qfetch<unknown>("POST", `/api/tutor/quiz/${id}/publish`);
    setBusy(null);
    if (!r.ok) { setPublishErr({ code: r.code, text: (r.code && PUBLISH_BLOCK_TEXT[r.code]) || r.error || "Chưa phát hành được." }); return; }
    await load();
    setToast({ tone: "xong", title: "Đã phát hành đề và các mã đề" });
  }

  if (gone) {
    return (
      <KinPage>
        <KinEmptyState title="Không tìm thấy đề này" action={<Link href={deThiListHref()} className={kinButtonClass("primary")}>Về Đề thi</Link>}>Đề có thể đã bị xoá, hoặc không phải của cô.</KinEmptyState>
      </KinPage>
    );
  }
  if (err) {
    return (
      <KinPage>
        <KinPageHeader title="Mã đề" back={{ href: deThiDetailHref(id), label: "Đề" }} />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được mã đề" actions={<KinButton onClick={() => { setErr(null); void load(); }}>Thử lại</KinButton>}>{err}</KinStateCard>
      </KinPage>
    );
  }
  if (!exam || (!ma && !isVariant)) return <KinPageSkeleton label="Đang tải mã đề" rows={4} side={false} />;
  if (isVariant) {
    return (
      <KinPage>
        <KinPageHeader title="Mã đề con" back={{ href: deThiListHref(), label: "Đề thi" }} />
        <KinEmptyState title="Đây là một mã đề con" action={<Link href={deThiListHref()} className={kinButtonClass("primary")}>Về danh sách đề</Link>}>Mã đề con không có trang riêng vì luôn suy ra từ đề gốc. Cô mở đề gốc để xem và tạo lại mã.</KinEmptyState>
      </KinPage>
    );
  }

  const published = !draft;
  return (
    <KinPage>
      {dialog}
      <KinPageHeader title={`Mã đề · ${exam.title}`} back={{ href: deThiDetailHref(id), label: "Về đề" }} sub={`${questions.length} câu · ${published ? "đã phát hành" : "bản nháp"}`} />
      {toast && <div className="mb-4"><KinToast tone={toast.tone} title={toast.title} detail={toast.detail} onClose={() => setToast(null)} /></div>}
      {failedFromBuilder && !hasVariants && (
        <KinCallout tone="nhan" className="mb-6" title="Đề đã được tạo, nhưng chưa tạo được mã đề">Cô chọn số mã bên dưới rồi bấm “Tạo mã đề” để thử lại.</KinCallout>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-10 gap-y-8 items-start">
        <section aria-labelledby="md-tao" className="min-w-0 space-y-4">
          <KinSectionHead id="md-tao" title={hasVariants ? "Tạo lại mã đề" : "Tạo mã đề"} />
          {published && !hasVariants ? (
            <KinCallout title="Đề đã phát hành nên không chia mã đề được">Mã đề chỉ tạo khi đề còn là bản nháp. Cô tạo phiên bản mới của đề rồi chia mã ở bản nháp đó.</KinCallout>
          ) : published ? (
            <KinCallout title="Đề đã phát hành, mã đề đã chốt">Cô không tạo lại mã đề sau khi phát hành.</KinCallout>
          ) : (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); void create(); }}>
              <div className="max-w-[320px]">
                <label htmlFor="md-n" className={`${KIN_LABEL} mb-2`}>Số mã đề</label>
                <select id="md-n" className={KIN_FIELD} value={count} onChange={e => setCount(Number(e.target.value))}>
                  {Array.from({ length: MA_DE_MAX - MA_DE_MIN + 1 }, (_, i) => MA_DE_MIN + i).map(n => <option key={n} value={n}>{n} mã đề ({variantCodeOf(1)}–{variantCodeOf(n)})</option>)}
                </select>
              </div>
              <fieldset className="min-w-0">
                <legend className={`${KIN_LABEL} mb-1`}>Cách đảo</legend>
                <label className="flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={shufQ} onChange={e => setShufQ(e.target.checked)} />Đảo thứ tự câu hỏi giữa các mã</label>
                <label className="flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={shufO} onChange={e => setShufO(e.target.checked)} />Đảo thứ tự phương án A, B, C, D</label>
              </fieldset>
              <div className="max-w-[420px]">
                <label htmlFor="md-fx" className={`${KIN_LABEL} mb-2`}>Câu giữ nguyên vị trí (không bắt buộc)</label>
                <input id="md-fx" className={KIN_FIELD} value={fixedText} onChange={e => setFixedText(e.target.value)} placeholder="Ví dụ: 1, 2, 40" inputMode="text" autoComplete="off" />
                <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Gõ số thứ tự câu trong đề gốc (từ 1). Các câu này giữ đúng vị trí ở mọi mã; chỉ đảo chỗ các câu còn lại.</p>
              </div>
              {unsafeQs.length > 0 && shufO && !hasVariants && (
                <KinCallout title="Một số câu không đảo được phương án">
                  Câu {unsafeQs.slice(0, 10).join(", ")}{unsafeQs.length > 10 ? "…" : ""} có phương án kiểu “Cả A và B”, “Tất cả đáp án trên”… nên KiN giữ nguyên thứ tự phương án của các câu này, tránh làm sai đề. Ý đúng-sai cũng không đảo.
                </KinCallout>
              )}
              {formErr && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{formErr}</p>}
              <KinButton type="submit" loading={busy === "tao"} loadingLabel="Đang tạo mã đề…" disabled={busy !== null || questions.length === 0}>{hasVariants ? "Tạo lại mã đề" : "Tạo mã đề"}</KinButton>
              {questions.length === 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đề chưa có câu nào. Cô <Link href={deThiDetailHref(id)} className="underline">thêm câu</Link> trước khi chia mã.</p>}
            </form>
          )}
        </section>

        <section aria-labelledby="md-ds" className="min-w-0 space-y-4">
          <KinSectionHead id="md-ds" title="Các mã đề" aside={hasVariants ? `${variants.length} mã` : undefined} />
          {!hasVariants ? (
            <KinEmptyState title="Đề này chưa chia mã">Một mã đề là một bản đảo thứ tự của cùng đề. Cô chia mã khi cần in đề hoặc cho học sinh ngồi gần nhau làm đề khác nhau.</KinEmptyState>
          ) : (
            <ul aria-label="Danh sách mã đề" className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] divide-y divide-[var(--kin-vien-nhat)]">
              {variants.slice().sort((a, b) => a.variantNo - b.variantNo).map(v => {
                const root = v.variantNo === 1;
                return (
                  <li key={v.id ?? v.variantNo} data-ma-de={v.code ?? variantCodeOf(v.variantNo)} className="px-4 py-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <p className="font-medium text-[var(--kin-chu-chinh)]">Mã đề {v.code ?? variantCodeOf(v.variantNo)}</p>
                      {v.questionCount != null && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{v.questionCount} câu</p>}
                      {root
                        ? <KinStatus tone="xong">Đề gốc · sửa được ở trình soạn đề</KinStatus>
                        : <KinStatus tone="mo">Đã khoá · suy ra từ đề gốc</KinStatus>}
                    </div>
                    {!root && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Muốn đổi câu hay đáp án, cô sửa đề gốc rồi bấm “Tạo lại mã đề”.</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {hasVariants && serverWarnings.length > 0 && (
            <KinCallout title="Lưu ý khi đảo">
              <ul className="list-disc pl-5">{serverWarnings.map((w, i) => <li key={i} className="break-words">{w}</li>)}</ul>
            </KinCallout>
          )}
        </section>
      </div>

      {hasVariants && draft && (
        <section aria-labelledby="md-ph" className="mt-10 space-y-4 max-w-[760px]">
          <KinSectionHead id="md-ph" title="Phát hành" />
          {blockers.length > 0 ? (
            <KinCallout title="Chưa phát hành được" >
              <ul className="list-disc pl-5">{blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </KinCallout>
          ) : (
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Phát hành đề gốc là phát hành cả nhóm {variants.length} mã đề cùng lúc. Lớp, giờ làm và cách hiển thị đáp án cô đặt ở bước Giao đề.</p>
          )}
          {publishErr && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{publishErr.text}</p>}
          <div className="flex flex-wrap gap-3">
            <KinButton onClick={() => void publish()} disabled={blockers.length > 0 || busy !== null} loading={busy === "phat-hanh"} loadingLabel="Đang phát hành…">Phát hành cả nhóm mã đề</KinButton>
            <Link href={deThiSubHref(id, "giao")} className={kinButtonClass("secondary")}>Giao đề</Link>
          </div>
        </section>
      )}
    </KinPage>
  );
}
