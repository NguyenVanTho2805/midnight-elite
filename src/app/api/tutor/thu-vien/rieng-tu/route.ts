// SCL-D (P2-6) — POST /api/tutor/thu-vien/rieng-tu { urls: string[] } — "Chuyển sang riêng tư" (một tệp hoặc hàng loạt) ở Thư viện của tôi.
// Mỗi link: phải là tệp cũ Cloudinary CÔNG KHAI (isLegacyPublicDoc) VÀ đang nằm trong tài liệu bài của LỚP MÌNH (chủ lớp) — không thì bỏ qua, không tải gì.
// Máy chủ tải tệp (chỉ từ res.cloudinary.com, không theo chuyển hướng, ≤ 25 MB, hết giờ 20 giây), kiểm magic bytes (fileSniff), hạn mức kho, lưu vào kho RIÊNG TƯ
// (đĩa cục bộ hoặc Cloudinary raw "authenticated") thành FileAsset ready, rồi đổi đường dẫn trong mọi bài của mình đang dùng link đó sang /api/media/<mã>/file.
// Tệp gốc trên Cloudinary cũ KHÔNG xoá ở đây (không có quyền xoá tệp tải bằng preset không ký); link cũ hết xuất hiện trong KiN. Trả JSON từng link (gọi bằng fetch, rồi tải lại trang).
import { writeFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTutorOnly } from "@/lib/tutorGateServer";
import { DOCUMENT_MAX_BYTES, DOCUMENT_QUOTA_BYTES } from "@/lib/mediaStorage";
import { cloudinaryDocPublicId, cloudinaryDocUploadInit, cloudinaryEnv, documentUploadConfig, ensureDirFor, localKeyFor, localPathFor } from "@/lib/mediaStorageServer";
import { SNIFF_BYTES, sniffDocument } from "@/lib/fileSniff";
import { kinFileLink } from "@/lib/giaoTrinh";
import { usedDocumentBytes } from "@/lib/giaoTrinhServer";
import { docNameFor, isLegacyPublicDoc, MAX_PRIVATIZE_PER_CALL, privatizeName, replaceDocUrl } from "@/lib/docPrivatize";

const NO_STORE = { "Cache-Control": "no-store" } as const;
type Result = { url: string; ok: boolean; error?: string; lessons?: number };

async function download(url: string): Promise<Uint8Array | string> {
  let r: Response;
  try { r = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000) }); }
  catch { return "Chưa tải được tệp cũ (mạng hoặc tệp không còn)."; }
  if (!r.ok || !r.body) return "Tệp cũ không còn trên kho cũ.";
  const declared = Number(r.headers.get("content-length") ?? "0");
  if (declared > DOCUMENT_MAX_BYTES) return "Tệp cũ nặng quá 25 MB.";
  const reader = r.body.getReader();
  const parts: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > DOCUMENT_MAX_BYTES) { await reader.cancel().catch(() => {}); return "Tệp cũ nặng quá 25 MB."; }
    parts.push(value);
  }
  const buf = new Uint8Array(total); let at = 0;
  for (const p of parts) { buf.set(p, at); at += p.byteLength; }
  return buf;
}

export async function POST(req: NextRequest) {
  const auth = await requireTutorOnly();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null) as { urls?: unknown } | null;
  const urls = Array.isArray(body?.urls) ? [...new Set(body!.urls.filter((u): u is string => typeof u === "string"))] : [];
  if (urls.length === 0) return NextResponse.json({ error: "Chưa chọn tài liệu nào." }, { status: 400, headers: NO_STORE });
  if (urls.length > MAX_PRIVATIZE_PER_CALL) return NextResponse.json({ error: `Mỗi lần chuyển tối đa ${MAX_PRIVATIZE_PER_CALL} tài liệu.` }, { status: 400, headers: NO_STORE });

  const cfg = documentUploadConfig();
  if (!cfg.enabled) return NextResponse.json({ error: "Kho tệp riêng tư chưa bật — chủ cần cấu hình." }, { status: 409, headers: NO_STORE });

  const results: Result[] = [];
  for (const url of urls) {
    if (!isLegacyPublicDoc(url)) { results.push({ url, ok: false, error: "Chỉ chuyển được tệp cũ đang công khai." }); continue; }
    // Chỉ bài trong lớp MÌNH làm chủ (gia sư khác / đồng giảng không đổi được tài liệu của lớp người khác).
    const lessons = (await prisma.lesson.findMany({
      where: { documents: { contains: url }, chapter: { section: { course: { ownerId: auth.userId } } } },
      select: { id: true, documents: true, chapter: { select: { section: { select: { courseId: true } } } } }, take: 200,
    })).filter(l => replaceDocUrl(l.documents, url, "x").changed > 0);
    if (lessons.length === 0) { results.push({ url, ok: false, error: "Không thấy tài liệu này trong bài của lớp bạn." }); continue; }

    const nm = privatizeName(docNameFor(lessons[0].documents, url), url);
    if (!nm) { results.push({ url, ok: false, error: "Loại tệp này không chuyển được." }); continue; }
    const bytes = await download(url);
    if (typeof bytes === "string") { results.push({ url, ok: false, error: bytes }); continue; }
    if (bytes.length === 0) { results.push({ url, ok: false, error: "Tệp cũ rỗng." }); continue; }
    const sniff = sniffDocument(bytes.subarray(0, SNIFF_BYTES), nm.ext);
    if (!sniff.ok) { results.push({ url, ok: false, error: sniff.error }); continue; }
    if ((await usedDocumentBytes(auth.userId)) + bytes.length > DOCUMENT_QUOTA_BYTES) { results.push({ url, ok: false, error: "Kho tài liệu của bạn đã đầy. Hãy xoá bớt tệp chưa dùng." }); continue; }

    const courseId = lessons[0].chapter.section.courseId;
    const asset = await prisma.fileAsset.create({ data: { ownerId: auth.userId, courseId, kind: "document", driver: cfg.driver, storageKey: "", mimeType: sniff.mime, originalName: nm.name, status: "pending" } });
    try {
      let key: string;
      if (cfg.driver === "cloudinary") {
        const env = cloudinaryEnv();
        if (!env) throw new Error("Kho tài liệu chưa cấu hình.");
        key = cloudinaryDocPublicId(courseId, asset.id, nm.ext);
        const up = cloudinaryDocUploadInit(env, key);
        const fd = new FormData();
        for (const [k, v] of Object.entries(up.fields)) fd.append(k, v);
        fd.append("file", new Blob([bytes as BlobPart]), nm.name);
        const r = await fetch(up.url, { method: "POST", body: fd, cache: "no-store", signal: AbortSignal.timeout(60_000) });
        if (!r.ok) throw new Error("Chưa lưu được vào kho riêng tư.");
      } else {
        key = localKeyFor(courseId, asset.id, nm.name);
        const path = localPathFor(key);
        ensureDirFor(path);
        writeFileSync(path, bytes);
      }
      await prisma.fileAsset.update({ where: { id: asset.id }, data: { storageKey: key, status: "ready", bytes: bytes.length, lessonId: lessons[0].id } });
    } catch (e) {
      await prisma.fileAsset.delete({ where: { id: asset.id } }).catch(() => {});
      results.push({ url, ok: false, error: e instanceof Error ? e.message : "Chưa lưu được vào kho riêng tư." });
      continue;
    }
    const link = kinFileLink(asset.id);
    for (const l of lessons) {
      const r = replaceDocUrl(l.documents, url, link);
      if (r.changed) await prisma.lesson.update({ where: { id: l.id }, data: { documents: r.json } });
    }
    results.push({ url, ok: true, lessons: lessons.length });
  }
  return NextResponse.json({ results, moved: results.filter(r => r.ok).length }, { headers: NO_STORE });
}
