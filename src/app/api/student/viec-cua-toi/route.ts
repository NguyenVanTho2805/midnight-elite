// GET → "Việc của tôi" của học sinh đang đăng nhập (danh sách + khung đọc). ?badge=1 chỉ trả số việc cần ra tay (cho thanh module).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadStudentTodo } from "@/lib/studentTodoServer";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const { items, badge } = await loadStudentTodo(session.userId, new Date());
    if (new URL(req.url).searchParams.get("badge") === "1") return NextResponse.json({ badge });
    return NextResponse.json({ items, badge, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[viec-cua-toi]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
