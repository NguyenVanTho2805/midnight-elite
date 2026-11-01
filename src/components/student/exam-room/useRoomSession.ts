// Một lượt làm bài: vào/tiếp tục, đáp án, lưu nền, đồng hồ theo máy chủ, giờ riêng từng Phần, đánh dấu xem lại, rời tab, nộp và hết giờ.
// Luật giữ nguyên từ phòng thi cũ: mốc giờ là của MÁY CHỦ (offset lấy từ serverNow mỗi lần máy chủ trả lời), hết giờ → tự nộp kể cả mất mạng
// (không có xác nhận thì ở màn "chưa xác nhận" và gửi lại khi có mạng; máy chủ chốt tại expiresAt nên câu gửi muộn bị từ chối).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExamQuestionPublic } from "@/lib/api";
import { clockOffsetMs, remainingSecFrom } from "@/lib/quizRoom";
import { roomApi, RoomApiError, type RoomStart, type RoomSubmit } from "./roomApi";
import { flagStorageKey } from "./roomLogic";
import { useSaveQueue } from "./useSaveQueue";

const TEXT_DEBOUNCE_MS = 1200;

export function useRoomSession(examId: string) {
  const [attempt, setAttempt] = useState<RoomStart | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [cluster, setCluster] = useState<Record<string, boolean | null>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [tabLeaves, setTabLeaves] = useState(0);
  const [offset, setOffset] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [timeUp, setTimeUp] = useState<null | "sending" | "unconfirmed">(null);
  const [timeUpAt, setTimeUpAt] = useState<string | null>(null);
  const [result, setResult] = useState<RoomSubmit | null>(null);
  const auto = useRef(false);
  const inFlight = useRef(false);
  const offsetRef = useRef(0);
  const doSubmitRef = useRef<(auto: boolean) => Promise<void>>(async () => {});

  const applyClock = useCallback((serverNow: string | null, exp: string | null) => {
    if (serverNow) { const o = clockOffsetMs(serverNow, Date.now()); offsetRef.current = o; setOffset(o); }
    if (exp) setExpiresAt(exp);
  }, []);
  const q = useSaveQueue(attempt?.attemptId ?? null, { onClock: applyClock, onEnded: () => { void beginTimeUp(); } });

  const nowLabel = () => new Date(Date.now() + offsetRef.current).toLocaleTimeString("vi-VN", { hour12: false });
  const beginTimeUp = useCallback(async () => {
    if (auto.current) return;
    auto.current = true; setTimeUp("sending"); setTimeUpAt(nowLabel());
    await doSubmitRef.current(true);
  }, []);

  /** Đổ trạng thái lượt (bắt đầu / tiếp tục) vào màn làm bài; phủ hàng đợi chưa lưu của lần trước lên trên bản máy chủ. */
  const hydrate = useCallback((st: RoomStart) => {
    applyClock(st.serverNow ?? null, st.expiresAt ?? null);
    const sel = { ...((st.answers ?? {}) as Record<string, string>) };
    const txt = { ...(st.textAnswers ?? {}) };
    const bool = { ...(st.boolAnswers ?? {}) };
    for (const it of q.adopt(st.attemptId)) {
      const p = it.payload;
      if (p.kind === "opt") sel[p.questionId] = p.optionId; else if (p.kind === "text") txt[p.questionId] = p.text; else bool[p.optionId] = p.value;
    }
    let fl = new Set<string>();
    try { fl = new Set(JSON.parse(window.localStorage.getItem(flagStorageKey(st.attemptId)) ?? "[]") as string[]); } catch { /* bỏ qua */ }
    auto.current = false; inFlight.current = false;
    setSelected(sel); setText(txt); setCluster(bool); setFlags(fl); setTabLeaves(st.tabSwitchCount ?? 0);
    setTimeUp(null); setTimeUpAt(null); setResult(null); setSubmitErr(""); setAttempt(st);
  }, [applyClock, q.adopt]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async (password?: string): Promise<boolean> => {
    setStartErr(""); setStarting(true);
    try { hydrate(await roomApi.start(examId, password || undefined)); return true; }
    catch (e) { setStartErr(e instanceof RoomApiError ? e.message : "Không thể bắt đầu bài thi"); return false; }
    finally { setStarting(false); }
  }, [examId, hydrate]);

  // ── đáp án ──
  const selectOption = (questionId: string, optionId: string) => { setSelected(p => ({ ...p, [questionId]: optionId })); q.enqueue({ kind: "opt", questionId, optionId }); };
  const setBool = (questionId: string, optionId: string, value: boolean) => { setCluster(p => ({ ...p, [optionId]: value })); q.enqueue({ kind: "bool", questionId, optionId, value }); };
  const typeText = (questionId: string, t: string) => { setText(p => ({ ...p, [questionId]: t })); q.enqueue({ kind: "text", questionId, text: t }, TEXT_DEBOUNCE_MS); };
  const blurText = () => { void q.flush(); };
  const toggleFlag = (questionId: string) => setFlags(prev => {
    const n = new Set(prev); if (n.has(questionId)) n.delete(questionId); else n.add(questionId);
    if (attempt) try { window.localStorage.setItem(flagStorageKey(attempt.attemptId), JSON.stringify([...n])); } catch { /* bỏ qua */ }
    return n;
  });
  const isAnswered = useCallback((x: ExamQuestionPublic): boolean => {
    if (x.type === "ESSAY" || x.type === "SHORT_ANSWER") return !!text[x.id]?.trim();
    if (x.type === "TRUE_FALSE_CLUSTER") return x.options.every(o => cluster[o.id] === true || cluster[o.id] === false);
    if (x.type === "MC_MULTI") return x.options.some(o => cluster[o.id] === true);
    return !!selected[x.id];
  }, [text, cluster, selected]);

  // ── giờ: theo máy chủ, có giờ riêng Phần ──
  const windows = attempt?.sectionWindows ?? null;
  const serverNowMs = Date.now() + offset;
  const sectionIndex = windows && windows.length > 0 ? (() => { const i = windows.findIndex(w => new Date(w.endsAt).getTime() > serverNowMs); return i === -1 ? windows.length - 1 : i; })() : -1;
  const isLastSection = !windows || sectionIndex === windows.length - 1;
  const endIso = windows && sectionIndex >= 0 ? windows[sectionIndex].endsAt : expiresAt;
  const remainingSec = endIso ? remainingSecFrom(endIso, offset, Date.now()) : 0;
  const running = !!attempt && !result;
  useEffect(() => { if (!running) return; const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, [running]);
  useEffect(() => { if (running && expiresAt && isLastSection && remainingSec <= 0) void beginTimeUp(); }, [running, expiresAt, isLastSection, remainingSec, beginTimeUp]);

  const questions = useMemo(() => {
    const all = attempt?.questions ?? [];
    if (!windows) return { all, visible: all, locked: null as Set<string | null> | null };
    const show = new Set(windows.slice(0, sectionIndex + 1).map(w => w.label));
    return { all, visible: all.filter(x => show.has(x.sectionLabel ?? null)), locked: new Set(windows.slice(0, sectionIndex).map(w => w.label)) };
  }, [attempt?.questions, windows, sectionIndex]);

  // ── nộp ──
  const doSubmit = useCallback(async (isAuto: boolean) => {
    if (!attempt || inFlight.current) return;
    inFlight.current = true; setSubmitting(true); setSubmitErr("");
    try {
      // Gửi nốt phần còn trong hàng đợi (chờ tối đa 5 giây); sau hạn máy chủ từ chối cũng không sao — bản đã lưu trước đó vẫn là bài.
      if (!isAuto) await Promise.race([q.flush(), new Promise(r => setTimeout(r, 5000))]);
      const r = await roomApi.submit(attempt.attemptId);
      q.clearStored();
      setResult({ ...r, expired: !!r.expired || auto.current /* tự nộp vì hết giờ thì luôn nói "Hết giờ" */ });
    } catch {
      if (isAuto || auto.current) setTimeUp("unconfirmed"); else setSubmitErr("Nộp bài thất bại, thử lại");
    } finally { inFlight.current = false; setSubmitting(false); }
  }, [attempt, q]);
  useEffect(() => { doSubmitRef.current = doSubmit; });
  const retryTimeUp = () => { setTimeUp("sending"); void doSubmit(true); };
  useEffect(() => { // chưa xác nhận: có mạng lại là gửi lại; ngoài ra cứ 20 giây thử một lần
    if (timeUp !== "unconfirmed") return;
    const go = () => { setTimeUp("sending"); void doSubmitRef.current(true); };
    window.addEventListener("online", go);
    const t = setInterval(go, 20000);
    return () => { window.removeEventListener("online", go); clearInterval(t); };
  }, [timeUp]);

  // ── rời tab: chỉ ĐẾM (không quay màn hình, không chặn, không tự nộp) ──
  useEffect(() => {
    if (!running || !attempt) return;
    const id = attempt.attemptId;
    const onHide = () => { if (document.visibilityState === "hidden") roomApi.tabEvent(id).then(r => { if (typeof r.tabSwitchCount === "number") setTabLeaves(r.tabSwitchCount); }).catch(() => {}); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [running, attempt]);

  return {
    attempt, start, starting, startErr, setStartErr, questions, selected, text, cluster, flags, tabLeaves, remainingSec,
    sectionIndex, sectionWindows: windows, chip: q.chip, textStatus: q.textStatus, retrySave: () => { void q.flush(); },
    selectOption, setBool, typeText, blurText, toggleFlag, isAnswered, flush: q.flush,
    submit: () => doSubmit(false), submitting, submitErr, timeUp, timeUpAt, retryTimeUp, result, nowLabel, isLastSection,
  };
}
export type RoomSession = ReturnType<typeof useRoomSession>;
