// GS-LOP-GON (09/11/2026) → LOI-02 (11/11/2026) — vỏ CLIENT cho hai thân tab của trang lớp gia sư dựa trên bản ghi khoá học đầy đủ: "Cài đặt" (thông tin lớp, TabCaiDat) và
// "Bài học" (cây Phần · Chương · Bài + panel sửa bài có ngày học, trạng thái, ô thả tài liệu, bài tập tự nộp — TabChuongBai). LOI-02 bỏ dòng dẫn sang tab Giáo trình (tab đã bỏ). Hai khối này sống bằng một lần tải GET /api/courses/<id> (API công khai, đủ cây bài) nên trang máy chủ chỉ cần
// cổng gia sư + kiểm chủ lớp rồi giao cho vỏ này. Ở đây CHỈ vẽ thân tab — KHÔNG có breadcrumb quản trị, KHÔNG có dải tab thứ hai (đầu lớp và dải tab do layout lồng cấp).
// Bốn trạng thái có chữ: đang tải · lỗi tải ("Thử lại") · không có lớp · lớp của người khác ("Bạn không có quyền với lớp này", không mang dữ liệu lớp).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isCenterAdmin } from "@/lib/tutorGate";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinEmptyState } from "@/components/kin/EmptyState";
import type { CourseDB } from "./lessonForm";
import { TabCaiDat } from "./TabCaiDat";
import { TabChuongBai } from "./TabChuongBai";
import type { LessonStat } from "@/lib/lopViecServer";

type Phase = { kind: "loading" } | { kind: "error" } | { kind: "notfound" } | { kind: "ready"; course: CourseDB };

export default function QuanLopCourse({ courseId, view, stats, todo }: {
  courseId: string; view: "cai-dat" | "bai-hoc";
  /** SCL-G-GS: cột "Nộp x/y" theo bài (máy chủ tính). */ stats?: Record<string, LessonStat>;
  /** SCL-G-GS: khối "Cần bạn xử lý" của lớp (vẽ ở máy chủ), đặt đầu cột trái. */ todo?: ReactNode;
}) {
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
  // Máy chủ đã chặn người lạ; đây là lưới an toàn thứ hai (API đọc khoá là công khai): chỉ chủ lớp — hoặc Chủ nhiệm (quản trị trung tâm, SCL-B Q1) — mới sửa được.
  const isOwner = !!user && course.ownerId === user.id;
  if (!user || (!isOwner && !isCenterAdmin(user))) {
    return <KinEmptyState title="Bạn không có quyền với lớp này" action={toList}>Lớp này thuộc người khác nên KiN không hiện phần sửa của lớp.</KinEmptyState>;
  }

  if (view === "cai-dat") return <TabCaiDat courseSlug={course.id} course={course} />;
  // Ô tải tệp lên KiN: /api/media/document/init vẫn chỉ nhận CHỦ lớp ⇒ Chủ nhiệm ở lớp của gia sư khác dán link (như đồng giảng).
  return <TabChuongBai courseSlug={course.id} initialSections={course.sections} canUpload={isOwner} stats={stats} todo={todo} />;
}
