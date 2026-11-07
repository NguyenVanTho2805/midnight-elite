// GET → "Việc của tôi" của học sinh đang đăng nhập (danh sách + khung đọc). ?badge=1 chỉ trả số việc cần ra tay (cho thanh module).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isStudentInDb } from "@/lib/studentOnly";
import { loadStudentTodo } from "@/lib/studentTodoServer";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  // H4: gia sư / quản trị không phải học sinh ⇒ danh sách rỗng (200), kể cả khi còn Enrollment cũ.
  if (session.role !== "student" || !(await isStudentInDb(session.userId))) {
    return NextResponse.json(new URL(req.url).searchParams.get("badge") === "1" ? { badge: 0 } : { items: [], badge: 0, generatedAt: new Date().toISOString() });
  }
  try {
    const { items, badge } = await loadStudentTodo(session.userId, new Date());
    if (new URL(req.url).searchParams.get("badge") === "1") return NextResponse.json({ badge });
    return NextResponse.json({ items, badge, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[viec-cua-toi]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
