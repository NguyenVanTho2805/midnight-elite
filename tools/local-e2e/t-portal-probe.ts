import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { generatePortalToken } from "@/lib/parentPortal";
import { currentYearMonth } from "@/lib/tuition";

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan"), stu = await mkUser({ name: "Em Học" }), parent = await mkUser({ name: "Phụ Huynh" });
  const c = await mkCourse(tutor.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: stu.id, courseId: c.id, status: "active" } });
  await prisma.monthlyCourseFee.create({ data: { courseId: c.id, yearMonth: currentYearMonth(), sessionCount: 8, freeCount: 0, updatedBy: tutor.id } });
  const token = generatePortalToken();
  await prisma.parentLink.create({ data: { parentId: parent.id, studentId: stu.id, status: "verified", verifiedAt: new Date(), portalToken: token } });

  section("GET /api/parent-portal/[token] — học viên có lớp + có phí tháng");
  const r = await api("GET", `/api/parent-portal/${token}`);
  check("trả 200 (không 500)", r.status === 200, { status: r.status, body: r.text.slice(0, 300) });
  if (r.status === 200) check("tổng phải đóng = 8 × 70.000 = 560.000", r.json.total?.finalAmount === 560_000, r.json.total);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
