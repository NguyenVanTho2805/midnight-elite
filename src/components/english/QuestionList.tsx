// Danh sách câu hỏi (đọc hiểu hoặc bài tập unit): làm từng câu, chấm ở máy chủ, hiện đáp án + giải thích ngay.
"use client";
import { useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, INK, Pill } from "./ui";
import { nowMs, secondsSince } from "./clock";

export interface QItem { id: string; type: string; instruction: string | null; prompt: string; options: string[]; origin?: string; verified?: boolean; lastCorrect: boolean | null }
interface Result { correct: boolean; answers: string[]; explanation: string | null; unitScore: number | null }

export default function QuestionList({ items, onScore, canFlag }: { items: QItem[]; onScore?: (score: number) => void; canFlag?: boolean }) {
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = nowMs(); }, []);

  const submit = async (q: QItem, answer: string) => {
    if (!answer.trim() || busy) return;
    setBusy(q.id); setErr(null);
    try {
      const r = await api<Result>(`/api/english/exercises/${q.id}/answer`, { body: { answer, seconds: secondsSince(shownAt.current) } });
      shownAt.current = nowMs();
      setResults(x => ({ ...x, [q.id]: r }));
      if (r.unitScore !== null && onScore) onScore(r.unitScore);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const flag = async (q: QItem) => {
    try { await api(`/api/english/exercises/${q.id}/flag`, { body: {} }); setHidden(h => new Set(h).add(q.id)); } catch (e) { setErr((e as Error).message); }
  };

  const visible = items.filter(q => !hidden.has(q.id));
  return (
    <ol className="space-y-3">
      {err && <li><p role="alert" className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>{err}</p></li>}
      {visible.map((q, i) => {
        const r = results[q.id];
        return (
          <li key={q.id} className="rounded-[var(--kin-bo-md)] p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold" style={{ color: INK.mo }}>Câu {i + 1}</span>
              {q.origin === "ai" && <Pill>AI soạn{q.verified ? " · đã kiểm" : ""}</Pill>}
              {q.lastCorrect !== null && !r && <Pill tone={q.lastCorrect ? "xong" : "loi"}>{q.lastCorrect ? "Lần trước đúng" : "Lần trước sai"}</Pill>}
            </div>
            {q.instruction && <p className="text-xs mb-1" style={{ color: INK.phu }}>{q.instruction}</p>}
            <p className="whitespace-pre-line" style={{ color: INK.chinh }}>{q.prompt}</p>
            {!r ? (
              q.options.length ? (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {q.options.map(o => <KinButton key={o} variant="secondary" disabled={busy === q.id} onClick={() => submit(q, o)}>{o}</KinButton>)}
                </div>
              ) : (
                <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); void submit(q, typed[q.id] ?? ""); }}>
                  <input value={typed[q.id] ?? ""} onChange={e => setTyped(t => ({ ...t, [q.id]: e.target.value }))} aria-label={`Trả lời câu ${i + 1}`} autoComplete="off" spellCheck={false}
                    className="flex-1 min-w-0 min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
                  <KinButton type="submit" variant="secondary" loading={busy === q.id}>Kiểm tra</KinButton>
                </form>
              )
            ) : (
              <div className="mt-2 text-sm space-y-1">
                <p className="font-semibold" style={{ color: r.correct ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>{r.correct ? "Đúng" : "Chưa đúng"} — đáp án: {r.answers.join(" · ")}</p>
                {r.explanation && <p style={{ color: INK.phu }}>{r.explanation}</p>}
                {!r.correct && <p className="text-xs" style={{ color: INK.mo }}>Câu này đã vào Sổ lỗi, sẽ quay lại trong phần ôn.</p>}
              </div>
            )}
            {canFlag && <button type="button" onClick={() => flag(q)} className="text-xs underline mt-1 min-h-11" style={{ color: INK.mo }}>Báo câu sai</button>}
          </li>
        );
      })}
    </ol>
  );
}
