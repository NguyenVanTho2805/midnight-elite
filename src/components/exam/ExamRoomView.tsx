// Giao diện LÀM BÀI của phòng thi theo Figma 27:2 (900×836): thanh Navy trên cùng (tên Phần + "Câu N / M" bên trái, đồng hồ bên phải),
// dải báo rời tab, thân cuộn riêng chứa các câu, chân trang (tiến độ + ghi chú hết giờ + Câu trước / Câu sau / Nộp bài).
//
// Trang giữ nguyên toàn bộ logic (lưu đáp án, giờ từng Phần, rời tab, tự nộp); component này chỉ vẽ và nhận dữ liệu qua props.
//   - Toàn màn hình: thanh trên + chân cố định, chỉ phần thân cuộn. Không có vỏ module, không có chuông/menu (phòng thi khoá).
//   - Ô đáp án cao 52px (người ta bấm dưới áp lực thời gian), ô Đúng/Sai cao 44px; đang chọn = viền Navy 2px + nền nhạt (không chỉ đổi màu chữ).
//   - "Câu N / M" bấm được: mở lưới nhảy câu (câu đã trả lời viền liền, chưa trả lời viền đứt — không dựa vào màu).
//   - Nộp bài luôn qua hộp xác nhận ghi rõ còn bao nhiêu câu chưa trả lời; hết giờ thì hệ thống tự nộp (không qua hộp).
//   - Đồng hồ không đọc mỗi giây: chỉ thông báo ở mốc dưới 5 phút và dưới 1 phút.
"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { ExamQuestionPublic } from "@/lib/api";
import { MathText } from "@/components/MathText";
import { KinButton, KinConfirm } from "@/components/kin";
import {
  currentQuestionIndex, formatClock, lowTimeAnnouncement, progressLine, questionCounter, roomHeading, shortSectionName, spokenClock, timeUpNote,
} from "@/lib/examRoom";

export interface ExamRoomViewProps {
  examTitle: string;
  /** Tên các Phần theo thứ tự (null = đề không chia Phần). */
  sectionLabels: (string | null)[] | null;
  /** Phần đang làm (−1 nếu đề không chia Phần). */
  sectionIndex: number;
  /** Các câu đang hiện (Phần chưa tới lượt bị ẩn hoàn toàn). */
  questions: ExamQuestionPublic[];
  /** Tổng số câu của cả đề — mẫu số của "Câu N / M". */
  totalQuestions: number;
  /** Nhãn Phần đã hết giờ (khoá chỉ đọc). */
  lockedLabels: Set<string | null> | null;
  remainingSec: number;
  tabLeaves: number;
  selected: Record<string, string>;
  essayText: Record<string, string>;
  clusterAnswers: Record<string, boolean | null>;
  isAnswered: (q: ExamQuestionPublic) => boolean;
  onSelect: (questionId: string, optionId: string) => void;
  onEssayChange: (questionId: string, text: string) => void;
  onEssaySave: (questionId: string) => void;
  onCluster: (optionId: string, answerTrue: boolean) => void;
  onSubmit: () => void | Promise<void>;
  submitting: boolean;
  error: string;
}

const BORDER = "1px solid var(--kin-vien-thuong)";

export default function ExamRoomView(p: ExamRoomViewProps) {
  const { questions, sectionLabels, sectionIndex } = p;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const last = Math.max(0, questions.length - 1);
  const cur = Math.min(current, last);

  const updateCurrent = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    const top = box.getBoundingClientRect().top;
    const tops = Array.from(box.querySelectorAll<HTMLElement>("[data-cau]")).map(el => el.getBoundingClientRect().top - top);
    setCurrent(currentQuestionIndex(tops, box.clientHeight));
  }, []);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateCurrent); };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => { box.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [updateCurrent]);

  const goTo = (idx: number) => {
    const i = Math.min(last, Math.max(0, idx));
    document.getElementById(`q-${questions[i]?.id}`)?.scrollIntoView({ block: "start" });
    setCurrent(i);
  };

  const sectioned = !!sectionLabels && sectionIndex >= 0;
  const label = sectioned ? sectionLabels![sectionIndex] ?? null : null;
  const inSection = sectioned ? questions.filter(q => (q.sectionLabel ?? null) === (label ?? null)) : questions;
  const answeredHere = inSection.filter(p.isAnswered).length;
  const answeredAll = questions.filter(p.isAnswered).length;
  const unanswered = p.totalQuestions - answeredAll;
  const short = sectioned ? shortSectionName(label, sectionIndex) : null;
  const next = sectioned && sectionIndex < sectionLabels!.length - 1 ? shortSectionName(sectionLabels![sectionIndex + 1], sectionIndex + 1) : null;
  const heading = roomHeading({ examTitle: p.examTitle, sectionLabel: label, sectionIndex });
  const low = p.remainingSec < 60;

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--kin-nen-trang)]">
      <header className="flex-shrink-0 flex items-center justify-between gap-4 px-4 md:px-5 py-3 text-[var(--kin-chu-tren-nut-chinh)]" style={{ background: "var(--kin-th-navy)" }}>
        <div className="min-w-0">
          <p className="text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.04em] break-words" data-phong-thi-phan>{heading}</p>
          <button type="button" onClick={() => setNavOpen(o => !o)} aria-expanded={navOpen} aria-controls="luoi-nhay-cau"
            className="mt-[2px] inline-flex items-center gap-1 min-h-[28px] text-[length:var(--kin-co-body)] font-semibold underline-offset-4 hover:underline">
            {questionCounter(cur + 1, p.totalQuestions)}
            <span aria-hidden className="text-[length:var(--kin-co-caption)]">{navOpen ? "▲" : "▼"}</span>
          </button>
        </div>
        <div className="flex-shrink-0 text-right">
          <p role="timer" aria-label={`Còn lại ${spokenClock(p.remainingSec)}`} data-dong-ho
            className="font-mono font-semibold text-[length:var(--kin-co-h2)] tabular-nums tracking-[0.04em]"
            style={low ? { color: "var(--kin-tt-nen-loi)" } : undefined}>{formatClock(p.remainingSec)}</p>
          <p className="text-[length:var(--kin-co-caption)] opacity-80">{sectioned && short ? `còn lại của ${short}` : "còn lại"}</p>
        </div>
      </header>
      <p className="sr-only" role="status">{lowTimeAnnouncement(p.remainingSec)}</p>

      {/* Figma 27:10 — chỉ hiện khi đã rời ít nhất một lần; nói rõ hệ thống chỉ ĐẾM, không quay màn hình. */}
      {p.tabLeaves > 0 && (
        <div role="status" aria-live="polite" data-dai-roi-tab
          className="flex-shrink-0 flex items-start gap-2 px-4 md:px-5 py-2 text-[length:var(--kin-co-small)]"
          style={{ background: "var(--kin-tt-nen-cho)", borderBottom: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
          <span aria-hidden className="mt-[6px] inline-block w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: "var(--kin-tt-cham-cho)" }} />
          <span>Bạn đã rời khỏi tab {p.tabLeaves} lần. Hệ thống có ghi lại số lần, không quay màn hình.</span>
        </div>
      )}

      {navOpen && (
        <nav id="luoi-nhay-cau" aria-label="Nhảy tới câu" className="flex-shrink-0 px-4 md:px-5 py-3 max-h-[40vh] overflow-y-auto" style={{ background: "var(--kin-nen-bang)", borderBottom: BORDER }}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
            {questions.map((q, i) => {
              const done = p.isAnswered(q);
              return (
                <li key={q.id}>
                  <button type="button" onClick={() => { goTo(i); setNavOpen(false); }}
                    aria-label={`Câu ${i + 1}, ${done ? "đã trả lời" : "chưa trả lời"}`} aria-current={i === cur ? "true" : undefined} data-da-tra-loi={done ? "1" : "0"}
                    className="w-full min-h-[44px] rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-small)] font-semibold"
                    style={{
                      background: done ? "var(--kin-nen-nhan)" : "var(--kin-nen-trang)",
                      color: done ? "var(--kin-th-navy)" : "var(--kin-chu-mo)",
                      border: `${i === cur ? 2 : 1}px ${done ? "solid" : "dashed"} ${i === cur || done ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)"}`,
                    }}>
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-4 md:px-6 py-5 flex flex-col gap-8">
          {questions.length === 0 && <p className="text-[var(--kin-chu-mo)]">Đề này chưa có câu hỏi.</p>}
          {questions.map((q, idx) => {
            const prevSection = idx > 0 ? questions[idx - 1].sectionLabel : undefined;
            const isLocked = p.lockedLabels?.has(q.sectionLabel ?? null) ?? false;
            return (
              <Fragment key={q.id}>
                {q.sectionLabel && q.sectionLabel !== prevSection && (
                  <p className="-mb-4 text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.04em] text-[var(--kin-nhan-link)]">{q.sectionLabel}</p>
                )}
                <section id={`q-${q.id}`} data-cau={idx} aria-labelledby={`q-${q.id}-de`} className="scroll-mt-5" style={isLocked ? { opacity: 0.6 } : undefined}>
                  <h2 id={`q-${q.id}-de`} className="text-[length:var(--kin-co-body)] font-semibold leading-relaxed text-[var(--kin-chu-chinh)] mb-3">
                    Câu {idx + 1}. <MathText text={q.text} />
                  </h2>
                  {isLocked && <p className="text-[length:var(--kin-co-small)] font-semibold mb-2" style={{ color: "var(--kin-tt-chu-loi)" }}>Đã hết giờ Phần này — không thể sửa câu trả lời.</p>}
                  {q.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imageUrl} alt="" className="max-w-full rounded-[var(--kin-bo-md)] mb-3" />
                  )}

                  {q.type === "ESSAY" ? (
                    <textarea aria-labelledby={`q-${q.id}-de`} rows={5} disabled={isLocked} placeholder="Nhập câu trả lời của bạn..."
                      className="w-full px-3 py-2.5 text-[length:var(--kin-co-small)] rounded-[var(--kin-bo-md)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] disabled:cursor-not-allowed"
                      style={{ border: BORDER }}
                      value={p.essayText[q.id] ?? ""} onChange={e => p.onEssayChange(q.id, e.target.value)} onBlur={() => p.onEssaySave(q.id)} />
                  ) : q.type === "SHORT_ANSWER" ? (
                    <input aria-labelledby={`q-${q.id}-de`} disabled={isLocked} placeholder="Nhập đáp án..."
                      className="w-full px-3 min-h-[var(--kin-cham-dap-an)] text-[length:var(--kin-co-small)] rounded-[var(--kin-bo-md)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] disabled:cursor-not-allowed"
                      style={{ border: BORDER }}
                      value={p.essayText[q.id] ?? ""} onChange={e => p.onEssayChange(q.id, e.target.value)} onBlur={() => p.onEssaySave(q.id)} />
                  ) : q.type === "TRUE_FALSE_CLUSTER" ? (
                    <div className="flex flex-col gap-2">
                      {q.options.map(o => (
                        <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-2 rounded-[var(--kin-bo-md)]" style={{ border: BORDER, background: "var(--kin-nen-trang)" }}>
                          <p className="flex-1 min-w-0 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">
                            <span className="font-mono mr-2 text-[var(--kin-chu-mo)]">{o.subLabel})</span><MathText text={o.text} />
                          </p>
                          <div role="radiogroup" aria-label={`Ý ${o.subLabel}`} className="flex flex-shrink-0 rounded-[var(--kin-bo-md)] overflow-hidden" style={{ border: "1px solid var(--kin-vien-o-nhap)" }}>
                            {([["Đúng", "Đ", true], ["Sai", "S", false]] as const).map(([name, short, val]) => {
                              const on = p.clusterAnswers[o.id] === val;
                              return (
                                <button key={name} type="button" role="radio" aria-checked={on} aria-label={name} disabled={isLocked} onClick={() => p.onCluster(o.id, val)}
                                  className="min-h-11 min-w-[48px] px-3 text-[length:var(--kin-co-small)] font-semibold disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)]"
                                  style={on ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" } : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-mo)" }}>
                                  {short}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div role="radiogroup" aria-labelledby={`q-${q.id}-de`} className="flex flex-col gap-[10px]">
                      {q.options.map((o, oi) => {
                        const on = p.selected[q.id] === o.id;
                        return (
                          <label key={o.id}
                            className={`flex items-center gap-3 px-4 min-h-[var(--kin-cham-dap-an)] rounded-[var(--kin-bo-md)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--kin-nhan-link)] ${isLocked ? "cursor-not-allowed" : "cursor-pointer hover:bg-[var(--kin-nen-bang)]"}`}
                            style={{ border: `${on ? 2 : 1}px solid ${on ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)"}`, background: on ? "var(--kin-nen-nhan)" : undefined }}>
                            <input type="radio" name={`q-${q.id}`} className="sr-only" disabled={isLocked} checked={on} onChange={() => p.onSelect(q.id, o.id)} />
                            <span aria-hidden className="font-mono w-4 flex-shrink-0 text-[length:var(--kin-co-small)]" style={{ color: on ? "var(--kin-th-navy)" : "var(--kin-chu-mo)" }}>{String.fromCharCode(65 + oi)}</span>
                            <span className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]"><MathText text={o.text} /></span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              </Fragment>
            );
          })}
        </div>
      </div>

      <footer className="flex-shrink-0 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ background: "var(--kin-nen-bang)", borderTop: BORDER }}>
        <div className="min-w-0">
          <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">{progressLine(answeredHere, inSection.length, short)}</p>
          <p className="text-[length:var(--kin-co-caption)]" style={{ color: "var(--kin-tt-chu-cho)" }}>{timeUpNote({ sectionName: short, nextSectionName: next })}</p>
          {p.error && <p role="alert" className="text-[length:var(--kin-co-small)] font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{p.error}</p>}
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <KinButton variant="danger" onClick={() => setConfirmOpen(true)} disabled={p.submitting} className="flex-1 md:flex-none">Nộp bài</KinButton>
          <KinButton variant="secondary" onClick={() => goTo(cur - 1)} disabled={cur <= 0} className="flex-1 md:flex-none">Câu trước</KinButton>
          <KinButton variant="primary" onClick={() => goTo(cur + 1)} disabled={cur >= last} className="flex-1 md:flex-none">Câu sau</KinButton>
        </div>
      </footer>

      <KinConfirm open={confirmOpen} tone="nguy-hiem" title="Nộp bài ngay?"
        message={unanswered > 0 ? `Bạn còn ${unanswered} câu chưa trả lời. Sau khi nộp không sửa lại được.` : "Bạn đã trả lời hết các câu. Sau khi nộp không sửa lại được."}
        confirmLabel="Nộp bài" cancelLabel="Làm tiếp" loading={p.submitting} loadingLabel="Đang nộp…"
        onConfirm={async () => { await p.onSubmit(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} />
    </div>
  );
}
