// QZ-08 + QZ-06: chấm quiz hỗn hợp (chờ chấm và công bố), theo dõi lượt làm, phân tích kết quả — MỘT đề, phía gia sư chủ đề.
// Figma 521:4906 (máy tính) và 521:6932 (điện thoại). Dữ liệu: /api/tutor/quiz-cham/[examId]/… (chỉ gia sư chủ đề; học sinh chỉ thấy điểm SAU khi công bố).
// Figma có nhưng chưa có dữ liệu thật (không bịa): bảng "Tiêu chí" (Phương pháp / Tính toán / Trình bày) — đề chưa có thang tiêu chí, chỉ có điểm và nhận xét cho từng câu;
// nút "Mở bản gốc" cho bài nộp tệp (bài tự luận trong quiz là văn bản gõ trực tiếp; quiz không nhận ảnh bài làm của trẻ theo quyết định của chủ).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL, KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import { KinTabs } from "@/components/kin/Tabs";
import { KinStat, KinStatRow } from "@/components/kin/Stat";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { dayAt } from "@/lib/baiTap";
import { fmtPoints, validateEssayPoints, GRADE_STATE_LABEL, type GradeState, type QuizAnalytics } from "@/lib/quizGrade";

interface Row {
  attemptId: string; studentName: string; attemptNo: number; status: string; submittedAt: string | null;
  objectiveRaw: number; objectiveMax: number; essayRaw: number; essayMax: number; pendingEssays: number; blankEssays: number;
  rawTotal: number | null; score: number | null; state: GradeState; publishedAt: string | null; tabSwitchCount: number;
}
interface Overview {
  exam: { id: string; title: string; totalPoints: number; courseName: string | null };
  structure: { objectiveQuestions: number; essayQuestions: number; objectiveMax: number; essayMax: number };
  hasEssay: boolean; hold: boolean; counts: Record<GradeState, number>; attempts: Row[];
}
interface Essay { questionId: string; order: number; text: string; points: number; textAnswer: string | null; blank: boolean; pointsAwarded: number | null; teacherComment: string | null; reference: string | null }
interface Detail { attemptId: string; studentName: string; status: string; submittedAt: string | null; score: number | null; rawTotal: number | null; essays: Essay[]; pendingEssays: number; editCount: number; state: GradeState; publishedAt: string | null }
interface History { publishes: { attemptId: string; studentName: string; at: string }[]; edits: { id: string; studentName: string; questionOrder: number | null; prevPoints: number | null; newPoints: number; prevComment: string | null; newComment: string | null; at: string }[] }
interface Tracking { students: { userId: string; name: string; attemptCount: number; submittedCount: number; inProgress: boolean; lastAt: string; tabSwitches: number }[]; notStarted: { userId: string; name: string }[]; enrolledKnown: boolean }

type Tab = "bai-nop" | "cham" | "theo-doi" | "phan-tich" | "lich-su";
const TONE: Record<GradeState, StatusTone> = { cho: "cho", da_cham: "mo", cong_bo: "xong" };
const TEXTAREA = `${KIN_FIELD} py-3 resize-y`;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error((j && j.error) || "Có lỗi, thử lại sau ít phút."), { status: r.status });
  return j as T;
}
const post = <T,>(url: string, body: unknown) => call<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function Skeleton() {
  return <div aria-busy="true" aria-label="Đang tải bài chấm" className="mt-6 space-y-3">{[0, 1, 2, 3].map(i => <div key={i} className="kin-skel kin-skel--soft h-[64px] rounded" />)}</div>;
}

export default function ChamQuiz({ examId }: { examId: string }) {
  const base = `/api/tutor/quiz-cham/${examId}`;
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<{ status: number; msg: string } | null>(null);
  const [tab, setTab] = useState<Tab>("bai-nop");
  const [selId, setSelId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useKinConfirm();

  const load = useCallback(() => call<Overview>(base)
    .then(x => { setOv(x); setErr(null); })
    .catch(e => setErr({ status: (e as { status?: number }).status ?? 0, msg: (e as Error).message })), [base]);
  useEffect(() => { load(); }, [load]);

  const rows = ov?.attempts ?? [];
  const cur = rows.find(r => r.attemptId === selId) ?? null;

  function openGrade(id: string) { setSelId(id); setTab("cham"); setMsg(null); }

  async function publish(ids: string[] | null, who: string) {
    const n = ids ? ids.length : (ov?.counts.da_cham ?? 0);
    if (!(await ask({
      title: ids ? `Công bố điểm cho ${who}?` : `Công bố điểm cho ${n} bài đã chấm xong?`,
      message: "Sau khi công bố, học sinh thấy điểm tổng, điểm và nhận xét từng câu tự luận. Cô vẫn sửa điểm được, mỗi lần sửa ghi vào lịch sử.",
      confirmLabel: "Công bố", tone: "thuong",
    }))) return;
    setBusy(true); setMsg(null);
    try {
      const r = await post<{ published: string[]; alreadyPublished: string[]; skipped: { id: string; reason: string }[] }>(`${base}/publish`, ids ? { attemptIds: ids } : {});
      const sk = r.skipped.length ? ` ${r.skipped.length} bài chưa công bố được (còn tự luận chưa chấm).` : "";
      setMsg({ ok: true, text: r.published.length ? `Đã công bố ${r.published.length} bài.${sk}` : `Chưa có bài nào để công bố.${sk}` });
      await load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function setHold(hold: boolean) {
    setBusy(true); setMsg(null);
    try { await post(`${base}/policy`, { hold }); setMsg({ ok: true, text: hold ? "Đã bật giữ điểm: học sinh chỉ thấy điểm sau khi cô công bố." : "Đã tắt giữ điểm: học sinh thấy điểm ngay khi cô lưu." }); await load(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  if (err && !ov) {
    const title = err.status === 403 ? "Đề này không phải của cô" : err.status === 404 ? "Không tìm thấy đề" : "Chưa tải được bài chấm";
    return (
      <KinPage>
        <KinPageHeader title="Chấm quiz" back={{ href: "/lop-cua-toi/bai-tap", label: "‹ Bài tập" }} />
        {err.status === 403 || err.status === 404
          ? <KinEmptyState title={title} action={<Link href="/lop-cua-toi/bai-tap" className={kinButtonClass("secondary")}>Về Bài tập</Link>}>Cô chỉ chấm được quiz do chính mình tạo.</KinEmptyState>
          : <ErrorStrip message={err.msg} onRetry={() => void load()} />}
      </KinPage>
    );
  }
  if (!ov) return <KinPage><KinPageHeader title="Chấm quiz" back={{ href: "/lop-cua-toi/bai-tap", label: "‹ Bài tập" }} /><Skeleton /></KinPage>;

  const allPublished = rows.length > 0 && ov.counts.cong_bo === rows.length;
  const tabs = [
    { key: "bai-nop" as Tab, label: `Bài nộp · ${rows.length}` },
    { key: "cham" as Tab, label: "Chấm và phản hồi" },
    { key: "theo-doi" as Tab, label: "Theo dõi lượt làm" },
    { key: "phan-tich" as Tab, label: "Phân tích kết quả" },
    { key: "lich-su" as Tab, label: "Lịch sử công bố" },
  ];
  const s = ov.structure;

  return (
    <KinPage>
      {dialog}
      <KinPageHeader
        title={ov.exam.title}
        sub={ov.exam.courseName ?? "Đề dùng chung"}
        back={{ href: "/lop-cua-toi/bai-tap", label: "‹ Bài tập" }}
        actions={<KinStatus tone={rows.length === 0 ? "mo" : allPublished ? "xong" : "cho"}>{rows.length === 0 ? "Chưa có bài nộp" : allPublished ? "Đã công bố hết" : "Chưa công bố hết"}</KinStatus>}
      />
      <KinTabs tabs={tabs} value={tab} onChange={t => { setTab(t); setMsg(null); }} label="Các phần của bài chấm" />
      {err && <ErrorStrip message={err.msg} onRetry={() => void load()} />}
      {msg && <p role="status" className={`mt-4 text-[length:var(--kin-co-goc)] ${msg.ok ? "text-[var(--kin-chu-mo)]" : "text-[var(--kin-tt-chu-loi)]"}`}>{msg.text}</p>}

      {tab === "bai-nop" && (
        <>
          <KinStatRow boxed className="mt-4">
            <KinStat label="Cấu trúc đề" value={`${s.objectiveQuestions} + ${s.essayQuestions} câu`} hint={`${fmtPoints(s.objectiveMax)} điểm khách quan + ${fmtPoints(s.essayMax)} điểm tự luận`} />
            <KinStat label="Chờ chấm" value={ov.counts.cho} hint="bài còn tự luận chưa chấm" />
            <KinStat label="Đã chấm" value={ov.counts.da_cham} hint="chưa công bố" />
            <KinStat label="Đã công bố" value={ov.counts.cong_bo} hint="học sinh đã thấy điểm" />
          </KinStatRow>

          <KinPanel variant="nhan" className="mt-6">
            <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{ov.hold ? "Đang giữ điểm đến khi cô công bố" : "Chưa giữ điểm"}</p>
            <div className="mt-1.5 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">
            {!ov.hasEssay
              ? <p>Đề này không có câu tự luận, nên học sinh thấy điểm ngay khi nộp.</p>
              : ov.hold
                ? <p>Trước khi công bố, học sinh chỉ thấy xác nhận nộp bài và “Chờ cô chấm”: không có điểm tổng, điểm tự luận hay đáp án.</p>
                : <p>Học sinh thấy điểm ngay khi cô lưu điểm tự luận. Bật giữ điểm để cô chấm xong cả lô rồi mới công bố.</p>}
            {ov.hasEssay && <KinButton variant="secondary" className="mt-3" loading={busy} loadingLabel="Đang lưu…" onClick={() => void setHold(!ov.hold)}>{ov.hold ? "Tắt giữ điểm" : "Bật giữ điểm"}</KinButton>}
            </div>
          </KinPanel>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <KinSectionHead id="cn-ds" title={`Danh sách bài nộp · ${rows.length} lượt`} />
            {ov.hasEssay && rows.length > 0 && (
              <KinButton variant="primary" disabled={busy || ov.counts.da_cham === 0} onClick={() => void publish(null, "")}>
                {ov.counts.da_cham > 0 ? `Công bố ${ov.counts.da_cham} bài đã chấm` : "Chưa có bài để công bố"}
              </KinButton>
            )}
          </div>
          {rows.length === 0 ? (
            <KinEmptyState title="Chưa có bài nộp">Khi học sinh nộp bài, bài hiện ở đây. Câu trắc nghiệm tự chấm, câu tự luận chờ cô.</KinEmptyState>
          ) : (
            <div className="mt-3" role="table" aria-label="Bài nộp của học sinh">
              <div role="row" className={`hidden md:grid grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_auto] gap-4 ${KIN_TABLE_HEAD}`}>
                <span role="columnheader">Học sinh</span><span role="columnheader">Khách quan</span><span role="columnheader">Tự luận</span><span role="columnheader">Trạng thái</span><span role="columnheader" className="text-right">Việc cần làm</span>
              </div>
              {rows.map(r => (
                <div role="row" key={r.attemptId} className={`grid md:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_auto] gap-x-4 gap-y-2 ${KIN_TABLE_ROW}`}>
                  <span role="cell" className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{r.studentName}{r.attemptNo > 1 ? ` · lượt ${r.attemptNo}` : ""}
                    <span className="block text-[var(--kin-chu-mo)]">{r.submittedAt ? `Nộp ${dayAt(new Date(r.submittedAt))}` : "Chưa có giờ nộp"}</span></span>
                  <span role="cell"><span className="md:hidden text-[var(--kin-chu-mo)]">Khách quan: </span>{fmtPoints(r.objectiveRaw)} / {fmtPoints(r.objectiveMax)}</span>
                  <span role="cell"><span className="md:hidden text-[var(--kin-chu-mo)]">Tự luận: </span>{!ov.hasEssay ? "Không có" : r.pendingEssays > 0 ? `Chờ chấm (${r.pendingEssays} câu)` : `${fmtPoints(r.essayRaw)} / ${fmtPoints(r.essayMax)}`}</span>
                  <span role="cell"><KinStatus tone={TONE[r.state]}>{GRADE_STATE_LABEL[r.state]}</KinStatus></span>
                  <span role="cell" className="flex flex-wrap gap-2 md:justify-end">
                    <button type="button" onClick={() => openGrade(r.attemptId)} className={kinButtonClass("secondary")}>{r.state === "cho" ? "Chấm bài" : "Xem và sửa"}</button>
                    {r.state === "da_cham" && <KinButton variant="primary" disabled={busy} onClick={() => void publish([r.attemptId], r.studentName)}>Công bố</KinButton>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "cham" && <GradeTab key={cur?.attemptId ?? rows[0]?.attemptId ?? "none"} base={base} ov={ov} rows={rows} cur={cur} onPick={id => { setSelId(id); setMsg(null); }} onChanged={load} onPublish={(id, who) => void publish([id], who)} busy={busy} />}
      {tab === "theo-doi" && <TrackingTab base={base} />}
      {tab === "phan-tich" && <AnalyticsTab base={base} />}
      {tab === "lich-su" && <HistoryTab base={base} />}
    </KinPage>
  );
}

function GradeTab({ base, ov, rows, cur, onPick, onChanged, onPublish, busy }: {
  base: string; ov: Overview; rows: Row[]; cur: Row | null; onPick: (id: string) => void; onChanged: () => Promise<void>; onPublish: (id: string, who: string) => void; busy: boolean;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [draft, setDraft] = useState<Record<string, { points: string; comment: string }>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = cur?.attemptId ?? rows[0]?.attemptId ?? null;

  const fetchDetail = useCallback(() => {
    if (!id) return;
    call<Detail>(`${base}/attempts/${id}`)
      .then(x => {
        setD(x); setLoadErr(false);
        setDraft(Object.fromEntries(x.essays.map(e => [e.questionId, { points: e.pointsAwarded === null ? "" : fmtPoints(e.pointsAwarded), comment: e.teacherComment ?? "" }])));
      })
      .catch(() => setLoadErr(true));
  }, [base, id]);
  useEffect(() => { fetchDetail(); }, [fetchDetail]); // GradeTab được dựng lại (key) mỗi khi đổi bài nên state đã sạch

  const row = rows.find(r => r.attemptId === id) ?? null;
  // Tổng đề xuất tính từ ô đang nhập: khách quan (đã chấm tự động) + tự luận đang nhập. Chỉ là bản nháp cho tới khi lưu.
  const draftEssay = useMemo(() => {
    if (!d) return 0;
    return d.essays.reduce((sum, e) => { const v = validateEssayPoints(draft[e.questionId]?.points ?? "", e.points); return sum + (v.ok ? v.value : 0); }, 0);
  }, [d, draft]);

  async function save() {
    if (!d) return;
    const grades: { questionId: string; points: number; comment: string }[] = [];
    for (const e of d.essays) {
      const dr = draft[e.questionId] ?? { points: "", comment: "" };
      if (e.blank && dr.points.trim() === "") continue; // bỏ trống, không bắt buộc chấm
      const v = validateEssayPoints(dr.points, e.points);
      if (!v.ok) { setMsg({ ok: false, text: `Câu ${e.order}: ${v.error}` }); return; }
      grades.push({ questionId: e.questionId, points: v.value, comment: dr.comment });
    }
    if (grades.length === 0) { setMsg({ ok: false, text: "Chưa có điểm nào để lưu." }); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await post<{ changed: number }>(`${base}/attempts/${d.attemptId}`, { grades });
      setMsg({ ok: true, text: r.changed ? (ov.hold && d.state !== "cong_bo" ? "Đã lưu điểm. Học sinh chưa thấy gì cho tới khi cô công bố." : "Đã lưu điểm và nhận xét.") : "Không có gì thay đổi." });
      fetchDetail(); await onChanged();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setSaving(false); }
  }

  if (rows.length === 0) return <KinEmptyState title="Chưa có bài nộp để chấm">Khi học sinh nộp bài, cô chấm từng câu tự luận ở đây.</KinEmptyState>;
  if (!ov.hasEssay) return <KinEmptyState title="Đề này không có câu tự luận">Câu trắc nghiệm tự chấm khi nộp, không cần cô chấm tay.</KinEmptyState>;

  return (
    <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-x-8 gap-y-8 items-start">
      <div className="min-w-0">
        <label htmlFor="cq-pick" className={`${KIN_LABEL} mb-2`}>Bài nộp đang chấm</label>
        <select id="cq-pick" className={KIN_FIELD} value={id ?? ""} onChange={e => onPick(e.target.value)}>
          {rows.map((r, i) => <option key={r.attemptId} value={r.attemptId}>{r.studentName}{r.attemptNo > 1 ? ` · lượt ${r.attemptNo}` : ""} · {GRADE_STATE_LABEL[r.state]} ({i + 1}/{rows.length})</option>)}
        </select>

        {loadErr ? <div className="mt-4"><ErrorStrip message="Không tải được bài này." onRetry={fetchDetail} /></div>
          : !d ? <div aria-busy="true" aria-label="Đang tải bài nộp" className="kin-skel kin-skel--soft h-[240px] rounded mt-4" />
          : (
            <>
              <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{d.studentName} · {d.submittedAt ? `nộp ${dayAt(new Date(d.submittedAt))}` : "chưa có giờ nộp"}</p>
              {d.essays.map(e => {
                const dr = draft[e.questionId] ?? { points: "", comment: "" };
                return (
                  <section key={e.questionId} aria-labelledby={`cq-q-${e.order}`} className="mt-5 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-5">
                    <h3 id={`cq-q-${e.order}`} className="text-[length:var(--kin-co-body)] font-medium text-[var(--kin-chu-chinh)]">Câu {e.order} · Tự luận · {fmtPoints(e.points)} điểm</h3>
                    <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] whitespace-pre-wrap break-words">Đề: {e.text}</p>
                    <div className="mt-3 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-4">
                      <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Nội dung văn bản đã nộp</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{e.blank ? "Học sinh không làm câu này." : e.textAnswer}</p>
                    </div>
                    {e.reference && (
                      <details className="mt-3">
                        <summary className="min-h-11 flex items-center cursor-pointer text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)]">Đáp án tham khảo · chỉ cô xem</summary>
                        <p className="mt-1 whitespace-pre-wrap break-words text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{e.reference}</p>
                      </details>
                    )}
                    <div className="mt-4 max-w-[220px]">
                      <label htmlFor={`cq-p-${e.order}`} className={`${KIN_LABEL} mb-2`}>Điểm / {fmtPoints(e.points)}</label>
                      <input id={`cq-p-${e.order}`} inputMode="decimal" className={KIN_FIELD} value={dr.points} placeholder="Chưa nhập"
                        onChange={ev => setDraft(p => ({ ...p, [e.questionId]: { ...dr, points: ev.target.value } }))} />
                    </div>
                    <div className="mt-4">
                      <label htmlFor={`cq-c-${e.order}`} className={`${KIN_LABEL} mb-2`}>Phản hồi cho {d.studentName}</label>
                      <textarea id={`cq-c-${e.order}`} rows={3} className={TEXTAREA} value={dr.comment}
                        onChange={ev => setDraft(p => ({ ...p, [e.questionId]: { ...dr, comment: ev.target.value } }))} />
                    </div>
                  </section>
                );
              })}
            </>
          )}
      </div>

      <KinPanel as="aside" variant="nhan" aria-label="Điểm và công bố">
        <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Điểm và phản hồi</h2>
        {row && <KinStatus tone={TONE[row.state]} className="mt-2">{GRADE_STATE_LABEL[row.state]}</KinStatus>}
        {row && d && (
          <dl className="mt-4 space-y-2 text-[length:var(--kin-co-goc)]">
            <div className="flex justify-between gap-3"><dt className="text-[var(--kin-chu-mo)]">Khách quan</dt><dd className="tabular-nums">{fmtPoints(row.objectiveRaw)} / {fmtPoints(row.objectiveMax)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--kin-chu-mo)]">Tự luận đang nhập</dt><dd className="tabular-nums">{fmtPoints(draftEssay)} / {fmtPoints(row.essayMax)}</dd></div>
            <div className="flex justify-between gap-3 font-medium"><dt>Tổng đề xuất</dt><dd className="tabular-nums">{fmtPoints(row.objectiveRaw + draftEssay)} / {fmtPoints(row.objectiveMax + row.essayMax)}</dd></div>
          </dl>
        )}
        <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">Chưa phải điểm đã công bố{row?.state === "cong_bo" ? " (bài này đã công bố, sửa điểm sẽ cập nhật cho học sinh)" : ""}.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <KinButton variant="secondary" loading={saving} loadingLabel="Đang lưu…" disabled={!d} onClick={() => void save()}>Lưu điểm</KinButton>
          {row && row.state !== "cong_bo" && (
            <KinButton variant="primary" disabled={busy || saving || row.state === "cho"} onClick={() => onPublish(row.attemptId, row.studentName)}>Công bố cho em này</KinButton>
          )}
        </div>
        {row?.state === "cho" && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chấm và lưu hết các câu tự luận thì mới công bố được.</p>}
        <p role="status" className={`mt-3 text-[length:var(--kin-co-goc)] ${msg && !msg.ok ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-mo)]"}`}>
          {msg ? msg.text : ov.hold ? "Lưu điểm không gửi điểm cho học sinh. Học sinh chỉ thấy sau khi cô công bố." : "Đề này không giữ điểm: học sinh thấy điểm ngay khi cô lưu."}
        </p>
        {d && d.editCount > 0 && <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bài này đã sửa điểm {d.editCount} lần (xem ở Lịch sử công bố).</p>}
      </KinPanel>
    </div>
  );
}

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState(false);
  const run = useCallback(() => { setErr(false); call<T>(url).then(setData).catch(() => setErr(true)); }, [url]);
  useEffect(() => { let live = true; call<T>(url).then(x => { if (live) setData(x); }).catch(() => { if (live) setErr(true); }); return () => { live = false; }; }, [url]);
  return { data, err, run };
}

function TrackingTab({ base }: { base: string }) {
  const { data, err, run } = useFetch<Tracking>(`${base}/theo-doi`);
  if (err) return <div className="mt-4"><ErrorStrip message="Không tải được lượt làm." onRetry={run} /></div>;
  if (!data) return <Skeleton />;
  return (
    <div className="mt-6">
      <KinSectionHead id="cq-td" title={`Học sinh đã làm · ${data.students.length}`} />
      {data.students.length === 0 ? <KinEmptyState title="Chưa có học sinh nào làm">Khi học sinh bấm làm bài, lượt làm hiện ở đây.</KinEmptyState> : (
        <ul className="mt-2">
          {data.students.map(s => (
            <li key={s.userId} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${KIN_TABLE_ROW}`}>
              <span className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{s.name}<span className="block text-[var(--kin-chu-mo)]">Gần nhất {dayAt(new Date(s.lastAt))}</span></span>
              <span className="text-[var(--kin-chu-mo)]">{s.attemptCount} lượt{s.inProgress ? " · đang làm dở" : ""}{s.tabSwitches > 0 ? ` · rời tab ${s.tabSwitches} lần` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8">
        <KinSectionHead id="cq-chua" title={data.enrolledKnown ? `Chưa làm · ${data.notStarted.length}` : "Chưa làm"} />
        {!data.enrolledKnown ? <KinCallout className="mt-2">Đề này chưa gắn với lớp nào nên KiN chưa biết học sinh nào chưa làm.</KinCallout>
          : data.notStarted.length === 0 ? <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Học sinh đang học trong lớp đều đã bắt đầu làm.</p>
          : <ul className="mt-2">{data.notStarted.map(s => <li key={s.userId} className={KIN_TABLE_ROW}>{s.name}</li>)}</ul>}
      </div>
    </div>
  );
}

function AnalyticsTab({ base }: { base: string }) {
  const { data, err, run } = useFetch<QuizAnalytics>(`${base}/thong-ke`);
  if (err) return <div className="mt-4"><ErrorStrip message="Không tải được phân tích." onRetry={run} /></div>;
  if (!data) return <Skeleton />;
  if (data.submittedCount === 0) return <KinEmptyState title="Chưa có bài nộp để phân tích">Phân tích hiện khi có học sinh nộp bài.</KinEmptyState>;
  const maxCount = Math.max(1, ...data.distribution.map(b => b.count));
  const pct = (n: number | null) => (n === null ? "—" : `${String(n).replace(".", ",")}%`);
  return (
    <div className="mt-4">
      <KinStatRow>
        <KinStat label="Lượt đã nộp" value={data.submittedCount} hint={data.inProgressCount > 0 ? `${data.inProgressCount} lượt đang làm dở` : `${data.studentCount} học sinh`} />
        <KinStat label="Điểm trung bình" value={pct(data.avgPercent)} hint={`tính trên ${data.scoredCount} lượt đã có đủ điểm`} />
        <KinStat label="Cao nhất" value={pct(data.maxPercent)} />
        <KinStat label="Thấp nhất" value={pct(data.minPercent)} />
      </KinStatRow>
      {data.waitingCount > 0 && <KinCallout className="mt-4">{data.waitingCount} lượt còn tự luận chờ chấm nên chưa tính vào điểm ở trên.</KinCallout>}

      <KinSectionHead id="cq-pb" title="Phân bố điểm (theo % thang điểm)" />
      <ul className="mt-2 space-y-2" aria-label="Phân bố điểm">
        {data.distribution.map(b => (
          <li key={b.label} className="grid grid-cols-[72px_minmax(0,1fr)_32px] items-center gap-3 text-[length:var(--kin-co-goc)]">
            <span className="text-[var(--kin-chu-mo)]">{b.label}</span>
            <span className="block h-3 rounded-sm bg-[var(--kin-nen-bang)]"><span className="block h-3 rounded-sm bg-[var(--kin-nhan-nen)]" style={{ width: `${(b.count / maxCount) * 100}%` }} /></span>
            <span className="tabular-nums text-right text-[var(--kin-chu-chinh)]">{b.count}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8"><KinSectionHead id="cq-cau" title="Từng câu" /></div>
      <ul className="mt-2">
        {data.questions.map(q => (
          <li key={q.questionId} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${KIN_TABLE_ROW}`}>
            <span className="text-[var(--kin-chu-chinh)]">Câu {q.order} · {q.type === "MC" ? "Trắc nghiệm" : q.type === "ESSAY" ? "Tự luận" : q.type === "SHORT_ANSWER" ? "Điền ngắn" : "Đúng/sai nhiều ý"} · {fmtPoints(q.points)} điểm</span>
            <span className="text-[var(--kin-chu-mo)] tabular-nums">
              {q.correct !== null ? `${q.correct}/${q.counted} đúng${q.counted ? ` (${Math.round((q.correct / q.counted) * 100)}%)` : ""}${q.blank ? ` · ${q.blank} bỏ trống` : ""}`
                : q.type === "ESSAY" ? (q.essayAvgRatio !== null ? `điểm trung bình ${Math.round(q.essayAvgRatio * 100)}% · ${q.counted} bài đã chấm${q.pendingEssays ? ` · ${q.pendingEssays} chờ chấm` : ""}` : q.pendingEssays ? `${q.pendingEssays} bài chờ chấm` : "chưa có bài đã chấm")
                : "chấm theo từng ý, chưa tổng hợp"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryTab({ base }: { base: string }) {
  const { data, err, run } = useFetch<History>(`${base}/history`);
  if (err) return <div className="mt-4"><ErrorStrip message="Không tải được lịch sử." onRetry={run} /></div>;
  if (!data) return <Skeleton />;
  const q = (n: number | null) => (n === null ? "chưa chấm" : fmtPoints(n));
  return (
    <div className="mt-6">
      <KinSectionHead id="cq-ls-cb" title={`Đã công bố · ${data.publishes.length}`} />
      {data.publishes.length === 0 ? <KinEmptyState title="Chưa công bố bài nào">Khi cô công bố điểm, từng lần hiện ở đây.</KinEmptyState> : (
        <ul className="mt-2">{data.publishes.map(p => <li key={p.attemptId} className={`flex flex-wrap justify-between gap-x-4 ${KIN_TABLE_ROW}`}><span className="break-words">{p.studentName}</span><span className="text-[var(--kin-chu-mo)]">{dayAt(new Date(p.at))}</span></li>)}</ul>
      )}
      <div className="mt-8"><KinSectionHead id="cq-ls-sd" title={`Lịch sử sửa điểm · ${data.edits.length}`} /></div>
      {data.edits.length === 0 ? <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa có lần chấm hay sửa điểm nào.</p> : (
        <ul className="mt-2">
          {data.edits.map(e => (
            <li key={e.id} className={KIN_TABLE_ROW}>
              <span className="block break-words text-[var(--kin-chu-chinh)]">{e.studentName} · câu {e.questionOrder ?? "?"}: {q(e.prevPoints)} → {fmtPoints(e.newPoints)} điểm</span>
              <span className="block text-[var(--kin-chu-mo)]">{dayAt(new Date(e.at))}{e.prevComment !== e.newComment ? " · nhận xét đã đổi" : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
