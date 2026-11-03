// A1 (BU-02) — gia sư xin tải MỘT tệp tài liệu lên KiN. KHÔNG nhận byte ở đây: kiểm quyền, câu xác nhận bản quyền, đuôi, MIME họ, dung lượng, hạn mức; tạo hàng FileAsset
// "pending"; trả chỉ dẫn tải lên. Tệp lưu RIÊNG TƯ (Cloudinary raw "authenticated" hoặc đĩa cục bộ), chỉ mở qua GET /api/media/<mã>/file sau khi kiểm quyền.
// Khác preset không ký cũ của trang quản trị (URL công khai, máy chủ không biết tệp). Chỉ gia sư ĐÃ DUYỆT và là chủ lớp.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTutorOnly } from "@/lib/tutorGateServer";
import { DOCUMENT_MIME_BY_EXT, fileNameExt, validateDocumentFile } from "@/lib/mediaStorage";
import { cloudinaryDocPublicId, cloudinaryDocUploadInit, cloudinaryEnv, documentUploadConfig, localKeyFor } from "@/lib/mediaStorageServer";
import { kinFileLink } from "@/lib/giaoTrinh";
import { COPYRIGHT_PLEDGE_LABEL } from "@/lib/classRecordings";
import { usedDocumentBytes } from "@/lib/giaoTrinhServer";

const MAX_PENDING_PER_OWNER = 10;
const NO_STORE = { "Cache-Control": "no-store" } as const;
const err = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  const auth = await requireTutorOnly();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null) as { courseId?: unknown; fileName?: unknown; size?: unknown; mimeType?: unknown; confirmedNotice?: unknown } | null;
  if (!body || typeof body.courseId !== "string" || !body.courseId || typeof body.fileName !== "string" || typeof body.size !== "number") return err("Thiếu thông tin tệp tài liệu.", 400);
  if (body.confirmedNotice !== true) return err(`Bạn cần tích xác nhận: ${COPYRIGHT_PLEDGE_LABEL}`, 400);

  const mimeIn = typeof body.mimeType === "string" ? body.mimeType : "";
  const check = validateDocumentFile({ name: body.fileName, size: body.size, type: mimeIn });
  if (!check.ok) return err(check.error, 400);

  const course = await prisma.course.findUnique({ where: { id: body.courseId }, select: { id: true, ownerId: true } });
  if (!course) return err("Không tìm thấy lớp.", 404);
  if (course.ownerId !== auth.userId) return err("Bạn không có quyền với lớp này.", 403);

  const cfg = documentUploadConfig();
  if (!cfg.enabled) return err(cfg.reason ?? "Tải tệp tài liệu lên chưa bật.", 409, { reason: cfg.reason });

  const pending = await prisma.fileAsset.count({ where: { ownerId: auth.userId, status: "pending" } });
  if (pending >= MAX_PENDING_PER_OWNER) return err("Bạn có quá nhiều tệp đang tải dở. Hãy tải xong hoặc thử lại sau.", 429);

  const used = await usedDocumentBytes(auth.userId);
  if (used + body.size > cfg.quotaBytes) return err(`Kho tài liệu của bạn đã gần đầy (đã dùng ${Math.round(used / 1048576)} MB trên ${Math.round(cfg.quotaBytes / 1048576)} MB). Hãy xoá bớt tệp chưa dùng.`, 413);

  const ext = fileNameExt(body.fileName);
  const asset = await prisma.fileAsset.create({
    data: { ownerId: auth.userId, courseId: course.id, kind: "document", driver: cfg.driver, storageKey: "", mimeType: DOCUMENT_MIME_BY_EXT[ext] ?? "application/octet-stream", originalName: body.fileName.replace(/[\u0000-\u001f]/g, " ").slice(0, 200), status: "pending" },
  });
  const link = kinFileLink(asset.id);

  if (cfg.driver === "cloudinary") {
    const env = cloudinaryEnv();
    if (!env) { await prisma.fileAsset.delete({ where: { id: asset.id } }); return err("Kho tài liệu chưa cấu hình.", 503); }
    const publicId = cloudinaryDocPublicId(course.id, asset.id, ext);
    await prisma.fileAsset.update({ where: { id: asset.id }, data: { storageKey: publicId } });
    return NextResponse.json({ assetId: asset.id, link, driver: "cloudinary", maxBytes: cfg.maxBytes, upload: cloudinaryDocUploadInit(env, publicId) }, { headers: NO_STORE });
  }
  const key = localKeyFor(course.id, asset.id, body.fileName);
  await prisma.fileAsset.update({ where: { id: asset.id }, data: { storageKey: key } });
  return NextResponse.json({ assetId: asset.id, link, driver: "local", maxBytes: cfg.maxBytes, upload: { method: "PUT", url: `/api/media/upload/${asset.id}` } }, { headers: NO_STORE });
}
