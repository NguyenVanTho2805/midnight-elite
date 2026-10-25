import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { localPathFor, videoUploadConfig, writeStreamLimited, removeLocal } from "@/lib/mediaStorageServer";

// PUT /api/media/upload/[id] — nhận byte video vào đĩa cục bộ (chỉ khi kho là "local"). Chỉ chủ hàng FileAsset, chỉ khi còn "pending".
// Dung lượng được đếm KHI NHẬN, không tin Content-Length: vượt giới hạn là cắt luôn và xoá tệp dở.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;

  const cfg = videoUploadConfig();
  if (!cfg.enabled || cfg.driver !== "local") return NextResponse.json({ error: cfg.reason ?? "Kho cục bộ đang tắt." }, { status: 403 });

  const asset = await prisma.fileAsset.findUnique({ where: { id } });
  if (!asset || asset.ownerId !== auth.userId || asset.kind !== "video" || asset.driver !== "local") return NextResponse.json({ error: "Không tìm thấy phiên tải lên." }, { status: 404 });
  if (asset.status !== "pending" || !asset.storageKey) return NextResponse.json({ error: "Phiên tải lên này đã xong hoặc không còn." }, { status: 409 });
  if (!req.body) return NextResponse.json({ error: "Thiếu dữ liệu video." }, { status: 400 });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > cfg.maxBytes) return NextResponse.json({ error: "Video vượt giới hạn dung lượng." }, { status: 413 });

  let result: number | "too_big";
  try { result = await writeStreamLimited(req.body, localPathFor(asset.storageKey), cfg.maxBytes); }
  catch (e) { console.error("[PUT /api/media/upload]", id, e); removeLocal(asset.storageKey); return NextResponse.json({ error: "Tải video thất bại, hãy thử lại." }, { status: 500 }); }
  if (result === "too_big") return NextResponse.json({ error: "Video vượt giới hạn dung lượng." }, { status: 413 });
  if (result <= 0) { removeLocal(asset.storageKey); return NextResponse.json({ error: "Tệp rỗng." }, { status: 400 }); }

  const ready = await prisma.fileAsset.update({ where: { id }, data: { status: "ready", bytes: result }, select: { id: true, bytes: true } });
  return NextResponse.json({ assetId: ready.id, bytes: ready.bytes, link: `kin-media:${ready.id}` });
}
