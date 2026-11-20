// DG-HOC-ONLINE (14/11/2026) — POST /api/tutor/lop/[courseId]/hoc-online (form, POST + 303): chủ lớp lưu "Học online" của lớp.
//   joinUrl : link Google Meet / Zoom / Teams CHUNG của lớp (Course.classJoinUrl — cùng cột trang Lịch học của quản trị đang sửa). Rỗng = gỡ link. Bắt buộc https.
//   lead    : "" | "15" | "60" | "1440" — gửi email nhắc học sinh trước giờ học bao lâu (Course.reminderLeadMinutes; "" = tắt).
// Chỉ chủ lớp (requireCourseTutor: gia sư khác 403, không có lớp 404, chưa đăng nhập 401). Kết quả ⇒ 303 về Cài đặt → Học online kèm ?luu=ok | ?loi=link | ?loi=lead.
// Lỗi ở một ô thì KHÔNG lưu ô nào (không lưu nửa vời). Không đụng tiền, không đổi link riêng buổi / theo khung giờ (vẫn ưu tiên hơn link chung).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseTutor } from "@/lib/enrollServer";
import { logAction } from "@/lib/auditLog";
import { classBase } from "@/lib/tutorClassRoutes";
import { parseLeadMinutes, parseOnlineLink } from "@/lib/lessonReminder";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await requireCourseTutor(courseId);
  if (g instanceof NextResponse) return g;
  const back = (q: string) => NextResponse.redirect(new URL(`${classBase(courseId)}?tab=cai-dat&muc=hoc-online&${q}`, req.url), { status: 303, headers: NO_STORE });
  const fd = await req.formData().catch(() => null);
  const link = parseOnlineLink(fd?.get("joinUrl") ?? null);
  if (!link.ok) return back("loi=link");
  const lead = parseLeadMinutes(fd?.get("lead") ?? null);
  if (!lead.ok) return back("loi=lead");
  await prisma.course.update({ where: { id: courseId }, data: { classJoinUrl: link.value, reminderLeadMinutes: lead.value } });
  await logAction(g.session.userId, "course.online_settings", "Course", courseId, { hasLink: link.value !== null, isMeet: link.isMeet, leadMinutes: lead.value });
  return back("luu=ok");
}
