// Màn LÀM BÀI: ghép khung, đồng hồ, chip lưu, các khối câu, bảng số câu, nộp bài. Mọi dữ liệu và mọi phán quyết (giờ, đáp án) đến từ useRoomSession / máy chủ.
// Hai chế độ xem: "Từng câu" (một khối; mặc định ở màn nhỏ và luôn dùng cho luyện tập) và "Cả đề" (danh sách cuộn). Lựa chọn nhớ ở localStorage `kin.room.view`.
"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { currentQuestionIndex, questionCounter, roomHeading, shortSectionName, timeUpNote } from "@/lib/examRoom";
import type { UnansweredItem } from "@/lib/quizRoom";
import { KinButton } from "@/components/kin";
import QuestionBlock from "./QuestionBlock";
import QuestionGrid, { Legend, type GridQuestion } from "./QuestionGrid";
import RoomFooter from "./RoomFooter";
import RoomLayout from "./RoomLayout";
import { Clock, SaveChipView } from "./RoomClock";
import SubmitPanel from "./SubmitPanel";
import ViewSwitch from "./ViewSwitch";
import { roomApi, RoomApiError, type CheckResult, type ExamMode } from "./roomApi";
import { resolveView, VIEW_STORAGE_KEY, type ViewMode } from "./roomLogic";
import type { RoomSession } from "./useRoomSession";

interface PState { result: CheckResult | null; loading: boolean; error: string }
const NONE: PState = { result: null, loading: false, error: "" };

export default function TakingRoom({ s, examTitle, mode, feedback }: { s: RoomSession; examTitle: string; mode: ExamMode; feedback: "instant" | "none" }) {
  const att = s.attempt!;
  const practice = mode === "practice";
  const vis = s.questions.visible;
  const last = Math.max(0, vis.length - 1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const [view, setView] = useState<ViewMode>(() => resolveView(mode, typeof window === "undefined" ? null : window.localStorage.getItem(VIEW_STORAGE_KEY), typeof window === "undefined" ? 1280 : window.innerWidth));
  const [sheet, setSheet] = useState(false);
  const [ps, setPs] = useState<Record<string, PState>>({});
  const idx = Math.min(cur, last);

  const pick = (v: ViewMode) => { setView(v); try { window.localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* bỏ qua */ } };
  const goTo = useCallback((i: number) => {
    const n = Math.min(last, Math.max(0, i));
    setCur(n); setSheet(false);
    if (view === "whole") document.getElementById(`q-${vis[n]?.id}`)?.scrollIntoView({ block: "start" });
    else scrollRef.current?.scrollTo({ top: 0 });
  }, [last, view, vis]);

  // Cả đề: câu đang xem = câu cuối có mép trên nằm trong 30% đầu khung cuộn.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || view !== "whole") return;
    let raf = 0;
    const upd = () => {
      const top = box.getBoundingClientRect().top;
      setCur(currentQuestionIndex(Array.from(box.querySelectorAll<HTMLElement>("[data-cau]")).map(el => el.getBoundingClientRect().top - top), box.clientHeight));
    };
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(upd); };
    box.addEventListener("scroll", on, { passive: true });
    return () => { box.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [view]);
  useEffect(() => {
    if (view === "whole") document.getElementById(`q-${vis[idx]?.id}`)?.scrollIntoView({ block: "start" }); // đổi chế độ xem: ở lại đúng câu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ── luyện tập: chấm từng câu ở máy chủ ──
  const setP = (id: string, v: Partial<PState>) => setPs(p => ({ ...p, [id]: { ...(p[id] ?? NONE), ...v } }));
  const run = async (id: string, action: "check" | "reveal") => {
    setP(id, { loading: true, error: "" });
    try {
      await s.flush(); // máy chủ chấm ĐÁP ÁN ĐÃ LƯU, nên phải lưu xong đã
      setP(id, { result: await roomApi.check(att.attemptId, id, action), loading: false });
    } catch (e) {
      const er = e as RoomApiError;
      setP(id, { loading: false, error: er.code === "not_answered" ? "Đáp án câu này chưa lưu được. Kiểm tra mạng rồi bấm lại." : er.code === "no_feedback" ? "Đề này giữ điểm tới khi gia sư công bố nên chưa kiểm từng câu được." : er.message || "Chưa kiểm tra được, thử lại." });
    }
  };
  const stale = (id: string) => { if (ps[id]?.result?.state === "hint") setP(id, { result: null }); };

  const grid: GridQuestion[] = vis.map(q => {
    const r = ps[q.id]?.result;
    return { id: q.id, answered: s.isAnswered(q), flagged: s.flags.has(q.id), practice: r ? (r.state === "solved" || (r.state === "revealed" && r.correct) ? "correct" : "wrong") : null };
  });
  const unanswered: UnansweredItem[] = vis.flatMap((q, i) => (s.isAnswered(q) ? [] : [{ index: i + 1, id: q.id, essay: q.type === "ESSAY" }]));
  const answeredHere = grid.filter(g => g.answered).length;
  const labels = s.sectionWindows?.map(w => w.label) ?? null;
  const sectioned = !!labels && s.sectionIndex >= 0;
  const label = sectioned ? labels![s.sectionIndex] ?? null : null;
  const short = sectioned ? shortSectionName(label, s.sectionIndex) : null;
  const next = sectioned && s.sectionIndex < labels!.length - 1 ? shortSectionName(labels![s.sectionIndex + 1], s.sectionIndex + 1) : null;
  const panel = (variant: "bang" | "cuoi" | "to") => (
    <SubmitPanel variant={variant} unanswered={unanswered} flaggedCount={vis.filter(q => s.flags.has(q.id)).length} hasEssay={vis.some(q => q.type === "ESSAY")}
      hiddenUnopened={Math.max(0, s.questions.all.length - vis.length)} answered={answeredHere} total={vis.length} submitting={s.submitting} error={s.submitErr}
      onSubmit={s.submit} timeUpNote={timeUpNote({ sectionName: short, nextSectionName: next })} />
  );

  const block = (q: (typeof vis)[number], i: number) => {
    const st = ps[q.id] ?? NONE;
    return (
      <QuestionBlock key={q.id} q={q} index={i} locked={s.questions.locked?.has(q.sectionLabel ?? null) ?? false} answered={grid[i].answered} flagged={s.flags.has(q.id)}
        selected={s.selected[q.id]} text={s.text[q.id] ?? ""} cluster={s.cluster} textStatus={s.textStatus[q.id]}
        onSelect={o => { stale(q.id); s.selectOption(q.id, o); }} onBool={(o, v) => { stale(q.id); s.setBool(q.id, o, v); }}
        onText={t => s.typeText(q.id, t)} onBlur={s.blurText} onFlag={() => s.toggleFlag(q.id)}
        practice={practice ? { feedback, result: st.result, loading: st.loading, error: st.error, isLast: i >= last,
          onCheck: () => void run(q.id, "check"), onRetry: () => setP(q.id, { result: null, error: "" }), onReveal: () => void run(q.id, "reveal"), onNext: () => goTo(i + 1) } : undefined} />
    );
  };
  const heading = (i: number, always = false) => vis[i].sectionLabel && (always || vis[i].sectionLabel !== vis[i - 1]?.sectionLabel)
    ? <p key={`h-${vis[i].id}`} className="text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.04em] text-[var(--kin-nhan-link)]">{vis[i].sectionLabel}</p> : null;

  const counterText = questionCounter(idx + 1, s.questions.all.length);
  return (
    <RoomLayout scrollRef={scrollRef}
      title={<p className="hidden lg:block text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.04em] truncate max-w-full" data-phong-thi-phan>{roomHeading({ examTitle, sectionLabel: label, sectionIndex: s.sectionIndex })}</p>}
      counter={<>
        <p data-so-cau className="hidden lg:block text-[length:var(--kin-co-body)] font-semibold tabular-nums">{counterText}{att.variantCode != null && <span className="ml-3 font-normal opacity-80" data-ma-de>Mã đề {att.variantCode}</span>}</p>
        <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" className="lg:hidden inline-flex items-center gap-1 min-h-11 px-2 text-[length:var(--kin-co-body)] font-semibold tabular-nums">
          {counterText}<span aria-hidden className="text-[length:var(--kin-co-caption)]">▾</span>
        </button>
      </>}
      clock={<Clock remainingSec={s.remainingSec} caption={sectioned && short ? `còn lại của ${short}` : "còn lại"} />}
      chip={<SaveChipView chip={s.chip} onRetry={s.retrySave} />}
      strip={s.tabLeaves > 0 ? (
        <div role="status" aria-live="polite" data-dai-roi-tab className="flex-shrink-0 flex items-start gap-2 px-4 py-2 text-[length:var(--kin-co-small)]"
          style={{ background: "var(--kin-tt-nen-cho)", borderBottom: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
          <span aria-hidden className="mt-[6px] inline-block w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: "var(--kin-tt-cham-cho)" }} />
          <span>Em đã rời khỏi màn hình {s.tabLeaves} lần. KiN chỉ ghi nhận để gia sư biết.</span>
        </div>) : null}
      subBar={<div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2" style={{ background: "var(--kin-nen-bang)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>
        <p className="lg:hidden min-w-0 truncate text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-phu)]" data-tieu-de-di-dong>{examTitle}{att.variantCode != null ? ` · Mã đề ${att.variantCode}` : ""}</p>
        <div className="ml-auto">{practice ? <span className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-mo)]" data-che-do="luyen-tap">Luyện tập · sai thì được gợi ý</span> : <ViewSwitch value={view} onChange={pick} />}</div>
      </div>}
      aside={<>
        <h2 className="mb-3 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">Bảng số câu</h2>
        <QuestionGrid items={grid} current={idx} onPick={goTo} />
        <div className="mt-3"><Legend /></div>
        <div className="mt-6">{panel("bang")}</div>
      </>}
      footer={<RoomFooter index={idx} last={last} onPrev={() => goTo(idx - 1)} onNext={() => goTo(idx + 1)} />}
      sheet={sheet ? (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end" onKeyDown={e => { if (e.key === "Escape") setSheet(false); }}>
          <button type="button" aria-label="Đóng bảng số câu" className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setSheet(false)} tabIndex={-1} />
          <div role="dialog" aria-modal="true" aria-label="Bảng số câu" className="relative max-h-[85dvh] overflow-y-auto rounded-t-[var(--kin-bo-the)] p-4 flex flex-col gap-4" style={{ background: "var(--kin-nen-trang)" }}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-[var(--kin-chu-chinh)]">Bảng số câu</h2><KinButton variant="ghost" autoFocus onClick={() => setSheet(false)}>Đóng</KinButton></div>
            <QuestionGrid items={grid} current={idx} onPick={goTo} label="Nhảy tới câu (điện thoại)" />
            <Legend />
            {panel("to")}
          </div>
        </div>) : null}>
      {vis.length === 0 && <p className="text-[var(--kin-chu-mo)]">Đề này chưa có câu hỏi.</p>}
      {view === "whole"
        ? <>{vis.map((q, i) => <Fragment key={q.id}>{heading(i)}{block(q, i)}</Fragment>)}{vis.length > 0 && <div className="mt-4 pb-8 lg:pb-12">{panel("cuoi")}</div>}</>
        : <>{vis[idx] && heading(idx, true)}{vis[idx] && block(vis[idx], idx)}{vis.length > 0 && idx >= last && <div className="mt-4 lg:hidden pb-4">{panel("cuoi")}</div>}</>}
    </RoomLayout>
  );
}
