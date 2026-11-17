// TB-LOP (17/11/2026) — "Thông báo lớp" (tin một chiều của gia sư cho cả lớp).
//   GET  → JSON { role, items: [{ id, body, pinned, createdAt }] } cho gia sư chủ lớp / quản trị / đồng giảng / học sinh ghi danh active. Không trả người đăng.
//        Chưa đăng nhập 401; lớp không có 404; học sinh chưa vào lớp / gia sư lớp khác 403; đã nghỉ lớp 403 kèm suspended (như bản ghi).
//   POST → đăng tin. CHỈ gia sư chủ lớp (quản trị, đồng giảng, học sinh: 403). Gửi từ <form> ⇒ 303 về …/quan-lop/<id>/thong-bao?tb=<mã>; gửi JSON ⇒ JSON.
//        Đăng xong: học sinh active nhận thông báo trong ứng dụng (không chép nội dung tin, không tên người).
import { NextRequest, NextResponse } from "next/server";
import { getSessionChecked } from "@/lib/session";
import { recordingAccess } from "@/lib/classRecordingsServer";
import { suspendedBody } from "@/lib/suspendedContent";
import { classBase } from "@/lib/tutorClassRoutes";
import { unusableId } from "@/lib/courseAccessServer";
import { cleanAnnouncementBody, parsePinned } from "@/lib/classAnnouncement";
import { listAnnouncements, postAnnouncement } from "@/lib/classAnnouncementServer";

const NO_STORE = { "Cache-Control": "private, no-store" };
const NOT_MEMBER = "Thông báo này dành cho học sinh của lớp";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (unusableId(id)) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404, headers: NO_STORE });
  const { session } = await getSessionChecked();
  const acc = await recordingAccess(session, id);
  if (!acc.ok) {
    const body = acc.suspended ? suspendedBody(acc.contactHref ?? null) : { error: acc.status === 403 ? NOT_MEMBER : acc.error };
    return NextResponse.json(body, { status: acc.status, headers: NO_STORE });
  }
  const items = await listAnnouncements(id);
  return NextResponse.json({ role: acc.role, items: items.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isForm = !(req.headers.get("content-type") ?? "").includes("application/json");
  if (unusableId(id)) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404, headers: NO_STORE });
  const { session } = await getSessionChecked();
  // Hết phiên lúc gửi form: về đăng nhập rồi quay lại trang Thông báo (không hiện JSON thô).
  if (!session && isForm) return NextResponse.redirect(new URL(`/dang-nhap?redirect=${encodeURIComponent(`${classBase(id)}/thong-bao`)}`, req.url), { status: 303, headers: NO_STORE });
  const acc = await recordingAccess(session, id);
  if (!acc.ok) return NextResponse.json({ error: acc.status === 403 ? "Chỉ gia sư chủ lớp được đăng thông báo" : acc.error }, { status: acc.status, headers: NO_STORE });
  const owner = session!.role === "admin" && session!.adminRole === "teacher" && acc.course.ownerId === session!.userId;
  if (!owner) return NextResponse.json({ error: "Chỉ gia sư chủ lớp được đăng thông báo" }, { status: 403, headers: NO_STORE });

  let body: Record<string, unknown>;
  if (isForm) { const fd = await req.formData().catch(() => null); body = fd ? Object.fromEntries(fd.entries()) : {}; }
  else { const j: unknown = await req.json().catch(() => null); body = j && typeof j === "object" && !Array.isArray(j) ? j as Record<string, unknown> : {}; }

  const back = (code: string) => NextResponse.redirect(new URL(`${classBase(id)}/thong-bao?tb=${code}`, req.url), { status: 303, headers: NO_STORE });
  const clean = cleanAnnouncementBody(body.body);
  if (!clean.ok) return isForm ? back(clean.code) : NextResponse.json({ error: clean.code }, { status: 400, headers: NO_STORE });

  let code;
  try { code = await postAnnouncement({ id: acc.course.id, name: acc.course.name }, session!.userId, clean.body, parsePinned(body.pinned)); }
  catch (e) { console.error("[thong-bao] Không đăng được:", e); return isForm ? back("loi") : NextResponse.json({ error: "loi" }, { status: 500, headers: NO_STORE }); }
  if (isForm) return back(code);
  return code === "ok" ? NextResponse.json({ ok: true }, { status: 201, headers: NO_STORE }) : NextResponse.json({ error: code }, { status: 409, headers: NO_STORE });
}
