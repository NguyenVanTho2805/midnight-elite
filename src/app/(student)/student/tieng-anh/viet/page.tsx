// Writing Lab: gõ bài như thi máy (đếm từ, bấm giờ) → AI góp ý theo 4 tiêu chí IELTS + KHOẢNG band → bắt buộc sửa 1 việc ưu tiên → viết lại.
// AI dùng để sửa bài, không thay giám khảo: điểm luôn là khoảng, và lệch được ±0.5–1 band so với người chấm.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, PageHead, Pill, Skeleton } from "@/components/english/ui";
import { countWords } from "@/lib/english/text";
import { nowMs } from "@/components/english/clock";

interface Feedback {
  criteria: { key: "TR" | "CC" | "LR" | "GRA"; band: number; commentVi: string }[];
  bandLow: number; bandHigh: number;
  issues: { quote: string; criterion: string; problemVi: string; fix: string }[];
  priorityVi: string; strengthsVi: string[];
}
interface Writing { id: string; taskType: string; prompt: string; body: string; wordCount: number; feedback: Feedback | null; bandLow: number | null; bandHigh: number | null; revisionOfId: string | null; createdAt: string }

const TASKS = { task2: { label: "Task 2 (bài luận)", min: 250, minutes: 40 }, task1: { label: "Task 1 (mô tả biểu đồ)", min: 150, minutes: 20 }, paragraph: { label: "Một đoạn văn (luyện)", min: 80, minutes: 15 } } as const;
const CRIT: Record<string, string> = { TR: "Trả lời đề (TR/TA)", CC: "Mạch lạc & liên kết (CC)", LR: "Từ vựng (LR)", GRA: "Ngữ pháp (GRA)" };

function Marked({ body, quotes }: { body: string; quotes: string[] }) {
  // tô các đoạn bị góp ý ngay trong bài
  const parts: { text: string; hit: boolean }[] = [];
  let rest = body;
  const qs = quotes.filter(q => q && q.length >= 4);
  while (rest) {
    let best = -1, bestQ = "";
    for (const q of qs) { const i = rest.indexOf(q); if (i >= 0 && (best < 0 || i < best)) { best = i; bestQ = q; } }
    if (best < 0) { parts.push({ text: rest, hit: false }); break; }
    if (best > 0) parts.push({ text: rest.slice(0, best), hit: false });
    parts.push({ text: bestQ, hit: true });
    rest = rest.slice(best + bestQ.length);
  }
  return <p className="whitespace-pre-line leading-7" style={{ color: INK.chinh }}>{parts.map((p, i) => p.hit ? <mark key={i} className="rounded px-0.5" style={{ background: "var(--kin-nen-nhan)", color: INK.chinh }}>{p.text}</mark> : <span key={i}>{p.text}</span>)}</p>;
}

export default function WritingLab() {
  const [list, setList] = useState<Writing[] | null>(null);
  const [view, setView] = useState<Writing | null>(null);
  const [task, setTask] = useState<keyof typeof TASKS>("task2");
  const [prompt, setPrompt] = useState("");
  const [body, setBody] = useState("");
  const [revOf, setRevOf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => { api<{ items: Writing[] }>("/api/english/writing").then(d => setList(d.items)).catch(e => setErr(e.message)); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (!started) return; const t = setInterval(() => setNow(nowMs()), 1000); return () => clearInterval(t); }, [started]);

  const wc = countWords(body);
  const elapsed = started && now ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const limit = TASKS[task].minutes * 60;

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const w = await api<Writing>("/api/english/writing", { body: { taskType: task, prompt, body, revisionOfId: revOf, seconds: started ? Math.round((nowMs() - started) / 1000) : 0 } });
      setView(w); setStarted(null); load();
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const revise = (w: Writing) => { setTask(w.taskType as keyof typeof TASKS); setPrompt(w.prompt); setBody(w.body); setRevOf(w.id); setView(null); setStarted(nowMs()); };

  return (
    <div className="space-y-4" ref={topRef}>
      <PageHead title="Viết" sub="Gõ bài như thi trên máy. AI góp ý theo 4 tiêu chí IELTS và cho KHOẢNG band — dùng để sửa bài, không phải điểm chính thức." />
      {err && <ErrorLine message={err} />}

      {view?.feedback ? (
        <Card aria-labelledby="h-gy">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 id="h-gy" className="font-bold" style={{ color: INK.chinh }}>Góp ý cho bài của bạn</h2>
              <p className="text-sm" style={{ color: INK.phu }}>{TASKS[view.taskType as keyof typeof TASKS]?.label} · {view.wordCount} từ</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: INK.phu }}>Band ước lượng</p>
              <p className="text-3xl font-bold" style={{ color: INK.chinh }}>{view.feedback.bandLow}{view.feedback.bandHigh !== view.feedback.bandLow ? `–${view.feedback.bandHigh}` : ""}</p>
            </div>
          </div>
          <div className="mt-3 rounded-[var(--kin-bo-md)] p-3" style={{ background: "var(--kin-nen-nhan)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--kin-th-navy)" }}>Việc ưu tiên cho bài sau</p>
            <p style={{ color: INK.chinh }}>{view.feedback.priorityVi}</p>
          </div>
          <dl className="grid sm:grid-cols-2 gap-2 mt-3">
            {view.feedback.criteria.map(c => (
              <div key={c.key} className="rounded-[var(--kin-bo-md)] p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
                <dt className="text-sm font-semibold flex justify-between" style={{ color: INK.chinh }}><span>{CRIT[c.key]}</span><span>{c.band}</span></dt>
                <dd className="text-sm mt-1" style={{ color: INK.phu }}>{c.commentVi}</dd>
              </div>
            ))}
          </dl>
          {!!view.feedback.strengthsVi?.length && <p className="text-sm mt-3" style={{ color: "var(--kin-tt-chu-xong)" }}>Điểm mạnh: {view.feedback.strengthsVi.join(" · ")}</p>}
          <h3 className="font-semibold mt-4 mb-2" style={{ color: INK.chinh }}>Chỗ cần sửa</h3>
          <ol className="space-y-2">
            {view.feedback.issues.map((it, i) => (
              <li key={i} className="text-sm rounded-[var(--kin-bo-md)] p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
                <p><Pill>{it.criterion}</Pill> <span className="italic" style={{ color: INK.chinh }}>“{it.quote}”</span></p>
                <p className="mt-1" style={{ color: INK.phu }}>{it.problemVi}</p>
                <p className="mt-1" style={{ color: "var(--kin-tt-chu-xong)" }}>→ {it.fix}</p>
              </li>
            ))}
          </ol>
          <h3 className="font-semibold mt-4 mb-2" style={{ color: INK.chinh }}>Bài của bạn (đoạn bị góp ý được tô)</h3>
          <Marked body={view.body} quotes={view.feedback.issues.map(x => x.quote)} />
          <div className="mt-4 flex gap-2 flex-wrap">
            <KinButton onClick={() => revise(view)}>Viết lại bài này</KinButton>
            <KinButton variant="secondary" onClick={() => setView(null)}>Viết bài mới</KinButton>
          </div>
        </Card>
      ) : (
        <Card>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); void submit(); }}>
            <div className="flex gap-2 flex-wrap items-end">
              <label className="text-sm" style={{ color: INK.chinh }}>Loại bài
                <select value={task} onChange={e => setTask(e.target.value as keyof typeof TASKS)} className="ml-2 min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }}>
                  {Object.entries(TASKS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              {revOf && <Pill tone="nhan">Đang viết lại</Pill>}
            </div>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Dán đề bài (vd: Some people think that… To what extent do you agree or disagree?)" aria-label="Đề bài"
              className="w-full px-3 py-2 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            <textarea value={body} onChange={e => { setBody(e.target.value); if (!started) setStarted(nowMs()); }} rows={14} placeholder="Gõ bài làm ở đây…" aria-label="Bài làm" spellCheck={false}
              className="w-full px-3 py-2 rounded-[var(--kin-bo-md)] border leading-7" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            <div className="flex items-center justify-between gap-2 flex-wrap text-sm" style={{ color: INK.phu }}>
              <span style={{ color: wc < TASKS[task].min ? "var(--kin-tt-chu-cho)" : INK.phu }}>{wc} từ (tối thiểu {TASKS[task].min})</span>
              {started && <span style={{ color: elapsed > limit ? "var(--kin-tt-chu-loi)" : INK.phu }}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} / {TASKS[task].minutes}:00</span>}
            </div>
            <KinButton type="submit" loading={busy} loadingLabel="AI đang chấm (≈20 giây)…" disabled={wc < 40 || prompt.trim().length < 10}>Nhận góp ý</KinButton>
          </form>
        </Card>
      )}

      <Card aria-labelledby="h-ls">
        <h2 id="h-ls" className="font-bold mb-2" style={{ color: INK.chinh }}>Bài đã viết</h2>
        {!list ? <Skeleton rows={2} /> : list.length === 0 ? <p className="text-sm" style={{ color: INK.phu }}>Chưa có bài nào.</p> : (
          <ul className="space-y-2">
            {list.map(w => (
              <li key={w.id}>
                <button type="button" onClick={() => { setView(w); topRef.current?.scrollIntoView({ behavior: "smooth" }); }} className="w-full text-left rounded-[var(--kin-bo-md)] px-3 py-2 min-h-11 flex items-center justify-between gap-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
                  <span className="text-sm truncate" style={{ color: INK.chinh }}>{new Date(w.createdAt).toLocaleDateString("vi-VN")} · {w.revisionOfId ? "Bản viết lại · " : ""}{w.prompt.slice(0, 70)}</span>
                  <span className="text-sm font-semibold flex-shrink-0" style={{ color: INK.chinh }}>{w.bandLow != null ? `${w.bandLow}–${w.bandHigh}` : "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
