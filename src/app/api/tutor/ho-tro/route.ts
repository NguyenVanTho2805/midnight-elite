// KiN Pro F6 — gia sư gửi và xem yêu cầu hỗ trợ của CHÍNH MÌNH. Gói lúc gửi được chụp lại (Pro xếp trước). Không trường học sinh nào.
//   GET  → { plan, promise, requests[] (của mình, kèm trả lời của quản trị) }
//   POST { kind, subject, message } → 201; quá MAX_OPEN_PER_USER yêu cầu đang chờ → 429
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { getTutorPlan } from "@/lib/planServer";
import { KIND_LABEL, MAX_OPEN_PER_USER, PRIVACY_HINT, STATUS_LABEL, laneOf, parseSupportInput, promiseFor, isSupportKind, type SupportStatus } from "@/lib/supportDesk";

const NO_STORE = { "Cache-Control": "no-store" };
const view = (r: { id: string; kind: string; subject: string; message: string; planAtSend: string; status: string; reply: string | null; repliedAt: Date | null; createdAt: Date }) => ({
  id: r.id, kind: r.kind, kindLabel: isSupportKind(r.kind) ? KIND_LABEL[r.kind] : r.kind, subject: r.subject, message: r.message,
  lane: laneOf(isSupportKind(r.kind) ? r.kind : "other", r.planAtSend === "pro" ? "pro" : "free"),
  status: r.status, statusLabel: STATUS_LABEL[r.status as SupportStatus] ?? r.status, reply: r.reply, repliedAt: r.repliedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
});

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const [plan, rows] = await Promise.all([getTutorPlan(auth.userId), prisma.supportRequest.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" }, take: 30 })]);
    return NextResponse.json({ plan: plan.code, promise: promiseFor(plan.code), privacyHint: PRIVACY_HINT, maxOpen: MAX_OPEN_PER_USER, requests: rows.map(view) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/ho-tro]", e);
    return NextResponse.json({ error: "Không tải được yêu cầu hỗ trợ, thử lại sau" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  let body: unknown = null;
  try { body = await req.json(); } catch { /* báo lỗi bên dưới */ }
  const p = parseSupportInput(body);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400, headers: NO_STORE });
  try {
    const plan = await getTutorPlan(auth.userId);
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`support:${auth.userId}`}))`;
      const open = await tx.supportRequest.count({ where: { userId: auth.userId, status: "open" } });
      if (open >= MAX_OPEN_PER_USER) return null;
      return tx.supportRequest.create({ data: { userId: auth.userId, kind: p.kind, subject: p.subject, message: p.message, planAtSend: plan.code } });
    });
    if (!created) return NextResponse.json({ error: `Bạn đang có ${MAX_OPEN_PER_USER} yêu cầu chưa được trả lời. Chờ trả lời xong rồi gửi thêm, hoặc bổ sung vào yêu cầu cũ.` }, { status: 429, headers: NO_STORE });
    return NextResponse.json({ request: view(created), promise: promiseFor(plan.code) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    console.error("[POST /api/tutor/ho-tro]", e);
    return NextResponse.json({ error: "Chưa gửi được yêu cầu, thử lại sau" }, { status: 500, headers: NO_STORE });
  }
}
