// G2 / G3 (BU-02 + BU-02-PHẲNG) — G2: không `lessonId` ⇒ tạo MỤC MỚI (Nháp, hoặc Đã đăng nếu publish:true); có `lessonId` ⇒ gắn thêm nội dung. G3: gỡ một nội dung. Quyền: gia sư đã duyệt và là chủ lớp (requireCourseTutor: 401 / 403 / 404).
// POST nhận JSON (client fetch) hoặc form (application/x-www-form-urlencoded → 303 + ?ok=1 | ?loi=link|gioi-han|quyen). Cùng một handler, rẽ theo Content-Type.
import { NextRequest, NextResponse } from "next/server";
import { requireCurriculumAccess, denyLessonEdit, denyChapterEdit, roleForbidden } from "@/lib/courseAccessServer";
import { canDo } from "@/lib/courseAccess";
import { addItem, removeItemFromLesson, type AddItemInput } from "@/lib/giaoTrinhServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const isForm = /^(application\/x-www-form-urlencoded|multipart\/form-data)/i.test(req.headers.get("content-type") ?? "");
  const back = (q: string) => NextResponse.redirect(new URL(`/lop-cua-toi/quan-lop/${encodeURIComponent(courseId)}/giao-trinh?${q}`, req.url), { status: 303, headers: NO_STORE });

  const auth = await requireCurriculumAccess(courseId); // TUT-dong-giang: chủ / quản trị / đồng giảng / bộ môn (phạm vi nhóm kiểm ngay dưới)
  if (auth instanceof NextResponse) return isForm && auth.status === 403 ? back("loi=quyen") : auth;

  let raw: Record<string, unknown> = {};
  if (isForm) {
    const fd = await req.formData().catch(() => null);
    if (fd) for (const [k, v] of fd.entries()) if (typeof v === "string") raw[k] = v;
  } else {
    const j = await req.json().catch(() => null);
    if (j && typeof j === "object" && !Array.isArray(j)) raw = j as Record<string, unknown>;
  }
  const url = str(raw.url);
  const lessonId = str(raw.lessonId);
  const keepLesson = lessonId ? `&lessonId=${encodeURIComponent(lessonId)}` : "";
  if (!url) return isForm ? back(`loi=link${keepLesson}`) : NextResponse.json({ error: "Chưa dán link hoặc chọn tệp." }, { status: 400, headers: NO_STORE });

  // Bộ môn: mục mới phải rơi vào NHÓM của mình (chapterId), hoặc gắn thêm vào bài trong nhóm của mình (lessonId). Thiếu cả hai ⇒ vào chương ngầm (chủ / đồng giảng) ⇒ 403.
  if (!canDo(auth.acc.role, "content.edit.any")) {
    const denied = lessonId ? await denyLessonEdit(auth.acc, [lessonId]) : str(raw.chapterId) ? await denyChapterEdit(auth.acc, str(raw.chapterId)!) : roleForbidden();
    if (denied) return isForm ? back("loi=quyen") : denied;
  }
  const input: AddItemInput = { url, lessonId, chapterId: str(raw.chapterId), newLessonTitle: str(raw.newLessonTitle), name: str(raw.name), from: raw.from === "library" ? "library" : undefined, slot: (["video", "live", "azota", "document"] as const).find(x => x === raw.slot), publish: raw.publish === true || raw.publish === "1" || raw.publish === "true" };
  let r;
  try { r = await addItem(courseId, auth.session.userId, input); }
  catch (e) { console.error("[POST giao-trinh/muc]", courseId, e); return isForm ? back(`loi=link${keepLesson}`) : NextResponse.json({ error: "Thêm mục thất bại, hãy thử lại." }, { status: 500, headers: NO_STORE }); }

  if (isForm) return r.ok ? back(`ok=1&lessonId=${encodeURIComponent(r.lessonId)}`) : back(`loi=${r.code === "khong-co" ? "link" : r.code}${keepLesson}`);
  if (!r.ok) return NextResponse.json({ error: r.error, ...(r.moveTo ? { moveTo: r.moveTo } : {}) }, { status: r.status, headers: NO_STORE });
  return NextResponse.json({ item: r.item, lessonId: r.lessonId, status: r.lessonStatus, created: r.created, warning: r.warning, ...(r.duplicate ? { duplicate: true } : {}) }, { status: r.status, headers: NO_STORE });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const auth = await requireCurriculumAccess(courseId);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null) as { lessonId?: unknown; key?: unknown } | null;
  const lessonId = str(body?.lessonId), key = str(body?.key);
  if (!lessonId || !key) return NextResponse.json({ error: "Thiếu mã bài hoặc mã mục." }, { status: 400, headers: NO_STORE });
  const denied = await denyLessonEdit(auth.acc, [lessonId]);
  if (denied) return denied;
  const r = await removeItemFromLesson(courseId, lessonId, key);
  if (!r) return NextResponse.json({ error: "Không tìm thấy bài trong lớp này." }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ removed: r.removed }, { headers: NO_STORE });
}
