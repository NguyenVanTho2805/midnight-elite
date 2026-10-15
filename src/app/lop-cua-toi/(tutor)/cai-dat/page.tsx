// TT-203 — Cài đặt của gia sư: module hiển thị + tin nhắc lịch. Lưu theo TÀI KHOẢN.
// PH-215 — thêm mục Kết nối: nhóm Zalo của lớp, Messenger, hiện số Zalo trên hồ sơ (tắt sẵn).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readPreferences } from "@/lib/userPreferences";
import CaiDatClient from "./CaiDatClient";

export const dynamic = "force-dynamic";

export default async function CaiDatPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/cai-dat");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  const [me, classes] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true, phone: true } }),
    prisma.course.findMany({ where: { ownerId: session.userId }, select: { id: true, name: true, zaloGroupUrl: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return <CaiDatClient initial={readPreferences(me?.preferences)} classes={classes} phone={me?.phone ?? null} />;
}
