// Phiên ôn thẻ FSRS. Thẻ nhận diện: thấy từ → nhớ nghĩa. Thẻ nhớ chủ động: thấy nghĩa → gõ từ. Thẻ "làm lại": câu ngữ pháp từng làm sai.
// Luôn bắt nhớ TRƯỚC khi lật (hiệu ứng luyện truy xuất). Phím: Space lật, 1–4 chấm mức nhớ.
// Mỗi thẻ là một component riêng (key = id thẻ) để trạng thái lật / ô gõ tự về đầu khi sang thẻ mới.
"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, LinkButton, PageHead, Pill, Skeleton } from "@/components/english/ui";
import { speak } from "@/components/english/speech";
import { nowMs } from "@/components/english/clock";

interface ReviewCard {
  id: string; kind: "word" | "exercise"; cardType: string; isNew: boolean;
  word: { lemma: string; pos: string | null; ipa: string | null; meaningVi: string | null; definitionEn: string | null; example: string | null; context: string | null; contextVi: string | null } | null;
  exercise: { type: string; instruction: string | null; prompt: string; options: string[] } | null;
  preview: Record<"1" | "2" | "3" | "4", string>;
}
const RATINGS = [
  { v: 1, label: "Quên" }, { v: 2, label: "Khó" }, { v: 3, label: "Nhớ" }, { v: 4, label: "Dễ" },
] as const;
const QUICK_MS = 10 * 60_000;

function Highlight({ text, word }: { text: string; word: string }) {
  const re = new RegExp(`\\b(${word.replace(/[^a-z'-]/gi, "")}\\w*)`, "i");
  const m = text.match(re);
  if (!m || m.index === undefined) return <>{text}</>;
  return <>{text.slice(0, m.index)}<mark className="px-0.5 rounded" style={{ background: "var(--kin-nen-nhan)", color: INK.chinh }}>{m[0]}</mark>{text.slice(m.index + m[0].length)}</>;
}

/** Một thẻ từ: nhận diện hoặc nhớ chủ động. */
function WordCard({ card, busy, onRate }: { card: ReviewCard; busy: boolean; onRate: (rating: number, durationMs: number) => void }) {
  const w = card.word!;
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const shownAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    shownAt.current = nowMs();
    if (card.cardType === "recognize") void speak(w.lemma);
    inputRef.current?.focus();
  }, [card.cardType, w.lemma]);

  const rate = useCallback((r: number) => onRate(r, nowMs() - shownAt.current), [onRate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === " " && !revealed) { e.preventDefault(); setRevealed(true); }
      else if (revealed && !busy && ["1", "2", "3", "4"].includes(e.key)) rate(Number(e.key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, busy, rate]);

  const right = typed.trim().toLowerCase() === w.lemma;
  return (
    <Card className="min-h-[300px] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        {card.isNew && <Pill tone="nhan">Từ mới</Pill>}
        <Pill>{card.cardType === "recall" ? "Nhớ chủ động" : "Nhận diện"}</Pill>
      </div>

      {card.cardType === "recall" ? (
        <div className="flex-1">
          <p className="text-sm" style={{ color: INK.phu }}>Từ tiếng Anh nào có nghĩa:</p>
          <p className="text-2xl font-bold mt-1" style={{ color: INK.chinh }}>{w.meaningVi ?? w.definitionEn ?? "…"}</p>
          {w.contextVi && <p className="text-sm mt-1" style={{ color: INK.phu }}>({w.contextVi})</p>}
          <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); setRevealed(true); }}>
            <input ref={inputRef} value={typed} onChange={e => setTyped(e.target.value)} disabled={revealed} aria-label="Gõ từ tiếng Anh" autoComplete="off" autoCapitalize="off" spellCheck={false}
              className="flex-1 min-w-0 min-h-11 px-3 rounded-[var(--kin-bo-md)] border text-lg" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            {!revealed && <KinButton type="submit">Kiểm tra</KinButton>}
          </form>
          {revealed && (
            <p className="mt-3 text-lg" style={{ color: right ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>
              {right ? "Đúng: " : "Đáp án: "}<strong>{w.lemma}</strong>
              <button type="button" onClick={() => speak(w.lemma)} className="ml-2 underline text-sm min-h-11" style={{ color: "var(--kin-nhan-link)" }}>nghe</button>
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1">
          <p className="text-3xl font-bold" style={{ color: INK.chinh }}>{w.lemma}
            <button type="button" onClick={() => speak(w.lemma)} className="ml-3 align-middle text-sm font-normal underline min-h-11" style={{ color: "var(--kin-nhan-link)" }}>nghe</button>
          </p>
          {w.context && <p className="mt-3" style={{ color: INK.phu }}><Highlight text={w.context} word={w.lemma} /></p>}
          {!revealed && <p className="mt-6 text-sm" style={{ color: INK.mo }}>Nhớ nghĩa trong đầu trước, rồi mới lật thẻ.</p>}
        </div>
      )}

      {revealed && (
        <div className="mt-4 pt-4 border-t space-y-1" style={{ borderColor: "var(--kin-vien-nhat)" }}>
          {card.cardType !== "recall" && <p className="text-xl font-bold" style={{ color: INK.chinh }}>{w.meaningVi ?? "Chưa có nghĩa — xem định nghĩa bên dưới"}</p>}
          {w.contextVi && card.cardType !== "recall" && <p className="text-sm" style={{ color: INK.phu }}>Trong câu bạn gặp: {w.contextVi}</p>}
          {w.pos && <p className="text-sm" style={{ color: INK.phu }}>Từ loại: {w.pos}</p>}
          {w.definitionEn && <p className="text-sm" style={{ color: INK.phu }}>{w.definitionEn}</p>}
          {w.example && <p className="text-sm italic" style={{ color: INK.chinh }}>{w.example}
            <button type="button" onClick={() => speak(w.example!)} className="ml-2 not-italic underline min-h-11" style={{ color: "var(--kin-nhan-link)" }}>nghe câu</button></p>}
        </div>
      )}

      <div className="mt-5">
        {!revealed ? (
          card.cardType !== "recall" && <KinButton block onClick={() => setRevealed(true)}>Lật thẻ (Space)</KinButton>
        ) : (
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Bạn nhớ từ này thế nào?">
            {RATINGS.map(r => (
              <KinButton key={r.v} variant={r.v === 1 ? "danger" : r.v === 3 ? "primary" : "secondary"} disabled={busy} onClick={() => rate(r.v)}>
                <span className="flex flex-col leading-tight"><span>{r.label}</span><span className="text-xs opacity-80">{card.preview[String(r.v) as "1"]}</span></span>
              </KinButton>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Một câu ngữ pháp từng làm sai: làm lại, máy chủ chấm, đúng → Nhớ, sai → Quên. */
function ExerciseCard({ card, onDone }: { card: ReviewCard; onDone: (correct: boolean) => void }) {
  const ex = card.exercise!;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; answers: string[]; explanation: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = nowMs(); }, []);

  const submit = async (answer: string) => {
    if (busy || !answer.trim()) return;
    setBusy(true);
    try { setResult(await api("/api/english/review", { body: { cardId: card.id, answer, durationMs: nowMs() - shownAt.current } })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Card className="min-h-[260px]">
      <Pill>Làm lại câu từng sai</Pill>
      {ex.instruction && <p className="text-sm mt-3" style={{ color: INK.phu }}>{ex.instruction}</p>}
      <p className="text-lg mt-1 whitespace-pre-line" style={{ color: INK.chinh }}>{ex.prompt}</p>
      {err && <p role="alert" className="text-sm mt-2" style={{ color: "var(--kin-tt-chu-loi)" }}>{err}</p>}
      {!result ? (
        ex.options.length ? (
          <div className="mt-4 grid gap-2">
            {ex.options.map(o => <KinButton key={o} variant="secondary" disabled={busy} onClick={() => submit(o)}>{o}</KinButton>)}
          </div>
        ) : (
          <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); void submit(typed); }}>
            <input value={typed} onChange={e => setTyped(e.target.value)} aria-label="Câu trả lời" autoComplete="off" spellCheck={false} autoFocus
              className="flex-1 min-w-0 min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            <KinButton type="submit" loading={busy}>Kiểm tra</KinButton>
          </form>
        )
      ) : (
        <div className="mt-4 space-y-2">
          <p className="font-bold" style={{ color: result.correct ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>{result.correct ? "Đúng rồi!" : "Chưa đúng."} Đáp án: {result.answers.join(" · ")}</p>
          {result.explanation && <p className="text-sm" style={{ color: INK.phu }}>{result.explanation}</p>}
          <KinButton onClick={() => onDone(result.correct)}>Câu tiếp</KinButton>
        </div>
      )}
    </Card>
  );
}

function ReviewSession() {
  const quick = useSearchParams().get("nhanh") === "1";
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const [due, setDue] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState({ n: 0, good: 0 });
  const [timeUp, setTimeUp] = useState(false);

  const load = useCallback(() => {
    api<{ due: number; cards: ReviewCard[] }>("/api/english/review")
      .then(d => { setQueue(quick ? d.cards.filter(c => !c.isNew) : d.cards); setDue(d.due); setErr(null); })
      .catch(e => setErr(e.message));
  }, [quick]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!quick) return;
    const t = setTimeout(() => setTimeUp(true), QUICK_MS);
    return () => clearTimeout(t);
  }, [quick]);

  const advance = useCallback(() => setQueue(q => {
    const rest = (q ?? []).slice(1);
    if (rest.length === 0) setTimeout(load, 0); // thẻ "Quên" quay lại sau ~1 phút — tải lại hàng đợi
    return rest;
  }), [load]);

  const card = queue?.[0] ?? null;

  const rate = useCallback(async (rating: number, durationMs: number) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await api("/api/english/review", { body: { cardId: card.id, rating, durationMs } });
      setDone(d => ({ n: d.n + 1, good: d.good + (rating >= 3 ? 1 : 0) }));
      advance();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [card, busy, advance]);

  if (err && !queue) return <ErrorLine message={err} onRetry={load} />;
  if (!queue) return <Skeleton rows={2} />;

  if (!card || timeUp) {
    return (
      <Card className="text-center py-10">
        <h2 className="text-h3 font-bold" style={{ color: INK.chinh }}>{done.n ? "Xong phiên ôn!" : "Hiện không có thẻ nào đến hạn"}</h2>
        {done.n > 0 && <p className="mt-2" style={{ color: INK.phu }}>{done.n} thẻ · nhớ {done.good}/{done.n}</p>}
        <p className="mt-1 text-sm" style={{ color: INK.phu }}>{timeUp ? "Đủ 10 phút rồi — hôm nay vẫn tính là ngày có học." : "Thẻ tiếp theo sẽ đến hạn theo lịch nhớ của bạn."}</p>
        <div className="mt-5 flex gap-2 justify-center flex-wrap">
          <LinkButton href="/student/tieng-anh">Về Hôm nay</LinkButton>
          <LinkButton href="/student/tieng-anh/doc" variant="secondary">Đọc một bài</LinkButton>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm" style={{ color: INK.phu }}>
        <span>Còn {Math.max(due - done.n, queue.length)} thẻ{quick ? " · chế độ 10 phút" : ""}</span>
        <span>Đã ôn {done.n}</span>
      </div>
      {err && <ErrorLine message={err} />}
      {card.kind === "word" && card.word && <WordCard key={card.id} card={card} busy={busy} onRate={rate} />}
      {card.kind === "exercise" && card.exercise && (
        <ExerciseCard key={card.id} card={card} onDone={correct => { setDone(d => ({ n: d.n + 1, good: d.good + (correct ? 1 : 0) })); advance(); }} />
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <>
      <PageHead title="Ôn từ" sub="Thẻ đến hạn theo lịch nhớ FSRS — nhớ trước rồi mới lật." />
      <Suspense fallback={<Skeleton rows={2} />}><ReviewSession /></Suspense>
    </>
  );
}
