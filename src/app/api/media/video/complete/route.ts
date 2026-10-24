import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { cloudinaryEnv, cloudinaryVerify, videoUploadConfig } from "@/lib/mediaStorageServer";

// POST /api/media/video/complete — chốt video đã tải thẳng lên Cloudinary. Máy chủ TỰ hỏi Cloudinary xem tệp có thật và nặng bao nhiêu,
// không tin số trình duyệt gửi; vượt giới hạn thì xoá hàng ghi (tệp thừa phải dọn bên Cloudinary). Kho "local" chốt ngay ở bước PUT.
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null) as { assetId?: unknown } | null;
  if (!body || typeof body.assetId !== "string") return NextResponse.json({ error: "Thiếu mã video." }, { status: 400 });

  const asset = await prisma.fileAsset.findUnique({ where: { id: body.assetId } });
  if (!asset || asset.ownerId !== auth.userId || asset.kind !== "video") return NextResponse.json({ error: "Không tìm thấy video." }, { status: 404 });
  if (asset.status === "ready") return NextResponse.json({ assetId: asset.id, bytes: asset.bytes, link: `kin-media:${asset.id}` });
  if (asset.driver !== "cloudinary") return NextResponse.json({ error: "Video chưa tải xong." }, { status: 409 });

  const env = cloudinaryEnv();
  if (!env) return NextResponse.json({ error: "Kho video chưa cấu hình." }, { status: 503 });
  const facts = await cloudinaryVerify(env, asset.storageKey);
  if (!facts) return NextResponse.json({ error: "Chưa thấy video trên kho. Hãy tải lại." }, { status: 409 });
  const cfg = videoUploadConfig();
  if (facts.bytes > cfg.maxBytes) {
    await prisma.fileAsset.delete({ where: { id: asset.id } });
    return NextResponse.json({ error: "Video vượt giới hạn dung lượng." }, { status: 413 });
  }
  const ready = await prisma.fileAsset.update({ where: { id: asset.id }, data: { status: "ready", bytes: facts.bytes } });
  return NextResponse.json({ assetId: ready.id, bytes: ready.bytes, link: `kin-media:${ready.id}` });
}
