// SCL-C (P2-2) — form ngắn "Giao bài": lớp (một lớp thì chọn sẵn), loại (bài tập nộp tệp | quiz có sẵn), tiêu đề, tệp đề kéo-thả (DocumentsEditor có sẵn), hạn nộp.
// Gửi POST /api/tutor/bai-tap/giao rồi chuyển về sổ điểm của lớp. Trạng thái tải / lỗi (+ Thử lại) / rỗng đều có chữ.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentsEditor } from "@/components/tutor/quan-lop/DocumentsEditor";
import { KinSelect } from "@/components/kin/KinSelect";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { GIAO_TITLE_MAX } from "@/lib/soDiem";

type Opt = { id: string; name: string };
type Quiz = { id: string; title: string; courseId: string | null };

export default function GiaoBaiForm({ initialCourseId }: { initialCourseId: string }) {
  const router = useRouter();
  const [data, setData] = useState<{ courses: Opt[]; quizzes: Quiz[] } | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [courseId, setCourseId] = useState(initialCourseId);
  const [kind, setKind] = useState<"bai-tap" | "quiz">("bai-tap");
  const [title, setTitle] = useState("");
  const [docs, setDocs] = useState("[]");
  const [due, setDue] = useState("");
  const [examId, setExamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/tutor/bai-tap/giao", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => {
        const courses: Opt[] = Array.isArray(d.courses) ? d.courses : [];
        setData({ courses, quizzes: Array.isArray(d.quizzes) ? d.quizzes : [] }); setLoadErr(false);
        setCourseId(c => (c && courses.some(x => x.id === c) ? c : courses.length === 1 ? courses[0].id : ""));
      })
      .catch(() => setLoadErr(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = kind === "quiz" ? { kind, courseId, examId } : { kind, courseId, title, documents: docs, dueDate: due };
      const r = await fetch("/api/tutor/bai-tap/giao", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setError(d.error ?? "Chưa giao được bài. Thử lại nhé."); return; }
      router.push(d.href);
    } catch { setError("Mất kết nối. Thử lại nhé."); } finally { setBusy(false); }
  }

  if (loadErr) return <ErrorStrip message="Không tải được danh sách lớp." onRetry={load} />;
  if (!data) return <div aria-busy="true" aria-label="Đang tải" className="kin-skel kin-skel--soft h-[320px] rounded max-w-2xl" />;
  if (data.courses.length === 0) {
    return <KinEmptyState title="Bạn chưa có lớp nào" action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("primary")}>Tạo lớp</Link>}>Tạo lớp trước rồi mới giao bài được.</KinEmptyState>;
  }
  const quizzes = data.quizzes;
  const seg = (on: boolean) => `${kinButtonClass(on ? "primary" : "secondary")} flex-1`;

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6" data-giao-bai>
      <div>
        <label id="gb-lop-label" className={KIN_LABEL}>Lớp</label>
        <KinSelect id="gb-lop" aria-labelledby="gb-lop-label" value={courseId} onChange={v => setCourseId(v)} className="mt-1">
          <option value="">Chọn lớp</option>
          {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </KinSelect>
      </div>

      <div role="group" aria-label="Loại bài" className="flex gap-3">
        <button type="button" aria-pressed={kind === "bai-tap"} onClick={() => setKind("bai-tap")} className={seg(kind === "bai-tap")}>Bài tập nộp tệp</button>
        <button type="button" aria-pressed={kind === "quiz"} onClick={() => setKind("quiz")} className={seg(kind === "quiz")}>Quiz có sẵn</button>
      </div>

      {kind === "bai-tap" ? (
        <>
          <div>
            <label htmlFor="gb-ten" className={KIN_LABEL}>Tiêu đề</label>
            <input id="gb-ten" value={title} onChange={e => setTitle(e.target.value)} maxLength={GIAO_TITLE_MAX} required placeholder="Ví dụ: Bài về nhà tuần 3" className={`${KIN_FIELD} mt-1`} />
          </div>
          {courseId
            ? <DocumentsEditor key={courseId} value={docs} onChange={setDocs} courseId={courseId} canUpload onBusyChange={setUploading} />
            : <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chọn lớp để thả tệp đề.</p>}
          <div>
            <label htmlFor="gb-han" className={KIN_LABEL}>Hạn nộp (không bắt buộc)</label>
            <input id="gb-han" type="date" value={due} onChange={e => setDue(e.target.value)} className={`${KIN_FIELD} mt-1 max-w-xs`} />
          </div>
        </>
      ) : quizzes.length === 0 ? (
        <KinEmptyState title="Bạn chưa có quiz nào đã phát hành" action={<Link href="/lop-cua-toi/de-thi" className={kinButtonClass("secondary")}>Mở Quản lý đề thi</Link>}>Soạn và phát hành quiz ở Quản lý đề thi, rồi quay lại đây để giao cho lớp.</KinEmptyState>
      ) : (
        <div>
          <label id="gb-quiz-label" className={KIN_LABEL}>Quiz</label>
          <KinSelect id="gb-quiz" aria-labelledby="gb-quiz-label" value={examId} onChange={v => setExamId(v)} className="mt-1">
            <option value="">Chọn quiz</option>
            {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
          </KinSelect>
          <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Giờ mở và thời gian làm bài giữ như đã đặt trong quiz.</p>
        </div>
      )}

      {error && <p role="alert" className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-tt-chu-loi)]">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || uploading || !courseId || (kind === "quiz" && !examId)} className={kinButtonClass("primary")}>{busy ? "Đang giao…" : uploading ? "Đợi tệp tải xong…" : "Giao bài"}</button>
        <Link href="/lop-cua-toi/so-diem" className={kinButtonClass("ghost")}>Huỷ</Link>
      </div>
    </form>
  );
}
