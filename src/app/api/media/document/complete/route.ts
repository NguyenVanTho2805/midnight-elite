// A2 (BU-02) — chốt tệp tài liệu đã tải lên. Máy chủ TỰ lấy dung lượng thật (Admin API Cloudinary / stat đĩa), KHÔNG tin con số trình duyệt gửi, rồi ĐỌC ~4 KB ĐẦU TỆP và kiểm magic bytes
// (fileSniff). Sai nội dung so với đuôi (exe đổi tên .pdf, HTML đổi tên .png, zip đổi tên .docx...) hoặc vượt trần/hạn mức ⇒ XOÁ hàng ghi và xoá tệp lưu. Gọi lại khi đã ready ⇒ 200 như cũ.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTutorOnly } from "@/lib/tutorGateServer";
import { DOCUMENT_MAX_BYTES, DOCUMENT_QUOTA_BYTES, fileNameExt } from "@/lib/mediaStorage";
import { cloudinaryDestroy, cloudinaryEnv, cloudinaryReadHead, cloudinaryVerify, localPathFor, readLocalHead, removeLocal, statLocalBytes } from "@/lib/mediaStorageServer";
import { SNIFF_BYTES, sniffDocument } from "@/lib/fileSniff";
import { kinFileLink } from "@/lib/giaoTrinh";
import { usedDocumentBytes } from "@/lib/giaoTrinhServer";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const err = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

/** Xoá tệp lưu (best-effort) và hàng ghi: dùng khi tệp bị từ chối. */
async function discard(a: { id: string; driver: string; storageKey: string }) {
  if (a.driver === "cloudinary") { const env = cloudinaryEnv(); if (env && a.storageKey) await cloudinaryDestroy(env, a.storageKey, "raw"); }
  else if (a.storageKey) removeLocal(a.storageKey);
  await prisma.fileAsset.delete({ where: { id: a.id } }).catch(() => {});
}

export async function POST(req: NextRequest) {
  const auth = await requireTutorOnly();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null) as { assetId?: unknown } | null;
  if (!body || typeof body.assetId !== "string" || !body.assetId) return err("Thiếu mã tệp.", 400);

  const asset = await prisma.fileAsset.findUnique({ where: { id: body.assetId } });
  if (!asset || asset.kind !== "document") return err("Không tìm thấy tệp.", 404);
  if (asset.ownerId !== auth.userId) return err("Tệp này không phải của bạn.", 403);
  const link = kinFileLink(asset.id);
  if (asset.status === "ready") return NextResponse.json({ assetId: asset.id, bytes: asset.bytes, link, name: asset.originalName, mime: asset.mimeType }, { headers: NO_STORE });
  if (!asset.storageKey) return err("Tệp chưa tải xong.", 409);

  const ext = fileNameExt(asset.originalName);
  let bytes: number | null;
  let head: Uint8Array | null;
  if (asset.driver === "cloudinary") {
    const env = cloudinaryEnv();
    if (!env) return err("Kho tài liệu chưa cấu hình.", 503);
    const facts = await cloudinaryVerify(env, asset.storageKey, "raw");
    bytes = facts ? facts.bytes : null;
    if (bytes === null) return err("Chưa thấy tệp trên kho. Hãy tải lại.", 409);
    if (bytes > DOCUMENT_MAX_BYTES) { await discard(asset); return err("Tệp vượt giới hạn dung lượng.", 413); }
    head = await cloudinaryReadHead(env, asset.storageKey, SNIFF_BYTES);
    if (!head) return err("Chưa đọc được tệp trên kho. Hãy thử lại.", 409);
  } else {
    let path: string;
    try { path = localPathFor(asset.storageKey); } catch { return err("Tệp chưa tải xong.", 409); }
    bytes = statLocalBytes(path);
    if (bytes === null) return err("Chưa thấy tệp. Hãy tải lại.", 409);
    if (bytes > DOCUMENT_MAX_BYTES) { await discard(asset); return err("Tệp vượt giới hạn dung lượng.", 413); }
    head = readLocalHead(path, SNIFF_BYTES);
    if (!head) return err("Chưa đọc được tệp. Hãy tải lại.", 409);
  }
  if (bytes <= 0) { await discard(asset); return err("Tệp rỗng.", 400); }

  if ((await usedDocumentBytes(auth.userId)) + bytes > DOCUMENT_QUOTA_BYTES) { await discard(asset); return err("Kho tài liệu của bạn đã đầy. Hãy xoá bớt tệp chưa dùng.", 413); }

  const sniff = sniffDocument(head, ext);
  if (!sniff.ok) { await discard(asset); return err(sniff.error, 400); }

  const ready = await prisma.fileAsset.update({ where: { id: asset.id }, data: { status: "ready", bytes, mimeType: sniff.mime } });
  return NextResponse.json({ assetId: ready.id, bytes: ready.bytes, link, name: ready.originalName, mime: ready.mimeType }, { headers: NO_STORE });
}
