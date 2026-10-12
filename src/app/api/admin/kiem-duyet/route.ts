// GET → "Chờ kiểm duyệt" của người quản trị đang đăng nhập, theo QUYỀN của họ (xem src/lib/adminQueueServer.ts).
// ?badge=1 chỉ trả số dòng cần xử lý (cho thanh module). Chỉ đọc; các lệnh xử lý gọi thẳng API cũ của từng loại.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadAdminQueue } from "@/lib/adminQueueServer";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  try {
    const { items, badge } = await loadAdminQueue(session, new Date());
    if (new URL(req.url).searchParams.get("badge") === "1") return NextResponse.json({ badge });
    return NextResponse.json({ items, badge, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[kiem-duyet]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
