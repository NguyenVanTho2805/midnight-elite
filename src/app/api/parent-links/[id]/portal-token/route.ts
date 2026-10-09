// TK-178 (09/10/2026) — sinh / revoke token "Sổ của con".
//
// POST   /api/parent-links/[id]/portal-token  → sinh mới (hoặc rotate),
//        trả { portalToken, url }. CHỈ cho:
//          - học viên trong liên kết (em tự tạo cho mẹ)
//          - phụ huynh trong liên kết (tự rotate)
//          - admin có MANAGE_STUDENTS
//        Yêu cầu status="verified".
// DELETE /api/parent-links/[id]/portal-token  → revoke (set NULL). Cùng
//        tập quyền.
import { NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { checkPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { generatePortalToken } from "@/lib/parentPortal";

type Link = { id: string; status: string; parentId: string; studentId: string; portalToken: string | null };

async function authorize(linkId: string): Promise<
  { link: Link; actorId: string } | NextResponse
> {
  const session = await requireSession();
  if (isNextResponse(session)) return session;

  const link = (await prisma.parentLink.findUnique({ where: { id: linkId } })) as Link | null;
  if (!link) return NextResponse.json({ error: "Không tìm thấy liên kết" }, { status: 404 });
  if (link.status !== "verified") {
    return NextResponse.json({ error: "Liên kết chưa xác nhận, không tạo được link Sổ của con" }, { status: 409 });
  }
  const isParty = session.userId === link.studentId || session.userId === link.parentId;
  const isAdmin = session.role === "admin" && checkPermission(session.adminRole, PERMISSIONS.MANAGE_STUDENTS);
  if (!isParty && !isAdmin) {
    return NextResponse.json({ error: "Bạn không có quyền với liên kết này" }, { status: 403 });
  }
  return { link, actorId: session.userId };
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r instanceof NextResponse) return r;

  const token = generatePortalToken();
  await (prisma as unknown as {
    parentLink: { update(args: { where: { id: string }; data: { portalToken: string } }): Promise<unknown> };
  }).parentLink.update({ where: { id }, data: { portalToken: token } });

  await logAction(r.actorId, "parent_link.portal_token.rotate", "ParentLink", id, {
    parentId: r.link.parentId, studentId: r.link.studentId, hadPrevious: r.link.portalToken != null,
  });

  return NextResponse.json({ portalToken: token, url: `/so-cua-con/${token}` });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r instanceof NextResponse) return r;

  if (r.link.portalToken == null) {
    // Idempotent — không có gì để revoke.
    return NextResponse.json({ ok: true, alreadyRevoked: true });
  }

  await (prisma as unknown as {
    parentLink: { update(args: { where: { id: string }; data: { portalToken: null } }): Promise<unknown> };
  }).parentLink.update({ where: { id }, data: { portalToken: null } });

  await logAction(r.actorId, "parent_link.portal_token.revoke", "ParentLink", id, {
    parentId: r.link.parentId, studentId: r.link.studentId,
  });

  return NextResponse.json({ ok: true });
}
