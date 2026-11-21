// TB-LOP (17/11/2026) — tab "Thông báo" của lớp (chỉ CHỦ lớp; đồng giảng / bộ môn → /lop-cua-toi/<id> như tab Học sinh). Trang tự kiểm quyền, không tin layout.
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { gateClassPage } from "@/lib/tutorClassPageServer";
import { classBase } from "@/lib/tutorClassRoutes";
import { countRecentAnnouncements, listAnnouncements } from "@/lib/classAnnouncementServer";
import { ANNOUNCE_DAILY_LIMIT } from "@/lib/classAnnouncement";
import ThongBaoLop from "@/components/tutor/ThongBaoLop";

export const dynamic = "force-dynamic";

export default async function ThongBaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await redirectIfNotTutor(await getSession(), { allowAdmin: true, path: `${classBase(id)}/thong-bao`, adminTo: "/admin" });
  const gate = await gateClassPage(session, id, { ownerOnly: true });
  if (!gate.ok) return null;
  const now = new Date();
  const [items, studentCount, recent] = await Promise.all([
    listAnnouncements(id),
    prisma.enrollment.count({ where: { courseId: id, status: "active" } }),
    countRecentAnnouncements(id, now),
  ]);
  const tb = typeof sp.tb === "string" && sp.tb.length <= 16 ? sp.tb : null;
  return <ThongBaoLop d={{ courseId: id, items: items.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })), studentCount, remaining: Math.max(0, ANNOUNCE_DAILY_LIMIT - recent), tb, nowIso: now.toISOString() }} />;
}
