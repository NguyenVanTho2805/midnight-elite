// Bài kiểm tra xếp lớp từ vựng (~5 phút): bấm "Biết"/"Chưa biết" cho 106 từ, trong đó có 10 từ giả để trừ phần khai quá tay.
"use client";
import { useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, LinkButton, PageHead, Progress, Skeleton } from "@/components/english/ui";

interface Result { bands: { key: string; label: string; asked: number; yes: number; adjusted: number; mastered: boolean }[]; falseAlarm: number; estimatedKnown: number; markedKnown: number; gaps: number }

export default function Placement() {
  const [items, setItems] = useState<{ lemma: string }[] | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<{ lemma: string; known: boolean }[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { api<{ items: { lemma: string }[] }>("/api/english/placement").then(d => setItems(d.items)).catch(e => setErr(e.message)); }, []);

  const answer = (known: boolean) => {
    if (!items) return;
    const next = [...answers, { lemma: items[i].lemma, known }];
    setAnswers(next);
    if (i + 1 < items.length) setI(i + 1);
    else void submit(next);
  };
  const submit = async (all: { lemma: string; known: boolean }[]) => {
    setSending(true);
    try { setResult(await api<Result>("/api/english/placement", { body: { answers: all } })); }
    catch (e) { setErr((e as Error).message); } finally { setSending(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result || sending || !items) return;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "b") answer(true);
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "c") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (err) return <ErrorLine message={err} />;
  if (!items) return <Skeleton rows={2} />;

  if (result) {
    return (
      <div className="space-y-4">
        <PageHead title="Kết quả kiểm tra từ vựng" sub={`Ước tính bạn biết khoảng ${result.estimatedKnown.toLocaleString("vi-VN")} / 3.760 từ của NGSL + NAWL.`} />
        <Card>
          <ul className="space-y-3">
            {result.bands.map(b => (
              <li key={b.key}>
                <Progress value={b.adjusted * 100} label={`${b.label}${b.mastered ? " — đã thuộc, bỏ qua cả nhóm" : ""}`} />
              </li>
            ))}
          </ul>
          {result.falseAlarm > 0.2 && <p className="text-sm mt-3" style={{ color: "var(--kin-tt-chu-cho)" }}>Bạn bấm “Biết” cho {Math.round(result.falseAlarm * 100)}% từ giả trong bài, nên kết quả đã được trừ bớt. Lần sau chỉ bấm “Biết” khi nói được nghĩa.</p>}
          <p className="text-sm mt-3" style={{ color: INK.phu }}>Đã đánh dấu {result.markedKnown.toLocaleString("vi-VN")} từ là đã biết; {result.gaps} từ “lỗ hổng” trong nhóm đã thuộc được đưa vào ôn ngay.</p>
        </Card>
        <div className="flex gap-2 flex-wrap">
          <LinkButton href="/student/tieng-anh/tu-vung/on">Bắt đầu học từ</LinkButton>
          <LinkButton href="/student/tieng-anh" variant="secondary">Về Hôm nay</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHead title="Kiểm tra từ vựng" sub="Bấm Biết nếu bạn nói được nghĩa của từ. Có vài từ không có thật để kiểm tra — đừng đoán." />
      <Progress value={(i / items.length) * 100} label={`Từ ${i + 1} / ${items.length}`} />
      <Card className="text-center py-12">
        <p className="text-4xl font-bold tracking-wide" style={{ color: INK.chinh }} aria-live="polite">{items[i].lemma}</p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <KinButton variant="secondary" size="lg" disabled={sending} onClick={() => answer(false)}>Chưa biết (←)</KinButton>
        <KinButton size="lg" disabled={sending} loading={sending} loadingLabel="Đang chấm…" onClick={() => answer(true)}>Biết (→)</KinButton>
      </div>
      {i > 0 && !sending && (
        <button type="button" className="text-sm underline min-h-11" style={{ color: "var(--kin-nhan-link)" }}
          onClick={() => { setI(i - 1); setAnswers(a => a.slice(0, -1)); }}>Bấm nhầm — quay lại từ trước</button>
      )}
    </div>
  );
}
