// BU-01 (R1) — POST /api/courses/[id]/join: nút "Vào lớp" / "Xin vào lớp" ở trang lớp công khai (form, rỗng). [id] là slug lớp.
// Quyết định bằng joinDecision (src/lib/joinRequest.ts): lớp "open" (miễn phí) vào ngay qua enrollInTx; lớp "approve" cấp / trả lại MÃ CÁ NHÂN
// gắn tài khoản (gọi hai lần, kể cả song song ⇒ cùng một mã) rồi chuyển sang trang nhập mã; lớp chỉ-mã-mời ⇒ 303 ?join=chi-ma. Kết quả người dùng gặp được (đóng / đầy / chỉ-mã / không có lớp) ⇒ 303 về trang kèm ?join=
// (dong | day | chi-ma | khong-co); chỉ 401/403 giữ JSON.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionChecked } from "@/lib/session";
import { effectivePolicy, isFreeClass, joinDecision } from "@/lib/joinRequest";
import { denyNonStudent, enrollInTx, issuePersonalCode, loadFeeRateCourseIds, logEnrollment } from "@/lib/enrollServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const see = (path: string) => NextResponse.redirect(new URL(path, req.url), { status: 303, headers: NO_STORE });
  const page = `/khoa-hoc/${encodeURIComponent(id)}`;

  const { session, denied } = await getSessionChecked();
  if (denied === "banned") return NextResponse.json({ error: "Tài khoản đã bị khoá" }, { status: 403, headers: NO_STORE });
  if (!session) return see(`/dang-nhap?redirect=${encodeURIComponent(page)}`);
  const no = await denyNonStudent(session);
  if (no) return no;

  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, classStatus: true, capacity: true, ownerId: true, joinPolicy: true, price: true, tag: true },
  });
  if (!course || !course.status) return see(`${page}?join=khong-co`);

  const [enr, req0, rated] = await Promise.all([
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: id } }, select: { id: true } }),
    prisma.classJoinRequest.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: id } }, select: { status: true } }),
    loadFeeRateCourseIds([id]),
  ]);
  // "open" chỉ có nghĩa khi lớp CÒN miễn phí (gia sư có thể đã nhập đơn giá sau khi chọn "open"): lúc đó coi như chỉ-mã-mời.
  let policy = effectivePolicy(course.joinPolicy);
  if (policy === "open" && !isFreeClass({ price: course.price, tag: course.tag, hasFeeRate: rated.has(id) })) policy = "invite_only";

  const d = joinDecision({ policy, classOpen: course.classStatus === "open", hasEnrollment: !!enr, request: (req0?.status as "pending" | "approved" | "rejected" | "cancelled" | undefined) ?? null });
  switch (d.action) {
    case "already_member": return see(`/student/hoc-tap?course=${encodeURIComponent(id)}`);
    case "closed": return see(`${page}?join=dong`);
    case "invite_only": return see(`${page}?join=chi-ma`);
    case "enroll": {
      const r = await prisma.$transaction((tx) => enrollInTx(tx, { userId: session.userId, course, source: "join_open" }));
      if (!r.ok) {
        // Tài khoản không còn là học sinh (đổi vai giữa chừng): không phải "lớp đầy" ⇒ không dùng ?join=day.
        if (r.code === "NOT_STUDENT") return NextResponse.json({ error: "Chỉ học sinh mới dùng chức năng này" }, { status: 403, headers: NO_STORE });
        return see(`${page}?join=${r.code === "CLASS_CLOSED" ? "dong" : "day"}`);
      }
      await logEnrollment(session.userId, r, { courseId: id, source: "join_open" });
      return see(`/student/hoc-tap?course=${encodeURIComponent(id)}`);
    }
    case "issue_personal_code": {
      const { code } = await issuePersonalCode(id, session.userId);
      return see(`/student/nhap-ma-lop?code=${encodeURIComponent(code)}`);
    }
  }
}
