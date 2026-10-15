// Đọc bài: từ chưa biết được gạch chân; chạm vào từ → nghĩa tiếng Việt ĐÚNG trong câu → "Học từ này" thành thẻ ôn kèm câu gốc.
// Cuối bài: câu hỏi đọc hiểu kiểu IELTS + "Đọc xong" (đánh dấu từ không bấm là đã biết — có hỏi lại).
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, LEVEL_TEXT, PageHead, Pill, Skeleton } from "@/components/english/ui";
import QuestionList, { type QItem } from "@/components/english/QuestionList";
import { speak, stopSpeaking } from "@/components/english/speech";
import { nowMs, secondsSince } from "@/components/english/clock";

type Tok = [string, string, 0 | 1, number];
interface TextData {
  id: string; title: string; source: string; sourceUrl: string | null; audioUrl: string | null; wordCount: number; mine: boolean;
  sentences: string[]; paraOf: number[]; tokens: Tok[]; status: Record<string, string>; worth: Record<string, boolean>;
  coverage: number; level: "nhe" | "hoc" | "kho"; unknownCount: number; exercises: QItem[];
}
interface Lookup { lemma: string; meaningVi: string | null; note: string | null; dict: { meaningVi: string | null; pos: string | null } | null; list: string | null; freqRank: number | null; aiError?: boolean }

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<TextData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<{ word: string; lemma: string; sentence: number } | null>(null);
  const [look, setLook] = useState<Lookup | null>(null);
  const [lookErr, setLookErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clicked, setClicked] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState<number | null>(null);
  const [finish, setFinish] = useState<"idle" | "ask" | "done">("idle");
  const [genBusy, setGenBusy] = useState(false);
  const startedAt = useRef(0);
  const stopRef = useRef(false);

  const load = useCallback(() => { api<TextData>(`/api/english/texts/${id}`).then(d => { setT(d); setErr(null); }).catch(e => setErr(e.message)); }, [id]);
  useEffect(load, [load]);
  useEffect(() => { startedAt.current = nowMs(); return () => stopSpeaking(); }, []);

  const pick = async (word: string, lemma: string, sentence: number) => {
    setSel({ word, lemma, sentence }); setLook(null); setLookErr(null);
    setClicked(c => new Set(c).add(lemma));
    void speak(word);
    try { setLook(await api<Lookup>("/api/english/lookup", { body: { word, sentence: t?.sentences[sentence] ?? word } })); }
    catch (e) { setLookErr((e as Error).message); }
  };

  const save = async (status: "learning" | "known") => {
    if (!sel || !t) return;
    setSaving(true);
    try {
      await api("/api/english/words", { body: { word: sel.lemma, context: t.sentences[sel.sentence], contextVi: look?.meaningVi ?? undefined, textId: t.id, status } });
      setT({ ...t, status: { ...t.status, [sel.lemma]: status } });
      setSel(null);
    } catch (e) { setLookErr((e as Error).message); } finally { setSaving(false); }
  };

  const readAloud = async () => {
    if (!t) return;
    if (reading !== null) { stopRef.current = true; stopSpeaking(); setReading(null); return; }
    stopRef.current = false;
    for (let i = 0; i < t.sentences.length; i++) {
      if (stopRef.current) break;
      setReading(i);
      await speak(t.sentences[i], 0.9);
    }
    setReading(null);
  };

  const genQuestions = async () => {
    setGenBusy(true);
    try { await api(`/api/english/texts/${id}/questions`, { body: {} }); load(); } catch (e) { setErr((e as Error).message); } finally { setGenBusy(false); }
  };

  if (err && !t) return <ErrorLine message={err} onRetry={load} />;
  if (!t) return <Skeleton rows={4} />;

  // từ chưa biết, đáng học, người học không bấm vào → ứng viên "đã biết" khi đọc xong
  const unknownWorth = [...new Set(t.tokens.filter(x => x[1] && !x[2] && !t.status[x[1]] && t.worth[x[1]]).map(x => x[1]))];
  const notClicked = unknownWorth.filter(l => !clicked.has(l));

  const finishReading = async (markKnown: boolean) => {
    try {
      const r = await api<{ marked: number }>(`/api/english/texts/${id}/finish`, { body: { lemmas: markKnown ? notClicked : [], seconds: secondsSince(startedAt.current) } });
      setFinish("done");
      if (markKnown) setT({ ...t, status: { ...t.status, ...Object.fromEntries(notClicked.map(l => [l, "known"])) } });
      void r;
    } catch (e) { setErr((e as Error).message); }
  };

  // dựng đoạn → câu → token
  const paras: { sentence: number; toks: Tok[] }[][] = [];
  const bySentence = new Map<number, Tok[]>();
  for (const tok of t.tokens) { if (!bySentence.has(tok[3])) bySentence.set(tok[3], []); bySentence.get(tok[3])!.push(tok); }
  [...bySentence.keys()].sort((a, b) => a - b).forEach(si => {
    const p = t.paraOf[si] ?? 0;
    (paras[p] ??= []).push({ sentence: si, toks: bySentence.get(si)! });
  });

  const styleOf = (lemma: string, proper: boolean): React.CSSProperties => {
    const st = t.status[lemma];
    if (st === "learning") return { background: "var(--kin-nen-nhan)", borderRadius: 3 };
    if (!st && !proper && t.worth[lemma]) return { textDecoration: "underline dotted", textUnderlineOffset: 4, textDecorationColor: "var(--kin-nhan-link)" };
    return {};
  };

  return (
    <div className="space-y-4">
      <PageHead title={t.title} sub={`${t.wordCount} từ · bạn hiểu ${t.coverage}% từ · ${t.unknownCount} từ chưa gặp`}>
        <Pill tone={LEVEL_TEXT[t.level].tone}>{LEVEL_TEXT[t.level].label}</Pill>
      </PageHead>

      <div className="flex gap-2 flex-wrap items-center">
        {t.audioUrl ? <audio controls preload="none" src={t.audioUrl} className="max-w-full" aria-label="Audio gốc của bài" /> : null}
        <KinButton variant="secondary" onClick={readAloud}>{reading !== null ? "Dừng đọc" : t.audioUrl ? "Giọng máy đọc từng câu" : "Nghe bài (giọng máy)"}</KinButton>
        <Link href={`/student/tieng-anh/nghe/${t.id}`} className="text-sm underline min-h-11 inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>Chép chính tả bài này</Link>
      </div>

      <p className="text-xs" style={{ color: INK.mo }}>Gạch chân chấm = từ chưa biết đáng học · nền xanh nhạt = từ đang học. Chạm vào bất kỳ từ nào để xem nghĩa trong câu.</p>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        <Card as="article" className="leading-8 text-[17px]">
          {paras.map((p, pi) => (
            <p key={pi} className="mb-4" style={{ color: INK.chinh }}>
              {p.map(s => (
                <span key={s.sentence} style={reading === s.sentence ? { background: "var(--kin-nen-dang-chon)" } : undefined}>
                  {s.toks.map((tok, k) => tok[1]
                    ? <button key={k} type="button" onClick={() => pick(tok[0], tok[1], tok[3])} className="inline cursor-pointer hover:opacity-80" style={styleOf(tok[1], tok[2] === 1)}>{tok[0]}</button>
                    : <span key={k}>{tok[0]}</span>)}
                  {" "}
                </span>
              ))}
            </p>
          ))}
          {t.source === "voa" && t.sourceUrl && <p className="text-xs" style={{ color: INK.mo }}>Nguồn: <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">VOA Learning English</a> (public domain).</p>}
        </Card>

        <aside className="lg:sticky lg:top-4 space-y-3" aria-live="polite">
          {sel ? (
            <Card>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xl font-bold" style={{ color: INK.chinh }}>{sel.word}{sel.lemma !== sel.word.toLowerCase() && <span className="text-sm font-normal ml-2" style={{ color: INK.mo }}>({sel.lemma})</span>}</p>
                <button type="button" onClick={() => setSel(null)} aria-label="Đóng" className="min-h-11 min-w-11" style={{ color: INK.mo }}>✕</button>
              </div>
              {!look && !lookErr && <p className="text-sm mt-2" style={{ color: INK.mo }}>Đang tra nghĩa trong câu…</p>}
              {lookErr && <p className="text-sm mt-2" style={{ color: "var(--kin-tt-chu-loi)" }}>{lookErr}</p>}
              {look && (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-base font-semibold" style={{ color: INK.chinh }}>{look.meaningVi ?? look.dict?.meaningVi ?? "Chưa tra được nghĩa"}</p>
                  {look.note && <p style={{ color: INK.phu }}>{look.note}</p>}
                  {look.dict?.meaningVi && look.dict.meaningVi !== look.meaningVi && <p style={{ color: INK.phu }}>Nghĩa thường gặp: {look.dict.meaningVi}</p>}
                  <p className="text-xs" style={{ color: INK.mo }}>{look.list === "nawl" ? "Từ học thuật (NAWL)" : look.list ? "Từ thông dụng (NGSL)" : look.freqRank && look.freqRank <= 5000 ? `Khá phổ biến (hạng ${look.freqRank})` : "Từ hiếm — có thể bỏ qua"}</p>
                </div>
              )}
              <div className="mt-3 flex gap-2 flex-wrap">
                <KinButton onClick={() => save("learning")} loading={saving} disabled={t.status[sel.lemma] === "learning"}>{t.status[sel.lemma] === "learning" ? "Đang học" : "Học từ này"}</KinButton>
                <KinButton variant="secondary" onClick={() => save("known")} disabled={saving || t.status[sel.lemma] === "known"}>Đã biết</KinButton>
                <KinButton variant="ghost" onClick={() => speak(t.sentences[sel.sentence], 0.85)}>Nghe câu</KinButton>
              </div>
            </Card>
          ) : (
            <Card><p className="text-sm" style={{ color: INK.phu }}>Chạm vào một từ để xem nghĩa. Từ bạn bấm “Học từ này” sẽ thành thẻ ôn kèm đúng câu này.</p></Card>
          )}
        </aside>
      </div>

      <Card aria-labelledby="h-cauhoi">
        <h2 id="h-cauhoi" className="font-bold mb-3" style={{ color: INK.chinh }}>Câu hỏi đọc hiểu</h2>
        {t.exercises.length ? <QuestionList items={t.exercises} canFlag={t.mine} /> : (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm" style={{ color: INK.phu }}>Bài này chưa có câu hỏi.</p>
            <KinButton variant="secondary" onClick={genQuestions} loading={genBusy} loadingLabel="Đang soạn (≈10 giây)…">Soạn 5 câu hỏi kiểu IELTS</KinButton>
          </div>
        )}
      </Card>

      <Card>
        {finish === "done" ? (
          <p className="text-sm" style={{ color: "var(--kin-tt-chu-xong)" }}>Đã ghi nhận bài đọc. Độ phủ của các bài sau sẽ được tính lại theo vốn từ mới của bạn.</p>
        ) : finish === "ask" ? (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: INK.chinh }}>Còn {notClicked.length} từ gạch chân bạn không bấm vào. Bạn đã hiểu hết các từ đó?</p>
            <p className="text-xs" style={{ color: INK.mo }}>{notClicked.slice(0, 20).join(", ")}{notClicked.length > 20 ? "…" : ""}</p>
            <div className="flex gap-2 flex-wrap">
              <KinButton onClick={() => finishReading(true)}>Đúng, đánh dấu đã biết</KinButton>
              <KinButton variant="secondary" onClick={() => finishReading(false)}>Không, chỉ ghi nhận đã đọc</KinButton>
            </div>
          </div>
        ) : (
          <KinButton onClick={() => (notClicked.length ? setFinish("ask") : finishReading(false))}>Đọc xong</KinButton>
        )}
      </Card>
    </div>
  );
}
