// FE-141..144 — Tổng quan của gia sư. Điều hướng B1 (08/11/2026): Hộp việc (/lop-cua-toi) là trang chủ DUY NHẤT; số liệu của Tổng quan đã dời lên đầu Hộp việc
// (TutorOverviewStats), nên đường này chuyển 307 về /lop-cua-toi. Ngoại lệ: gia sư đã TẮT module Hộp việc (chế độ gọn) thì /lop-cua-toi đưa họ sang Lịch,
// và Tổng quan là lối DUY NHẤT tới các con số này — nên với họ trang vẫn hiện (và vỏ giữ mục "Tổng quan" trong bảng Khác chỉ khi Hộp việc tắt).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { prisma } from "@/lib/prisma";
import { readPreferences, isTutorModuleVisible } from "@/lib/userPreferences";
import TutorDashboard from "../TutorDashboard";

export const dynamic = "force-dynamic";

export default async function TongQuanPage() {
  const session = await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/tong-quan" });
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, preferences: true } });
  if (isTutorModuleVisible(readPreferences(me?.preferences), "hop-viec")) redirect("/lop-cua-toi");
  return <TutorDashboard tutorId={session.userId} name={me?.name ?? "bạn"} />;
}
