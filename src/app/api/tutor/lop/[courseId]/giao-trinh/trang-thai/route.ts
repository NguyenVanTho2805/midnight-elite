// G5 (BU-02-PHẲNG) — đổi trạng thái HÀNG LOẠT (vd "Đăng tất cả mục Nháp"). Chỉ gia sư đã duyệt và là chủ lớp.
// Có id không thuộc lớp ⇒ 404 và KHÔNG ghi gì. Mỗi id đi qua cùng luật G4; id không đổi được vào `skipped` (không làm hỏng cả lô).
import { NextRequest, NextResponse } from "next/server";
import { requireCurriculumAccess, denyLessonEdit } from "@/lib/courseAccessServer";
import { patchStatusBulk } from "@/lib/giaoTrinhServer";
import { isLessonStatus } from "@/lib/lessonStatus";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const MAX_IDS = 100;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const auth = await requireCurriculumAccess(courseId);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null) as { lessonIds?: unknown; status?: unknown } | null;
  const ids = body?.lessonIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_IDS || !ids.every(x => typeof x === "string" && x.length > 0 && x.length <= 100) || !isLessonStatus(body?.status))
    return NextResponse.json({ error: "Dữ liệu gửi lên không đúng (1–100 mục và một trạng thái hợp lệ)." }, { status: 400, headers: NO_STORE });
  const denied = await denyLessonEdit(auth.acc, ids as string[]); // bộ môn: mọi bài phải ở nhóm của mình
  if (denied) return denied;
  const r = await patchStatusBulk(courseId, ids as string[], body!.status as "draft" | "published" | "hidden");
  if (!r) return NextResponse.json({ error: "Có mục không thuộc lớp này." }, { status: 404, headers: NO_STORE });
  return NextResponse.json(r, { headers: NO_STORE });
}
