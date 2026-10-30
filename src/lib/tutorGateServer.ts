// BU-00 bước 5 (31/10/2026) — phần MÁY CHỦ của cổng gia sư (quy tắc thuần ở src/lib/tutorGate.ts). Thay cho ~30 chỗ các trang (tutor)/**/page.tsx tự viết
// `if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi")` — câu đó đẩy gia sư CHỜ DUYỆT (vẫn là role student) vào danh sách
// lớp của học sinh, nơi họ không có gì để làm. Nay: gia sư qua; chờ duyệt → /lop-cua-toi/cho-duyet; học sinh thường / quản trị → như hành vi cũ của trang.
// Chỉ truy vấn DB khi role là student (một SELECT ba cột), gia sư / quản trị không tốn gì.
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { tutorApplicationStatus, type TutorApplicationStatus } from "@/lib/tutorProfile";
import { tutorGateTarget, isTeacher, type GateOptions, type GateSession } from "@/lib/tutorGate";

/** Trạng thái đơn gia sư của người trong phiên; chỉ hỏi DB cho role student (gia sư / quản trị trả "none" ngay). Lỗi DB → "none" (coi như học sinh thường,
 *  không chặn nhầm; trang chờ duyệt tự hỏi lại và hiện lỗi + Thử lại). */
export async function loadTutorStatus(session: GateSession & { userId: string }): Promise<TutorApplicationStatus> {
  if (session.role !== "student") return "none";
  try {
    const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { tutorAppliedAt: true, tutorVerified: true, tutorRejectedAt: true } });
    return u ? tutorApplicationStatus(u) : "none";
  } catch {
    return "none";
  }
}

/** Dùng ở đầu mọi trang chỉ-gia-sư: `const session = await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/lop" });` — trả lại phiên (đã chắc
 *  không null) cho trang dùng tiếp; không được vào thì gọi redirect() của Next (307, không 308) — ném NEXT_REDIRECT nên phải đứng NGOÀI try/catch.
 *  (Hàm async không làm "asserts" được, nên trả phiên thay vì thu hẹp kiểu tại chỗ.) */
export async function redirectIfNotTutor(session: SessionPayload | null, o: GateOptions): Promise<SessionPayload> {
  if (session && isTeacher(session)) return session; // đường nhanh: không hỏi DB
  const status = session ? await loadTutorStatus(session) : "none";
  const to = tutorGateTarget(session, status, o);
  if (to || !session) redirect(to ?? `/dang-nhap?redirect=${encodeURIComponent(o.path)}`);
  return session;
}

/** API của gia sư mà gia sư CHỜ DUYỆT cũng được dùng (Liên hệ hỗ trợ): gia sư hoặc người có đơn đang chờ; còn lại 401/403 JSON. */
export async function requireTutorOrApplicant(session: SessionPayload | null): Promise<SessionPayload | NextResponse> {
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (isTeacher(session)) return session;
  const status = await loadTutorStatus(session);
  if (tutorGateTarget(session, status, { path: "/", allowPending: true }) === null) return session;
  return NextResponse.json({ error: "Chỉ gia sư mới dùng chức năng này" }, { status: 403 });
}
