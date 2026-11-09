// BU-HS-NOP-TEP A1 — xin chỗ tải MỘT tệp bài nộp (học sinh, kind "student") hoặc tệp trả bài (gia sư, kind "tutor_return"). KHÔNG nhận byte ở đây.
// Kiểm: phiên → cấu hình bật → tốc độ → thân yêu cầu → đuôi/MIME họ/dung lượng (nopTep.ts) → quyền theo vai → tối đa 3 tệp CHƯA nộp mỗi (bài, học sinh) (khoá tương tranh).
// Tạo hàng "pending"; storageKey do MÁY CHỦ sinh (không từ tên tệp). Trả { fileId, driver, maxBytes, upload } — KHÔNG trả storageKey.
// (Cloudinary: chỉ dẫn tải lên có `public_id` vì Cloudinary cần nó để ký; đó là chính tệp của người tải, không phải đường mở tệp.)
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { cloudinaryDocUploadInit, cloudinaryEnv } from "@/lib/mediaStorageServer";
import {
  NOP_TEP_API, NOP_TEP_MAX_FILES, NOP_TEP_MIME_BY_EXT, NOP_TEP_MSG_TOO_MANY, NOP_TEP_PENDING_TTL_HOURS, isNopTepId, nopTepExpiresAt, nopTepStoredName, validateNopTepRequest,
  type NopTepInitResponse,
} from "@/lib/nopTep";
import { cloudinaryNopTepPublicId, deleteStored, graderGate, lockNopTep, nopTepErr, nopTepJson, nopTepRuntimeConfig, studentGate } from "@/lib/nopTepServer";
import { unusableId } from "@/lib/courseAccessServer";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const cfg = nopTepRuntimeConfig();
  if (!cfg.enabled) return nopTepErr(cfg.reason ?? "Tính năng nộp tệp chưa bật.", 409, { reason: cfg.reason });
  if (!rateLimit(`nop-tep-init:${auth.userId}`, 60, 60_000)) return nopTepErr("Bạn thao tác hơi nhanh, đợi một chút.", 429);

  const body = await req.json().catch(() => null) as { kind?: unknown; assignmentId?: unknown; submissionId?: unknown; name?: unknown; size?: unknown; type?: unknown } | null;
  if (!body || (body.kind !== "student" && body.kind !== "tutor_return") || typeof body.assignmentId !== "string" || unusableId(body.assignmentId) || typeof body.name !== "string") return nopTepErr("Thiếu thông tin tệp.", 400);
  const kind = body.kind;
  const assignmentId = body.assignmentId;

  const check = validateNopTepRequest({ name: body.name, size: body.size, type: body.type }, cfg);
  if (!check.ok) return nopTepErr(check.error, 400, { code: check.code });
  const ext = check.ext;

  let courseId: string, studentUserId: string;
  if (kind === "student") {
    const gate = await studentGate(assignmentId);
    if (!gate.ok) return gate.res;
    courseId = gate.scope.courseId;
    studentUserId = auth.userId;
  } else {
    const gate = await graderGate(assignmentId);
    if (!gate.ok) return gate.res;
    if (typeof body.submissionId !== "string" || unusableId(body.submissionId)) return nopTepErr("Thiếu bài nộp cần trả.", 400);
    const sub = await prisma.assignmentSubmission.findUnique({ where: { id: body.submissionId }, select: { userId: true, assignmentId: true } });
    if (!sub || sub.assignmentId !== assignmentId) return nopTepErr("Không tìm thấy bài nộp", 404);
    courseId = gate.scope.courseId;
    studentUserId = sub.userId;
  }

  // Dọn tệp tải dở quá 24 giờ của CHÍNH người này (cron cũng dọn; ở đây để không chiếm chỗ trong hạn mức 3 tệp).
  const now = new Date();
  const stale = await prisma.submissionFile.findMany({
    where: { ownerUserId: auth.userId, status: "pending", submissionId: null, createdAt: { lt: new Date(now.getTime() - NOP_TEP_PENDING_TTL_HOURS * 3_600_000) } },
    select: { id: true, driver: true, storageKey: true }, take: 20,
  });
  for (const s of stale) {
    if (await deleteStored(s)) await prisma.submissionFile.updateMany({ where: { id: s.id, status: "pending" }, data: { status: "expired", expiredAt: now, deletedAt: now } });
  }

  const driver = cfg.driver === "cloudinary" ? "cloudinary" : "local";
  const createdAt = new Date();
  const created = await prisma.$transaction(async tx => {
    await lockNopTep(tx, assignmentId, studentUserId);
    const live = await tx.submissionFile.count({ where: { assignmentId, studentUserId, kind, ownerUserId: auth.userId, submissionId: null, status: { in: ["pending", "ready"] } } });
    if (live >= NOP_TEP_MAX_FILES) return null;
    const row = await tx.submissionFile.create({
      data: {
        kind, assignmentId, studentUserId, ownerUserId: auth.userId, courseId, driver,
        storageKey: `tmp:${randomUUID()}`,                       // thay ngay bên dưới bằng khoá có mã tệp; @unique nên không trùng
        originalName: nopTepStoredName(body.name, ext), ext, mimeType: NOP_TEP_MIME_BY_EXT[ext],
        status: "pending", createdAt, expiresAt: nopTepExpiresAt(createdAt),
      },
      select: { id: true },
    });
    const key = cloudinaryNopTepPublicId(courseId, assignmentId, row.id, ext);
    await tx.submissionFile.update({ where: { id: row.id }, data: { storageKey: key } });
    return { id: row.id, key };
  });
  if (!created) return nopTepErr(NOP_TEP_MSG_TOO_MANY, 409, { code: "too_many" });
  if (!isNopTepId(created.id)) return nopTepErr("Không tạo được chỗ tải.", 500);

  if (driver === "cloudinary") {
    const env = cloudinaryEnv();
    if (!env) { await prisma.submissionFile.delete({ where: { id: created.id } }).catch(() => {}); return nopTepErr("Kho tệp chưa cấu hình.", 503); }
    const out: NopTepInitResponse = { fileId: created.id, driver, maxBytes: cfg.maxBytes, upload: cloudinaryDocUploadInit(env, created.key) };
    return nopTepJson(out as unknown as Record<string, unknown>);
  }
  const out: NopTepInitResponse = { fileId: created.id, driver, maxBytes: cfg.maxBytes, upload: { method: "PUT", url: NOP_TEP_API.localPut(created.id) } };
  return nopTepJson(out as unknown as Record<string, unknown>);
}
