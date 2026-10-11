// TT-203 — Cài đặt của gia sư: module hiển thị + tin nhắc lịch. Lưu theo TÀI KHOẢN.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readPreferences } from "@/lib/userPreferences";
import CaiDatClient from "./CaiDatClient";

export const dynamic = "force-dynamic";

export default async function CaiDatPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?next=/lop-cua-toi/cai-dat");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true } });
  return <CaiDatClient initial={readPreferences(me?.preferences)} />;
}
