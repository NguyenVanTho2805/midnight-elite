// HS-09: bật / thu hồi LINK BÁO CÁO RIÊNG của một học sinh (trang "Sổ của con", /so-cua-con/<token>), từ phía gia sư.
//  POST   { linkId } → bật: nếu liên kết phụ huynh đã xác nhận chưa có link thì sinh token ngẫu nhiên 128 bit; đã có thì trả lại link đang chạy.
//  DELETE { linkId } → thu hồi NGAY: xoá token, link cũ ngừng hoạt động từ lần mở kế tiếp (trang công khai chỉ nhận token đang còn).
// Gia sư chỉ thao tác được liên kết của em học lớp mình (em lớp khác 403; liên kết của em khác 404). Không có phụ huynh liên kết → 409, không tự tạo.
// Đường dẫn chỉ có token, không tên em / mã em. Log chỉ có id.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { generatePortalToken } from "@/lib/parentPortal";
import { reportPath } from "@/lib/tutorStudentView";
import type { SessionPayload } from "@/lib/session";
import { ownStudent } from "@/lib/tutorStudentDetailServer";

const NO_STORE = { "Cache-Control": "no-store" };
type Ctx = { params: Promise<{ userId: string }> };

async function resolve(req: Request, params: Ctx["params"]): Promise<{ res: NextResponse } | { auth: SessionPayload; userId: string; link: { id: string; studentId: string; status: string; portalToken: string | null } }> {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return { res: auth };
  const { userId } = await params;
  const own = await ownStudent(auth, userId);
  if ("res" in own) return { res: own.res };
  const b = await req.json().catch(() => null) as { linkId?: unknown } | null;
  if (typeof b?.linkId !== "string" || !b.linkId) return { res: NextResponse.json({ error: "Chọn liên kết phụ huynh" }, { status: 400 }) };
  const link = await prisma.parentLink.findUnique({ where: { id: b.linkId }, select: { id: true, studentId: true, status: true, portalToken: true } });
  if (!link || link.studentId !== userId) return { res: NextResponse.json({ error: "Không tìm thấy liên kết phụ huynh của em này" }, { status: 404 }) };
  return { auth, userId, link };
}

export async function POST(req: Request, ctx: Ctx) {
  const r = await resolve(req, ctx.params);
  if ("res" in r) return r.res;
  const { auth, userId, link } = r;
  if (link.status !== "verified") return NextResponse.json({ error: "Liên kết phụ huynh chưa được xác nhận trên KiN nên chưa bật được link báo cáo." }, { status: 409, headers: NO_STORE });
  if (link.portalToken) return NextResponse.json({ ok: true, already: true, url: reportPath(link.portalToken) }, { headers: NO_STORE });
  const token = generatePortalToken();
  await prisma.parentLink.update({ where: { id: link.id }, data: { portalToken: token } });
  await logAction(auth.userId, "parent_link.portal_token.enable", "ParentLink", link.id, { studentId: userId, by: "tutor" });
  return NextResponse.json({ ok: true, already: false, url: reportPath(token) }, { status: 201, headers: NO_STORE });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const r = await resolve(req, ctx.params);
  if ("res" in r) return r.res;
  const { auth, userId, link } = r;
  if (!link.portalToken) return NextResponse.json({ ok: true, alreadyRevoked: true }, { headers: NO_STORE });
  await prisma.parentLink.update({ where: { id: link.id }, data: { portalToken: null } });
  await logAction(auth.userId, "parent_link.portal_token.revoke", "ParentLink", link.id, { studentId: userId, by: "tutor" });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
