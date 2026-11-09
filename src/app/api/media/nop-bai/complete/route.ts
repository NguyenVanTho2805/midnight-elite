// BU-HS-NOP-TEP A3 — chốt tệp đã tải lên. Máy chủ TỰ đo dung lượng thật (Admin API Cloudinary / stat đĩa), TẢI TRỌN tệp (<10 MiB) và kiểm nội dung theo đuôi
// (docx: danh mục zip + chặn macro/nhúng/zip bomb; pdf: đầu/đuôi + chặn /Launch /JavaScript…), băm sha256, đếm lại tối đa 3 tệp (theo createdAt, id) rồi mới "ready".
// SAI Ở BẤT KỲ BƯỚC NÀO ⇒ xoá tệp gốc + xoá hàng. Gọi lại khi đã "ready" ⇒ 200 như cũ (idempotent). Người không phải chủ tệp ⇒ 404 (không lộ tồn tại).
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { NOP_TEP_ERRORS, NOP_TEP_MAX_FILES, NOP_TEP_MIME_BY_EXT, NOP_TEP_MSG_TOO_MANY, describeNopTepFile, isNopTepId, type NopTepCompleteResponse, type NopTepExt } from "@/lib/nopTep";
import { inspectNopTepContent } from "@/lib/nopTepInspect";
import { discardFile, graderGate, lockNopTep, measureStored, nopTepErr, nopTepJson, nopTepRuntimeConfig, readAllLimited, studentGate } from "@/lib/nopTepServer";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null) as { fileId?: unknown } | null;
  if (!body || !isNopTepId(body.fileId)) return nopTepErr("Thiếu mã tệp.", 400);

  const row = await prisma.submissionFile.findUnique({ where: { id: body.fileId } });
  if (!row || row.ownerUserId !== auth.userId) return nopTepErr("Không tìm thấy tệp.", 404);

  // Kiểm quyền mỗi lượt (học sinh đã nghỉ lớp / gia sư đã bị gỡ giữa chừng ⇒ không chốt được nữa).
  const gate = row.kind === "tutor_return" ? await graderGate(row.assignmentId) : await studentGate(row.assignmentId);
  if (!gate.ok) return gate.res;
  const now = new Date();
  const describe = (r: typeof row): NopTepCompleteResponse => ({ file: describeNopTepFile(r, { namesVisible: true, now }) });

  if (row.status === "ready") return nopTepJson(describe(row) as unknown as Record<string, unknown>);
  if (row.status !== "pending") return nopTepErr("Không tìm thấy tệp.", 404);
  if (row.storageKey.startsWith("tmp:")) return nopTepErr("Tệp chưa tải xong.", 409);

  const cfg = nopTepRuntimeConfig();
  const bytes = await measureStored(row);
  if (bytes === null) return nopTepErr("Chưa thấy tệp trên kho. Hãy tải lại.", 409);
  if (bytes <= 0) { await discardFile(row); return nopTepErr(NOP_TEP_ERRORS.empty, 400, { code: "empty" }); }
  if (bytes >= cfg.maxBytes) { await discardFile(row); return nopTepErr(NOP_TEP_ERRORS.too_big, 413, { code: "too_big" }); }

  const content = await readAllLimited(row, cfg.maxBytes);
  if (content === null) return nopTepErr("Chưa đọc được tệp trên kho. Hãy thử lại.", 409);
  if (content === "too_big" || content.length >= cfg.maxBytes) { await discardFile(row); return nopTepErr(NOP_TEP_ERRORS.too_big, 413, { code: "too_big" }); }
  if (content.length === 0) { await discardFile(row); return nopTepErr(NOP_TEP_ERRORS.empty, 400, { code: "empty" }); }

  const verdict = inspectNopTepContent(content, row.ext);
  if (!verdict.ok) { await discardFile(row); return nopTepErr(verdict.error, 400, { code: verdict.code }); }
  const sha256 = createHash("sha256").update(content).digest("hex");

  const result = await prisma.$transaction(async tx => {
    await lockNopTep(tx, row.assignmentId, row.studentUserId);
    const cur = await tx.submissionFile.findUnique({ where: { id: row.id } });
    if (!cur || cur.status === "removed" || cur.status === "expired") return { state: "gone" as const };
    if (cur.status === "ready") return { state: "ok" as const, row: cur };
    const peers = await tx.submissionFile.findMany({
      where: { assignmentId: row.assignmentId, studentUserId: row.studentUserId, kind: row.kind, ownerUserId: row.ownerUserId, submissionId: null, status: { in: ["pending", "ready"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: NOP_TEP_MAX_FILES + 10, select: { id: true },
    });
    const pos = peers.findIndex(p => p.id === row.id);
    if (pos < 0 || pos >= NOP_TEP_MAX_FILES) return { state: "too_many" as const };
    const upd = await tx.submissionFile.update({
      where: { id: row.id },
      data: { status: "ready", sizeBytes: content.length, sha256, mimeType: NOP_TEP_MIME_BY_EXT[row.ext as NopTepExt] ?? row.mimeType, readyAt: new Date() },
    });
    return { state: "ok" as const, row: upd };
  });
  if (result.state === "too_many") { await discardFile(row); return nopTepErr(NOP_TEP_MSG_TOO_MANY, 409, { code: "too_many" }); }
  if (result.state === "gone") return nopTepErr("Không tìm thấy tệp.", 404);
  return nopTepJson(describe(result.row) as unknown as Record<string, unknown>);
}
