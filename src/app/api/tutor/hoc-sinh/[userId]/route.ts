// Hồ sơ nhiều tab của một học sinh có tài khoản (HS-02). GET → StudentDetail. Chỉ gia sư; em phải học lớp của chính gia sư (người khác 403, không có 404).
// Thông tin riêng của em đi qua maskProfile (thiếu đồng ý thì không có trong kết quả); không nhận tutorId từ client.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { loadStudentDetail, ownStudent } from "@/lib/tutorStudentDetailServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { userId } = await params;
  const own = await ownStudent(auth, userId);
  if ("res" in own) return own.res;
  try {
    return NextResponse.json(await loadStudentDetail(auth.userId, own.user), { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/hoc-sinh/:userId]", userId, e instanceof Error ? e.message : "lỗi");
    return NextResponse.json({ error: "Không tải được hồ sơ học sinh, thử lại sau" }, { status: 500, headers: NO_STORE });
  }
}
