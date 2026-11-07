// FE-117 — danh sách lớp có thể chọn làm phạm vi xem cộng đồng.
//
// Trả { scopes: [{ id, name, role }] } — role phân biệt lớp của học viên
// (đang enroll "active") với lớp của gia sư/admin (đang dạy). Không gộp vào
// một endpoint courses chung vì ngữ cảnh ở đây là "chat/forum" chứ không
// phải khoá học — khác select, có thể khác filter trong tương lai.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { activeHelperCourseIds } from "@/lib/classThreadAccess";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ scopes: [] });

  const scopes: { id: string; name: string; role: "student" | "teacher" }[] = [];

  if (session.role === "admin") {
    // Gia sư thấy lớp mình sở hữu. admin_super/admin_content không có owner
    // thực nên không gán nhãn — họ dùng view "chung" + chọn lớp cụ thể qua
    // tìm kiếm (ngoài phạm vi FE-117).
    if (session.adminRole === "teacher") {
      const owned = await prisma.course.findMany({
        where:  { ownerId: session.userId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      for (const c of owned) scopes.push({ ...c, role: "teacher" });
      // TUT-dong-giang D7: lớp đang đồng giảng (hiệu lực) cũng là phạm vi cộng đồng.
      const helpIds = await activeHelperCourseIds(session.userId);
      if (helpIds.length) {
        const helping = await prisma.course.findMany({ where: { id: { in: helpIds }, NOT: { ownerId: session.userId } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
        for (const c of helping) scopes.push({ ...c, role: "teacher" });
      }
    }
  } else {
    // H4: chỉ học sinh THẬT mới có phạm vi "lớp tôi học" (ghi danh cũ của tài khoản đã đổi vai không tính).
    const enrolled = await prisma.enrollment.findMany({
      where:   { userId: session.userId, status: ENROLLMENT_STATUS.ACTIVE, user: { role: "student" } },
      select:  { course: { select: { id: true, name: true } } },
      orderBy: { course: { name: "asc" } },
    });
    for (const e of enrolled) scopes.push({ ...e.course, role: "student" });
  }

  return NextResponse.json({ scopes });
}
