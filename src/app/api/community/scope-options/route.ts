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
    }
  } else {
    const enrolled = await prisma.enrollment.findMany({
      where:   { userId: session.userId, status: ENROLLMENT_STATUS.ACTIVE },
      select:  { course: { select: { id: true, name: true } } },
      orderBy: { course: { name: "asc" } },
    });
    for (const e of enrolled) scopes.push({ ...e.course, role: "student" });
  }

  return NextResponse.json({ scopes });
}
