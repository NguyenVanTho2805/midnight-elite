// GS-LOP-GON (09/11/2026) — vỏ CLIENT cho hai thân tab của trang lớp gia sư dựa trên bản ghi khoá học đầy đủ: "Cài đặt" (thông tin lớp, TabCaiDat) và "Bài tập"
// (cây Phần · Chương · Bài + bài tập tự nộp, TabChuongBai). Hai khối này sống bằng một lần tải GET /api/courses/<id> (API công khai, đủ cây bài) nên trang máy chủ chỉ cần
// cổng gia sư + kiểm chủ lớp rồi giao cho vỏ này. Ở đây CHỈ vẽ thân tab — KHÔNG có breadcrumb quản trị, KHÔNG có dải tab thứ hai (đầu lớp và dải tab do layout lồng cấp).
// Bốn trạng thái có chữ: đang tải · lỗi tải ("Thử lại") · không có lớp · lớp của người khác ("Bạn không có quyền với lớp này", không mang dữ liệu lớp).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { classBase } from "@/lib/tutorClassRoutes";
import type { CourseDB } from "./lessonForm";
import { TabCaiDat } from "./TabCaiDat";
import { TabChuongBai } from "./TabChuongBai";

type Phase = { kind: "loading" } | { kind: "error" } | { kind: "notfound" } | { kind: "ready"; course: CourseDB };

export default function QuanLopCourse({ courseId, view }: { courseId: string; view: "cai-dat" | "chuong-bai" }) {
  const { user, isLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const load = useCallback(() => {
    setPhase({ kind: "loading" });
    fetch(`/api/courses/${encodeURIComponent(courseId)}`, { credentials: "same-origin", cache: "no-store" })
      .then(r => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<CourseDB>;
      })
      .then(c => setPhase(c ? { kind: "ready", course: c } : { kind: "notfound" }))
      .catch(() => setPhase({ kind: "error" }));
  }, [courseId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const toList = <Link href="/lop-cua-toi/lop" className={kinButtonClass("primary")}>Về danh sách lớp</Link>;

  if (phase.kind === "loading" || isLoading) {
    return <div role="status" aria-busy="true" data-quan-lop-tai className="py-12 text-center text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải lớp…</div>;
  }
  if (phase.kind === "error") {
    return (
      <KinEmptyState title="Chưa tải được lớp" action={<KinButton type="button" onClick={load}>Thử lại</KinButton>}>
        Dữ liệu của cô vẫn an toàn. Thử lại sau ít giây.
      </KinEmptyState>
    );
  }
  if (phase.kind === "notfound") {
    return <KinEmptyState title="Không tìm thấy lớp" action={toList}>Lớp này không còn hoặc đường dẫn bị sai. Cô chọn lại lớp ở danh sách lớp.</KinEmptyState>;
  }
  const course = phase.course;
  // Máy chủ đã chặn người lạ; đây là lưới an toàn thứ hai (API đọc khoá là công khai): chỉ chủ lớp mới sửa được.
  if (!user || course.ownerId !== user.id) {
    return <KinEmptyState title="Bạn không có quyền với lớp này" action={toList}>Lớp này thuộc người khác nên KiN không hiện phần sửa của lớp.</KinEmptyState>;
  }

  if (view === "cai-dat") return <TabCaiDat courseSlug={course.id} course={course} />;
  return (
    <div>
      <p data-bai-tap-dan className="mb-5 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        Cây Phần · Chương · Bài và bài tập tự nộp của lớp. Tệp và video giáo trình mới nằm ở tab{" "}
        <Link href={`${classBase(course.id)}/giao-trinh`} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Giáo trình</Link>.
      </p>
      <TabChuongBai courseSlug={course.id} initialSections={course.sections} canUpload />
    </div>
  );
}
