// Bài học một unit: tóm tắt tiếng Việt → ý chính → ví dụ (nghe được) → lỗi người Việt hay mắc → bài tập gốc (chấm theo đáp án sách)
// → luyện thêm (AI soạn, đã tự kiểm) → hỏi về bài này. Câu làm sai tự vào Sổ lỗi (thẻ "làm lại" trong phần ôn).
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, PageHead, Pill, Progress, Skeleton } from "@/components/english/ui";
import QuestionList, { type QItem } from "@/components/english/QuestionList";
import AskBox from "@/components/english/AskBox";
import { speak } from "@/components/english/speech";

interface Unit {
  id: string; bookId: string; unitNo: string | null; title: string; group: string | null; pageStart: number; pageEnd: number; status: string;
  summaryVi: string | null; keyPoints: string[] | null; examples: string[] | null; mistakesVi: string[] | null;
  book: { title: string; kind: string }; exercises: QItem[];
  prev: { id: string; title: string; unitNo: string | null } | null; next: { id: string; title: string; unitNo: string | null } | null;
  progress: { status: string; bestScore: number; lastScore: number | null } | null;
}
const label = (u: { unitNo: string | null; title: string }) => (u.unitNo ? `Unit ${u.unitNo}` : u.title);

export default function UnitPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const [u, setU] = useState<Unit | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [gen, setGen] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });

  const load = useCallback(() => { api<Unit>(`/api/english/units/${unitId}`).then(d => { setU(d); setErr(null); setScore(d.progress?.lastScore ?? null); }).catch(e => setErr(e.message)); }, [unitId]);
  useEffect(load, [load]);

  const more = async () => {
    setGen({ busy: true, msg: null });
    try { const r = await api<{ created: number; dropped: number }>(`/api/english/units/${unitId}/variants`, { body: {} }); setGen({ busy: false, msg: `Đã thêm ${r.created} câu mới${r.dropped ? ` (bỏ ${r.dropped} câu AI không chắc đáp án)` : ""}.` }); load(); }
    catch (e) { setGen({ busy: false, msg: (e as Error).message }); }
  };

  if (err && !u) return <ErrorLine message={err} onRetry={load} />;
  if (!u) return <Skeleton rows={5} />;

  const bookEx = u.exercises.filter(e => e.origin !== "ai");
  const aiEx = u.exercises.filter(e => e.origin === "ai");

  return (
    <div className="space-y-4">
      <nav className="text-sm" aria-label="Đường dẫn"><Link href={`/student/tieng-anh/lop-hoc/${u.bookId}`} className="underline" style={{ color: "var(--kin-nhan-link)" }}>{u.book.title}</Link>{u.group ? <span style={{ color: INK.mo }}> · {u.group}</span> : null}</nav>
      <PageHead title={`${label(u)}${u.unitNo ? ` · ${u.title}` : ""}`} sub={`Trang ${u.pageStart}${u.pageEnd !== u.pageStart ? `–${u.pageEnd}` : ""} trong sách của bạn`}>
        {u.progress?.status === "done" ? <Pill tone="xong">Đã vững</Pill> : u.progress ? <Pill tone="cho">Đang học</Pill> : <Pill>Chưa học</Pill>}
      </PageHead>

      {u.status !== "ready" ? <ErrorLine message="Unit này chưa soạn xong." /> : (
        <>
          <Card aria-labelledby="h-tt">
            <h2 id="h-tt" className="font-bold mb-2" style={{ color: INK.chinh }}>Tóm tắt</h2>
            <p className="whitespace-pre-line leading-7" style={{ color: INK.chinh }}>{u.summaryVi}</p>
            {!!u.keyPoints?.length && (
              <ul className="list-disc pl-5 mt-3 space-y-1">{u.keyPoints.map((k, i) => <li key={i} style={{ color: INK.chinh }}>{k}</li>)}</ul>
            )}
          </Card>

          {!!u.examples?.length && (
            <Card aria-labelledby="h-vd">
              <h2 id="h-vd" className="font-bold mb-2" style={{ color: INK.chinh }}>Ví dụ trong sách</h2>
              <ul className="space-y-1">{u.examples.map((ex, i) => (
                <li key={i} className="flex items-center gap-2"><button type="button" onClick={() => speak(ex, 0.9)} className="text-xs underline min-h-11 min-w-11" style={{ color: "var(--kin-nhan-link)" }} aria-label={`Nghe: ${ex}`}>nghe</button><span className="italic" style={{ color: INK.chinh }}>{ex}</span></li>
              ))}</ul>
            </Card>
          )}

          {!!u.mistakesVi?.length && (
            <Card aria-labelledby="h-loi">
              <h2 id="h-loi" className="font-bold mb-2" style={{ color: INK.chinh }}>Lỗi người Việt hay mắc</h2>
              <ul className="space-y-1">{u.mistakesVi.map((m, i) => <li key={i} className="text-sm" style={{ color: INK.chinh }}>• {m}</li>)}</ul>
            </Card>
          )}

          <Card aria-labelledby="h-bt">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h2 id="h-bt" className="font-bold" style={{ color: INK.chinh }}>Bài tập trong sách ({bookEx.length} câu)</h2>
              {score !== null && <div className="w-48"><Progress value={score} label="Điểm unit" /></div>}
            </div>
            {bookEx.length ? <QuestionList items={bookEx} canFlag onScore={setScore} /> : <p className="text-sm" style={{ color: INK.phu }}>Không tách được bài tập từ unit này — dùng phần luyện thêm bên dưới.</p>}
            <p className="text-xs mt-3" style={{ color: INK.mo }}>Đạt từ 80% (tính câu làm gần nhất) là unit “vững”. Câu sai sẽ quay lại trong phần Ôn từ.</p>
          </Card>

          <Card aria-labelledby="h-them">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h2 id="h-them" className="font-bold" style={{ color: INK.chinh }}>Luyện thêm ({aiEx.length} câu)</h2>
              <KinButton variant="secondary" onClick={more} loading={gen.busy} loadingLabel="AI đang soạn và tự kiểm (≈20 giây)…">Soạn thêm 10 câu</KinButton>
            </div>
            {gen.msg && <p className="text-sm mb-2" style={{ color: INK.phu }}>{gen.msg}</p>}
            {aiEx.length ? <QuestionList items={aiEx} canFlag onScore={setScore} /> : <p className="text-sm" style={{ color: INK.phu }}>Câu mới cùng điểm ngữ pháp, dùng từ bạn đang học. AI giải lại lần hai — câu nào hai lần ra khác đáp án thì bỏ.</p>}
          </Card>

          <Card aria-labelledby="h-hoi">
            <h2 id="h-hoi" className="font-bold mb-2" style={{ color: INK.chinh }}>Hỏi về bài này</h2>
            <AskBox bookId={u.bookId} unitId={u.id} placeholder="vd: Tại sao câu 3 dùng 'has been' mà không phải 'was'?" />
          </Card>
        </>
      )}

      <nav className="flex justify-between gap-2" aria-label="Unit trước / sau">
        {u.prev ? <Link href={`/student/tieng-anh/lop-hoc/bai/${u.prev.id}`} className="underline min-h-11 inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>← {label(u.prev)}</Link> : <span />}
        {u.next ? <Link href={`/student/tieng-anh/lop-hoc/bai/${u.next.id}`} className="underline min-h-11 inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>{label(u.next)} →</Link> : <span />}
      </nav>
    </div>
  );
}
