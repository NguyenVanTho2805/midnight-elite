// Một cuốn sách: danh sách unit theo nhóm chủ điểm + tiến độ; nếu đang soạn bài thì tiếp tục xử lý ngay tại đây.
"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinConfirm } from "@/components/kin";
import { api, Card, ErrorLine, INK, LinkButton, PageHead, Pill, Progress, Skeleton } from "@/components/english/ui";
import { useBookProcessing } from "@/components/english/useBookProcessing";

interface Unit { id: string; order: number; unitNo: string | null; title: string; group: string | null; pageStart: number; pageEnd: number; status: string; exercises: number; progress: { status: string; bestScore: number } | null }
interface Book { id: string; title: string; status: string; statusNote: string | null; unitsTotal: number; unitsDone: number; pageCount: number; pagesUploaded: number; units: Unit[] }

export default function BookPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const [b, setB] = useState<Book | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const load = useCallback(() => { api<Book>(`/api/english/books/${bookId}`).then(d => { setB(d); setErr(null); }).catch(e => setErr(e.message)); }, [bookId]);
  useEffect(load, [load]);
  const proc = useBookProcessing(load);

  useEffect(() => {
    if (b && (b.status === "processing" || (b.status === "pages" && b.pagesUploaded >= b.pageCount)) && !proc.running && !proc.error) void proc.run(bookId);
  }, [b?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async () => { await api(`/api/english/books/${bookId}/process`, { body: { retryErrors: true } }); void proc.run(bookId); };
  const del = async () => { try { await api(`/api/english/books/${bookId}`, { method: "DELETE" }); router.push("/student/tieng-anh/lop-hoc"); } catch (e) { setErr((e as Error).message); } };

  if (err && !b) return <ErrorLine message={err} onRetry={load} />;
  if (!b) return <Skeleton rows={4} />;

  const groups: { name: string; units: Unit[] }[] = [];
  for (const u of b.units) {
    const name = u.group || "";
    const g = groups.at(-1);
    if (g && g.name === name) g.units.push(u); else groups.push({ name, units: [u] });
  }
  const firstTodo = b.units.find(u => u.status === "ready" && u.progress?.status !== "done");
  const errors = b.units.filter(u => u.status === "error").length;

  return (
    <div className="space-y-4">
      <PageHead title={b.title} sub={`${b.unitsTotal} unit · ${b.pageCount} trang${b.statusNote ? ` · ${b.statusNote}` : ""}`}>
        {firstTodo && <LinkButton href={`/student/tieng-anh/lop-hoc/bai/${firstTodo.id}`}>Học tiếp</LinkButton>}
        <LinkButton href={`/student/tieng-anh/hoi-sach?sach=${b.id}`} variant="secondary">Hỏi sách này</LinkButton>
      </PageHead>

      {(b.status === "processing" || b.status === "pages") && (
        <Card>
          <Progress value={b.unitsTotal ? (b.unitsDone / b.unitsTotal) * 100 : 5} label={b.status === "pages" ? "Đang chia unit…" : `AI đang soạn bài: ${b.unitsDone}/${b.unitsTotal} unit (≈15 giây/unit)`} />
          <p className="text-xs mt-2" style={{ color: INK.mo }}>Giữ trang này mở để xử lý tiếp. Đóng lại thì lần sau mở sách sẽ làm tiếp từ chỗ dừng. Unit nào xong là học được ngay.</p>
          {proc.error && <div className="mt-2"><ErrorLine message={proc.error} onRetry={() => proc.run(bookId)} /></div>}
          {!proc.running && !proc.error && <KinButton className="mt-2" variant="secondary" onClick={() => proc.run(bookId)}>Tiếp tục xử lý</KinButton>}
        </Card>
      )}
      {b.status === "error" && <ErrorLine message={b.statusNote ?? "Không xử lý được sách này."} />}
      {errors > 0 && b.status === "ready" && (
        <Card className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm" style={{ color: "var(--kin-tt-chu-cho)" }}>{errors} unit chưa xử lý được (thường do AI quá tải).</p>
          <KinButton variant="secondary" onClick={retry} loading={proc.running}>Làm lại unit lỗi</KinButton>
        </Card>
      )}

      {groups.map((g, gi) => (
        <section key={gi} aria-label={g.name || "Các unit"}>
          {g.name && <h2 className="text-sm font-semibold uppercase tracking-wide mb-2 mt-2" style={{ color: INK.mo }}>{g.name}</h2>}
          <ul className="space-y-2">
            {g.units.map(u => {
              const label = u.unitNo ? `Unit ${u.unitNo}` : `Phần ${u.order}`;
              const body = (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: INK.chinh }}>{label}{u.title && !u.title.startsWith(label) ? ` · ${u.title}` : ""}</p>
                    <p className="text-xs" style={{ color: INK.phu }}>trang {u.pageStart}{u.pageEnd !== u.pageStart ? `–${u.pageEnd}` : ""} · {u.exercises} câu</p>
                  </div>
                  {u.status !== "ready" ? <Pill tone={u.status === "error" ? "loi" : "cho"}>{u.status === "error" ? "Lỗi" : "Đang soạn"}</Pill>
                    : u.progress ? <Pill tone={u.progress.status === "done" ? "xong" : "cho"}>{u.progress.status === "done" ? `Vững · ${u.progress.bestScore}%` : `Đang học · ${u.progress.bestScore}%`}</Pill>
                    : <Pill>Chưa học</Pill>}
                </div>
              );
              return (
                <li key={u.id}>
                  {u.status === "ready"
                    ? <Link href={`/student/tieng-anh/lop-hoc/bai/${u.id}`} className="block rounded-[var(--kin-bo-md)] px-4 py-3 min-h-11" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>{body}</Link>
                    : <div className="rounded-[var(--kin-bo-md)] px-4 py-3 opacity-70" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>{body}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="pt-4">
        <KinButton variant="danger" onClick={() => setAskDelete(true)}>Xoá sách này</KinButton>
      </div>
      <KinConfirm open={askDelete} title="Xoá sách?" message={`Xoá "${b.title}" cùng toàn bộ bài học, bài tập và lịch sử làm bài của sách này. Không hoàn tác được.`}
        confirmLabel="Xoá sách" tone="nguy-hiem" onConfirm={del} onCancel={() => setAskDelete(false)} />
    </div>
  );
}
