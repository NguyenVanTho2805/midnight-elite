// TUT-dong-giang H4 — cổng "chỉ học sinh" cho route của vỏ học sinh.
// Gia sư / quản trị (role "admin") KHÔNG dùng route học sinh, kể cả khi còn Enrollment cũ (tài khoản học sinh được đổi lên gia sư — Enrollment giữ nguyên làm dữ liệu).
// Vai đọc LẠI từ DB: yêu cầu ĐỌC chỉ mang vai trong token, mà token của người vừa đổi vai có thể còn ghi "student".
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, type SessionPayload } from "@/lib/session";

export const STUDENT_ONLY_MESSAGE = "Chỉ học sinh mới dùng chức năng này";

/** true khi tài khoản còn tồn tại và vai TRONG DB là học sinh. */
export async function isStudentInDb(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role === "student";
}

/** Có phiên + vai học sinh (DB) ⇒ phiên; chưa đăng nhập 401; vai khác 403. */
export async function requireStudentRole(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (session.role !== "student" || !(await isStudentInDb(session.userId))) {
    return NextResponse.json({ error: STUDENT_ONLY_MESSAGE }, { status: 403 });
  }
  return session;
}
