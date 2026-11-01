// A5 (BU-02) — chủ tệp xoá một tệp tài liệu CHƯA DÙNG. Còn bài nào tham chiếu `/api/media/<mã>/file` ⇒ 409 (trạng thái không đổi). Người khác 403. Xoá cả tệp lưu (best-effort).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTutorOnly } from "@/lib/tutorGateServer";
import { cloudinaryDestroy, cloudinaryEnv, removeLocal } from "@/lib/mediaStorageServer";
import { kinFileLink } from "@/lib/giaoTrinh";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const err = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutorOnly();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return err("Không tìm thấy tệp.", 404);

  const asset = await prisma.fileAsset.findUnique({ where: { id } });
  if (!asset || asset.kind !== "document") return err("Không tìm thấy tệp.", 404);
  if (asset.ownerId !== auth.userId) return err("Tệp này không phải của bạn.", 403);

  const using = await prisma.lesson.count({ where: { documents: { contains: kinFileLink(id) } } });
  if (using > 0) return err(`Đang dùng ở ${using} bài`, 409);

  if (asset.driver === "cloudinary") { const env = cloudinaryEnv(); if (env && asset.storageKey) await cloudinaryDestroy(env, asset.storageKey, "raw"); }
  else if (asset.storageKey) removeLocal(asset.storageKey);
  await prisma.fileAsset.delete({ where: { id } });
  return NextResponse.json({ removed: true }, { headers: NO_STORE });
}
