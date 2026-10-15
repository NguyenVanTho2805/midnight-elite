// FE-141..144 — Tổng quan của gia sư: số liệu, việc cần làm, danh sách lớp. Trước 13/10 đây là trang chủ /lop-cua-toi; khi Hộp việc đổi sang
// danh sách + khung đọc (Figma 9:2) thì Tổng quan chuyển về đây và vào qua bảng "Khác" của vỏ gia sư.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import TutorDashboard from "../TutorDashboard";

export const dynamic = "force-dynamic";

export default async function TongQuanPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/tong-quan");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
  return <TutorDashboard tutorId={session.userId} name={me?.name ?? "bạn"} />;
}
