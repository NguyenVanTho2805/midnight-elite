// TB-LOP (17/11/2026) — POST /api/courses/[id]/thong-bao/[annId] (form, trường `action` = ghim | bo-ghim | xoa): gia sư CHỦ LỚP ghim / bỏ ghim / gỡ một tin của lớp.
// Người khác 403, lớp không có 404, tin không thuộc lớp này / đã gỡ ⇒ 303 ?tb=khong-co (không lộ tin của lớp khác). Kết quả ⇒ 303 về …/quan-lop/<id>/thong-bao?tb=<mã>.
import { NextRequest, NextResponse } from "next/server";
import { getSessionChecked } from "@/lib/session";
import { recordingAccess } from "@/lib/classRecordingsServer";
import { classBase } from "@/lib/tutorClassRoutes";
import { unusableId } from "@/lib/courseAccessServer";
import { removeAnnouncement, setAnnouncementPinned } from "@/lib/classAnnouncementServer";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; annId: string }> }) {
  const { id, annId } = await params;
  if (unusableId(id) || unusableId(annId)) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404, headers: NO_STORE });
  const { session } = await getSessionChecked();
  if (!session) return NextResponse.redirect(new URL(`/dang-nhap?redirect=${encodeURIComponent(`${classBase(id)}/thong-bao`)}`, req.url), { status: 303, headers: NO_STORE });
  const acc = await recordingAccess(session, id);
  if (!acc.ok) return NextResponse.json({ error: acc.status === 403 ? "Chỉ gia sư chủ lớp được sửa thông báo" : acc.error }, { status: acc.status, headers: NO_STORE });
  const owner = session!.role === "admin" && session!.adminRole === "teacher" && acc.course.ownerId === session!.userId;
  if (!owner) return NextResponse.json({ error: "Chỉ gia sư chủ lớp được sửa thông báo" }, { status: 403, headers: NO_STORE });

  const fd = await req.formData().catch(() => null);
  const action = fd?.get("action");
  const back = (code: string) => NextResponse.redirect(new URL(`${classBase(id)}/thong-bao?tb=${code}`, req.url), { status: 303, headers: NO_STORE });
  try {
    if (action === "ghim" || action === "bo-ghim") return back(await setAnnouncementPinned(id, annId, action === "ghim"));
    if (action === "xoa") return back(await removeAnnouncement(id, annId));
  } catch (e) { console.error("[thong-bao] Không sửa được:", e); return back("loi"); }
  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400, headers: NO_STORE });
}
