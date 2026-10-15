// Chép chính tả từng câu (giọng máy đọc, chỉnh tốc độ, nghe lại không giới hạn) + nói theo (shadowing) có thu âm để tự nghe lại.
// Chấm ngay ở trình duyệt (lib/english/dictation): từ đúng / gõ sai chính tả / bỏ sót / thừa.
// Mỗi câu là một component riêng (key = số câu) để ô gõ, kết quả, bản thu tự về đầu khi sang câu mới.
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, PageHead, Progress, Skeleton } from "@/components/english/ui";
import { canSpeak, speak, stopSpeaking } from "@/components/english/speech";
import { nowMs, secondsSince } from "@/components/english/clock";
import { checkDictation, splitWords, type DictationResult } from "@/lib/english/dictation";

interface TextData { id: string; title: string; sentences: string[]; audioUrl: string | null }
const SPEEDS = [0.7, 0.85, 1] as const;

function SentenceView({ textId, sentence, speed, isLast, onDone, onError }: {
  textId: string; sentence: string; speed: number; isLast: boolean;
  onDone: (r: DictationResult) => void; onError: (m: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [res, setRes] = useState<DictationResult | null>(null);
  const [hint, setHint] = useState(false);
  const [played, setPlayed] = useState(false);
  const [rec, setRec] = useState<{ state: "idle" | "rec"; url: string | null }>({ state: "idle", url: null });
  const recorder = useRef<MediaRecorder | null>(null);
  const shownAt = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const play = useCallback(async (rate: number) => { setPlayed(true); await speak(sentence, rate); inputRef.current?.focus(); }, [sentence]);

  useEffect(() => {
    shownAt.current = nowMs();
    const tm = setTimeout(() => { void speak(sentence, speed).then(() => inputRef.current?.focus()); }, 300);
    return () => clearTimeout(tm);
  }, [sentence]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (rec.url) URL.revokeObjectURL(rec.url); }, [rec.url]);

  const check = async () => {
    if (!typed.trim()) return;
    const r = checkDictation(sentence, typed);
    setRes(r);
    try { await api("/api/english/dictation", { body: { textId, correct: r.correct, total: r.total, seconds: secondsSince(shownAt.current) } }); } catch { /* ghi log lỗi không chặn việc học */ }
  };

  const toggleRec = async () => {
    if (rec.state === "rec") { recorder.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const parts: Blob[] = [];
      mr.ondataavailable = e => parts.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach(tr => tr.stop()); setRec({ state: "idle", url: URL.createObjectURL(new Blob(parts, { type: mr.mimeType })) }); };
      recorder.current = mr; mr.start(); setRec(r => ({ ...r, state: "rec" }));
    } catch { onError("Không mở được micro. Kiểm tra quyền micro của trình duyệt."); }
  };

  const masked = splitWords(sentence).map(w => w[0] + w.slice(1).replace(/[A-Za-z]/g, "_")).join(" ");

  return (
    <Card>
      <div className="flex gap-2 flex-wrap items-center">
        <KinButton onClick={() => play(speed)}>{played ? "Nghe lại" : "Nghe"}</KinButton>
        <KinButton variant="secondary" onClick={() => play(0.6)}>Nghe thật chậm</KinButton>
        {!res && <button type="button" onClick={() => setHint(h => !h)} className="text-sm underline min-h-11" style={{ color: "var(--kin-nhan-link)" }}>{hint ? "Ẩn gợi ý" : "Gợi ý chữ cái đầu"}</button>}
      </div>
      {hint && !res && <p className="mt-3 font-mono tracking-wide" style={{ color: INK.phu }}>{masked}</p>}

      <form className="mt-3" onSubmit={e => { e.preventDefault(); void check(); }}>
        <textarea ref={inputRef} value={typed} onChange={e => setTyped(e.target.value)} disabled={!!res} rows={2} aria-label="Gõ câu bạn nghe được" spellCheck={false} autoCapitalize="off"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void check(); } }}
          className="w-full px-3 py-2 rounded-[var(--kin-bo-md)] border text-lg" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
        {!res && <KinButton type="submit" disabled={!typed.trim()}>Kiểm tra (Enter)</KinButton>}
      </form>

      {res && (
        <div className="mt-3 space-y-3">
          <p className="text-lg leading-9" aria-label="Kết quả từng từ">
            {res.words.map((w, k) => (
              <span key={k} className="mr-1.5">
                {w.status === "ok" && <span style={{ color: "var(--kin-tt-chu-xong)" }}>{w.text}</span>}
                {w.status === "wrong" && <><s style={{ color: "var(--kin-tt-chu-loi)" }}>{w.typed}</s> <strong style={{ color: INK.chinh }}>{w.text}</strong></>}
                {w.status === "missing" && <strong className="px-1 rounded" style={{ color: INK.chinh, background: "var(--kin-nen-nhan)" }}>[{w.text}]</strong>}
              </span>
            ))}
          </p>
          <p className="text-sm" style={{ color: INK.phu }}>
            Đúng {res.correct}/{res.total} từ · <span style={{ color: "var(--kin-tt-chu-loi)" }}>gạch ngang</span> = gõ sai, [ngoặc] = bỏ sót{res.extra.length ? ` · gõ thừa: ${res.extra.join(", ")}` : ""}
          </p>
          <div className="rounded-[var(--kin-bo-md)] p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
            <p className="text-sm font-semibold" style={{ color: INK.chinh }}>Nói theo (shadowing)</p>
            <p className="text-xs mb-2" style={{ color: INK.phu }}>Nghe, rồi nói lại ngay, bắt chước nối âm và ngữ điệu. Lặp 3 lần; thu âm để tự so.</p>
            <div className="flex gap-2 flex-wrap items-center">
              <KinButton variant="secondary" onClick={() => play(speed)}>Nghe mẫu</KinButton>
              <KinButton variant={rec.state === "rec" ? "danger" : "secondary"} onClick={toggleRec}>{rec.state === "rec" ? "Dừng thu" : "Thu giọng tôi"}</KinButton>
              {rec.url && <audio controls src={rec.url} aria-label="Bản thu của bạn" />}
            </div>
          </div>
          <KinButton onClick={() => onDone(res)}>{isLast ? "Xem kết quả" : "Câu tiếp"}</KinButton>
        </div>
      )}
    </Card>
  );
}

export default function Dictation() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<TextData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [speed, setSpeed] = useState<number>(0.85);
  const [total, setTotal] = useState({ correct: 0, words: 0, done: 0 });

  const load = useCallback(() => { api<TextData>(`/api/english/texts/${id}`).then(d => { setT(d); setErr(null); }).catch(e => setErr(e.message)); }, [id]);
  useEffect(load, [load]);
  useEffect(() => () => stopSpeaking(), []);

  if (err && !t) return <ErrorLine message={err} onRetry={load} />;
  if (!t) return <Skeleton rows={3} />;
  if (!canSpeak()) return <ErrorLine message="Trình duyệt này không có giọng đọc. Dùng Chrome hoặc Edge bản mới để luyện chép chính tả." />;

  // Câu quá ngắn (tiêu đề, "Hi.") bỏ qua; câu dài vẫn giữ — nghe lại bao nhiêu lần cũng được.
  const sentences = t.sentences.filter(s => splitWords(s).length >= 3);

  if (i >= sentences.length) {
    const pct = total.words ? Math.round((total.correct / total.words) * 100) : 0;
    return (
      <Card className="text-center py-10">
        <h2 className="text-h3 font-bold" style={{ color: INK.chinh }}>Xong bài!</h2>
        <p className="mt-2" style={{ color: INK.phu }}>{total.done} câu · đúng {pct}% số từ</p>
        <div className="mt-5 flex gap-4 justify-center flex-wrap">
          <Link href={`/student/tieng-anh/doc/${t.id}`} className="underline min-h-11 inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>Đọc lại bài và học từ mới</Link>
          <Link href="/student/tieng-anh/nghe" className="underline min-h-11 inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>Chọn bài khác</Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHead title={`Chép chính tả: ${t.title}`} sub="Nghe → gõ lại đúng những gì nghe được → kiểm tra → nói theo 3 lần.">
        <label className="text-sm flex items-center gap-2" style={{ color: INK.phu }}>Tốc độ
          <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="min-h-11 px-2 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }}>
            {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
          </select>
        </label>
      </PageHead>
      <Progress value={(i / sentences.length) * 100} label={`Câu ${i + 1} / ${sentences.length}`} />
      {err && <ErrorLine message={err} />}
      <SentenceView key={i} textId={t.id} sentence={sentences[i]} speed={speed} isLast={i + 1 >= sentences.length}
        onError={setErr}
        onDone={r => { setTotal(x => ({ correct: x.correct + r.correct, words: x.words + r.total, done: x.done + 1 })); setI(i + 1); }} />
      {t.audioUrl && <p className="text-xs" style={{ color: INK.mo }}>Bài có audio gốc của VOA — nghe cả bài ở trang <Link href={`/student/tieng-anh/doc/${t.id}`} className="underline">Đọc</Link> sau khi chép xong.</p>}
    </div>
  );
}
