// BU-HS-NOP-TEP A2 — nhận byte vào đĩa cục bộ. CHỈ driver "local" và KHÔNG ở production (production dùng Cloudinary: trình duyệt tải thẳng lên Cloudinary bằng chỉ dẫn đã ký).
// Chỉ chủ hàng "pending". Dung lượng được đếm KHI NHẬN (writeStreamLimited), không tin Content-Length: vượt trần ⇒ cắt luôn, xoá tệp dở và hàng ghi.
// Tệp vẫn "pending" cho tới khi POST /api/media/nop-bai/complete kiểm nội dung.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { localPathFor, writeStreamLimited } from "@/lib/mediaStorageServer";
import { isNopTepId } from "@/lib/nopTep";
import { discardFile, nopTepErr, nopTepJson, nopTepRuntimeConfig } from "@/lib/nopTepServer";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { fileId } = await params;
  if (!isNopTepId(fileId)) return nopTepErr("Không tìm thấy phiên tải lên.", 404);
  if (process.env.NODE_ENV === "production") return nopTepErr("Không tìm thấy phiên tải lên.", 404);
  const cfg = nopTepRuntimeConfig();
  if (!cfg.enabled || cfg.driver !== "local") return nopTepErr("Không tìm thấy phiên tải lên.", 404);

  const row = await prisma.submissionFile.findUnique({ where: { id: fileId }, select: { id: true, ownerUserId: true, driver: true, status: true, storageKey: true } });
  if (!row || row.ownerUserId !== auth.userId || row.driver !== "local") return nopTepErr("Không tìm thấy phiên tải lên.", 404);
  if (row.status !== "pending" || row.storageKey.startsWith("tmp:")) return nopTepErr("Phiên tải lên này đã xong hoặc không còn.", 409);
  if (!req.body) return nopTepErr("Thiếu dữ liệu tệp.", 400);

  // "Dưới 10 MB": đúng 10 MiB cũng bị từ chối ⇒ trần ghi là maxBytes − 1.
  const cap = cfg.maxBytes - 1;
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > cap) { await discardFile(row); return nopTepErr("Tệp lớn hơn 10 MB. Hãy nén ảnh trong bài hoặc chia nhỏ tệp.", 413, { code: "too_big" }); }

  let result: number | "too_big";
  try { result = await writeStreamLimited(req.body, localPathFor(row.storageKey), cap); }
  catch (e) {
    console.error("[PUT /api/media/nop-bai/dai]", fileId, (e as Error)?.name);   // không log tên tệp
    await discardFile(row);
    return nopTepErr("Tải tệp thất bại, hãy thử lại.", 500);
  }
  if (result === "too_big") { await discardFile(row); return nopTepErr("Tệp lớn hơn 10 MB. Hãy nén ảnh trong bài hoặc chia nhỏ tệp.", 413, { code: "too_big" }); }
  if (result <= 0) { await discardFile(row); return nopTepErr("Tệp rỗng, không tải lên được.", 400, { code: "empty" }); }

  await prisma.submissionFile.update({ where: { id: row.id }, data: { sizeBytes: result } });
  return nopTepJson({ fileId: row.id, sizeBytes: result });
}
