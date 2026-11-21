// SCL-D (P2-4, 21/11/2026) — tab "Video" của lớp: gộp video bài giảng (bài có link video) và bản ghi buổi học (trước nằm ở Cài đặt → Bản ghi, trang riêng).
// Chỉ CHỦ lớp (và quản trị trung tâm đứng lớp); đồng giảng / bộ môn → trang lớp kiểu cũ như tab Học sinh. Trang tự kiểm quyền, không tin layout.
// Dán / gỡ bản ghi vẫn qua API cũ (POST + 303), form gửi back=video để quay về đây.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { gateClassPage } from "@/lib/tutorClassPageServer";
import { classBase } from "@/lib/tutorClassRoutes";
import { recordingAccess } from "@/lib/classRecordingsServer";
import { loadClassVideoView } from "@/lib/classVideoServer";
import BanGhiClient from "@/app/lop-cua-toi/[courseId]/ban-ghi/BanGhiClient";

export const dynamic = "force-dynamic";

export default async function VideoTabPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await redirectIfNotTutor(await getSession(), { allowAdmin: true, path: `${classBase(id)}/video`, adminTo: "/admin" });
  const gate = await gateClassPage(session, id, { ownerOnly: true });
  if (!gate.ok) return null;
  const acc = await recordingAccess(session, id);
  if (!acc.ok) return null;
  const isOwner = session.role === "admin" && session.adminRole === "teacher" && acc.course.ownerId === session.userId;
  const view = await loadClassVideoView(id, isOwner);
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return (
    <BanGhiClient
      embedded
      courseId={id}
      courseName={acc.course.name}
      isOwner={isOwner}
      canManage={acc.role === "manager"}
      flash={{ ok: one("ok") === "1", removed: one("da-go") === "1", error: one("loi").slice(0, 300) }}
      preselectSession={one("buoi")}
      {...view}
    />
  );
}
