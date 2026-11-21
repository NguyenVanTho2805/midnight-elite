// MD-02 + MD-17 — Bản ghi của lớp: gia sư dán link bản ghi sau buổi học, gắn vào đúng buổi; và bảng ai đã xem video bài giảng của lớp.
// Quyền: gia sư CHỦ lớp (và quản trị cấp 1/nội dung) vào được; gia sư lớp khác và người lạ thấy 404 (không lộ lớp có tồn tại); học sinh của lớp
// được chuyển sang mục "Bản ghi các buổi học" (màn Tất cả bài học) trong Lớp của tôi. Tên học sinh trong bảng "ai đã xem" CHỈ hiện cho gia sư chủ lớp.
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { recordingAccess } from "@/lib/classRecordingsServer";
import { loadClassVideoView } from "@/lib/classVideoServer";
import BanGhiClient from "./BanGhiClient";
import { SuspendedNotice } from "@/components/student/SuspendedNotice";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ courseId: string }>; searchParams: Promise<{ ok?: string; loi?: string; "da-go"?: string; buoi?: string }> };

export default async function BanGhiPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=/lop-cua-toi/${courseId}/ban-ghi`);
  const acc = await recordingAccess(session, courseId);
  if (!acc.ok && acc.suspended) return <SuspendedNotice contactHref={acc.contactHref ?? null} />;
  if (!acc.ok) notFound();
  if (acc.role === "student") redirect(`/student/hoc-tap?course=${encodeURIComponent(courseId)}&xem=bai-hoc#ban-ghi`); // SCL-G-HS: bản ghi nằm cuối màn "Tất cả bài học" (tab Video đã bỏ)

  const isOwner = session.role === "admin" && session.adminRole === "teacher" && acc.course.ownerId === session.userId;
  const view = await loadClassVideoView(courseId, isOwner);

  return (
    <BanGhiClient
      courseId={courseId}
      courseName={acc.course.name}
      isOwner={isOwner}
      flash={{ ok: sp.ok === "1", removed: sp["da-go"] === "1", error: typeof sp.loi === "string" ? sp.loi.slice(0, 300) : "" }}
      preselectSession={typeof sp.buoi === "string" ? sp.buoi : ""}
      {...view}
    />
  );
}
