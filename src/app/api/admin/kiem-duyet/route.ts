// GET → "Hàng chờ" của người quản trị đang đăng nhập, theo QUYỀN từng loại (xem src/lib/adminQueueServer.ts). Chỉ đọc;
// các lệnh xử lý gọi thẳng API cũ của từng loại. Gia sư (teacher) KHÔNG BAO GIỜ vào được (403), kể cả ?badge=1.
//   ?badge=1            chỉ { badge, counts } — chỉ chạy count(), không đọc dòng
//   ?loai=<kind>        một loại; loại lạ → 400, loại không đủ quyền / chưa hỗ trợ → 403
//   ?limit=1..100       (mặc định 50)      ?cursor=<con trỏ>   trang sau
import { NextResponse } from "next/server";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { isNextResponse } from "@/lib/auth-guard";
import { decodeCursor, DEFAULT_PAGE_LIMIT, isQueueKind, type QueueKind } from "@/lib/adminQueue";
import { loadAdminQueue, loadQueueCounts, queueKindsFor } from "@/lib/adminQueueServer";

const NO_STORE = { "Cache-Control": "no-store" };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: NO_STORE });

export async function GET(req: Request) {
  const session = await requireCenterAdmin();
  if (isNextResponse(session)) return session;
  const sp = new URL(req.url).searchParams;
  try {
    if (sp.get("badge") === "1") {
      const { counts, badge } = await loadQueueCounts(session);
      return NextResponse.json({ badge, counts }, { headers: NO_STORE });
    }
    const loaiRaw = sp.get("loai");
    if (loaiRaw !== null && !isQueueKind(loaiRaw)) return bad("Loại không hợp lệ");
    if (loaiRaw !== null && !queueKindsFor(session).includes(loaiRaw as QueueKind)) return bad("Không có quyền xem loại này", 403);
    const limitRaw = sp.get("limit");
    let limit = DEFAULT_PAGE_LIMIT;
    if (limitRaw !== null) {
      if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 100) return bad("limit phải từ 1 đến 100");
      limit = Number(limitRaw);
    }
    const cursorRaw = sp.get("cursor");
    const cursor = cursorRaw === null ? null : decodeCursor(cursorRaw);
    if (cursorRaw !== null && !cursor) return bad("Con trỏ không hợp lệ");
    const r = await loadAdminQueue(session, { kind: loaiRaw && isQueueKind(loaiRaw) ? loaiRaw : undefined, limit, cursor }, new Date());
    return NextResponse.json({ items: r.items, counts: r.counts, badge: r.badge, nextCursor: r.nextCursor, generatedAt: new Date().toISOString() }, { headers: NO_STORE });
  } catch (e) {
    console.error("[kiem-duyet]", e);
    return bad("Lỗi server", 500);
  }
}
