import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateVideoUpload } from "@/lib/mediaStorage";
import { cloudinaryEnv, cloudinaryPublicId, cloudinaryUploadInit, localKeyFor, videoUploadConfig } from "@/lib/mediaStorageServer";
import { uploadLink } from "@/lib/mediaLink";

const MAX_PENDING_PER_OWNER = 10;
const MIME_BY_EXT: Record<string, string> = { mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm", mov: "video/quicktime" };

// POST /api/media/video/init — gia sư xin tải video lên. KHÔNG nhận byte ở đây: kiểm cờ, dung lượng, loại tệp, quyền với lớp và câu xác nhận
// bản quyền/riêng tư, tạo hàng FileAsset "pending", trả chỉ dẫn tải lên. Xong tải thì video chỉ học viên đã vào lớp xem được (xem /api/media/[id]/stream).
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const body = await req.json().catch(() => null) as { courseId?: unknown; fileName?: unknown; size?: unknown; mimeType?: unknown; confirmedNotice?: unknown } | null;
  if (!body || typeof body.courseId !== "string" || typeof body.fileName !== "string" || typeof body.size !== "number") {
    return NextResponse.json({ error: "Thiếu thông tin tệp video." }, { status: 400 });
  }
  // Bắt buộc: gia sư đã tích câu xác nhận (không có hình/giọng học sinh, là bài giảng của mình). Không tích thì không tải.
  if (body.confirmedNotice !== true) {
    return NextResponse.json({ error: "Bạn cần tích xác nhận video là bài giảng của bạn và không có hình hay giọng học sinh." }, { status: 400 });
  }

  const cfg = videoUploadConfig();
  const mimeIn = typeof body.mimeType === "string" ? body.mimeType : "";
  const check = validateVideoUpload({ name: body.fileName, size: body.size, type: mimeIn }, cfg);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: cfg.enabled ? 400 : 403 });

  const course = await prisma.course.findUnique({ where: { id: body.courseId }, select: { id: true, ownerId: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy lớp." }, { status: 404 });
  if (!ownsResource(auth, course.ownerId)) return NextResponse.json({ error: "Bạn không có quyền với lớp này." }, { status: 403 });

  const pending = await prisma.fileAsset.count({ where: { ownerId: auth.userId, status: "pending" } });
  if (pending >= MAX_PENDING_PER_OWNER) return NextResponse.json({ error: "Bạn có quá nhiều video đang tải dở. Hãy tải xong hoặc thử lại sau." }, { status: 429 });

  const ext = (body.fileName.split(".").pop() ?? "").toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "video/mp4";

  const asset = await prisma.fileAsset.create({
    data: { ownerId: auth.userId, courseId: course.id, kind: "video", driver: cfg.driver, storageKey: "", mimeType, originalName: body.fileName.slice(0, 200), status: "pending" },
  });

  if (cfg.driver === "cloudinary") {
    const env = cloudinaryEnv();
    if (!env) { await prisma.fileAsset.delete({ where: { id: asset.id } }); return NextResponse.json({ error: "Kho video chưa cấu hình." }, { status: 503 }); }
    const publicId = cloudinaryPublicId(course.id, asset.id);
    await prisma.fileAsset.update({ where: { id: asset.id }, data: { storageKey: publicId } });
    return NextResponse.json({ assetId: asset.id, link: uploadLink(asset.id), driver: "cloudinary", maxBytes: cfg.maxBytes, upload: cloudinaryUploadInit(env, publicId) });
  }

  const key = localKeyFor(course.id, asset.id, body.fileName);
  await prisma.fileAsset.update({ where: { id: asset.id }, data: { storageKey: key } });
  return NextResponse.json({ assetId: asset.id, link: uploadLink(asset.id), driver: "local", maxBytes: cfg.maxBytes, upload: { method: "PUT", url: `/api/media/upload/${asset.id}` } });
}
