// QZ-04 — bước đầu "Tạo quiz": đặt tên (và chọn lớp nếu muốn) rồi vào trình soạn. Quiz sinh ra là BẢN NHÁP: học sinh chưa thấy.
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { qfetch, quizHref, IMPORT_HREF } from "./quizClient";

export default function QuizNew() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState<{ id: string; name: string }[] | null>(null);
  const [coursesErr, setCoursesErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/tutor/bai-tap", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<{ courses?: { id: string; name: string }[] }>; })
      .then(d => { if (alive) setCourses(Array.isArray(d.courses) ? d.courses : []); })
      .catch(() => { if (alive) { setCoursesErr(true); setCourses([]); } });
    return () => { alive = false; };
  }, []);

  async function create() {
    setSaving(true); setErr(null);
    const r = await qfetch<{ id: string }>("POST", "/api/tutor/quiz", { title, courseId: courseId || null });
    if (!r.ok || !r.data) { setSaving(false); setErr(r.error); return; }
    router.push(quizHref(r.data.id));
  }

  return (
    <KinPage>
      <KinPageHeader title="Tạo quiz" back={{ href: "/lop-cua-toi/bai-tap", label: "Bài tập" }} sub="Bước 1 · Đặt tên, rồi soạn từng câu" />
      <form className="max-w-[560px] space-y-5" onSubmit={e => { e.preventDefault(); void create(); }}>
        <div>
          <label htmlFor="qn-title" className={`${KIN_LABEL} mb-2`}>Tên quiz *</label>
          <input id="qn-title" className={KIN_FIELD} value={title} maxLength={150} autoFocus onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Kiểm tra 15 phút · Phương trình bậc hai" />
        </div>
        <div>
          <label htmlFor="qn-course" className={`${KIN_LABEL} mb-2`}>Lớp (chọn sau cũng được)</label>
          <select id="qn-course" className={KIN_FIELD} value={courseId} disabled={courses === null} onChange={e => setCourseId(e.target.value)}>
            <option value="">{courses === null ? "Đang tải lớp…" : "Chưa chọn lớp"}</option>
            {(courses ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {coursesErr && <p role="alert" className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">Không tải được danh sách lớp. Cô vẫn tạo quiz được và chọn lớp ở bước phát hành.</p>}
        </div>
        <KinCallout>Quiz mới là bản nháp: học sinh chưa thấy cho tới khi cô phát hành.</KinCallout>
        {err && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
        <div className="flex flex-wrap gap-3">
          <KinButton type="submit" loading={saving} loadingLabel="Đang tạo…" disabled={!title.trim()}>Tạo và soạn câu hỏi</KinButton>
          <Link href={IMPORT_HREF} className={kinButtonClass("secondary")}>Nhập đề từ tệp</Link>
        </div>
      </form>
    </KinPage>
  );
}
