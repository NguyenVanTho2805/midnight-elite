// BU-03 P1 — POST /api/tutor/ngan-hang/nhap-word (multipart `file` = .docx mẫu Azota) → AzotaParse + images[{key,url}].
// CHỈ XEM TRƯỚC: không ghi DB, không AI (không reserveAiExtract, không Gemini, không nhúng), không trừ lượt nào.
// Hình raster (png/jpg/gif/webp) lấy từ Word được tải lên Cloudinary (uploadImageBufferToCloudinary); mỗi câu giữ 1 hình.
// 400 NOT_DOCX · 413 TOO_LARGE · 422 TOO_MANY.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { DOCX_MAX_BYTES, DOCX_MAX_IMAGES, DocxError, readDocx } from "@/lib/azotaDocxRead";
import { AZOTA_MAX_QUESTIONS, parseAzotaBlocks, type AzotaParse } from "@/lib/azotaDocx";
import { cloudinaryServerConfigured, uploadImageBufferToCloudinary } from "@/lib/cloudinaryServer";

const NO_STORE = { "Cache-Control": "no-store" };
export const maxDuration = 60;

const err = (status: number, error: string, code?: string) => NextResponse.json({ error, ...(code ? { code } : {}) }, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > DOCX_MAX_BYTES + 512 * 1024) return err(413, "Tệp Word lớn hơn 4 MB. Cô tách đề nhỏ hơn rồi tải lại nhé.", "TOO_LARGE");
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return err(400, "Chưa chọn tệp Word (.docx).", "NOT_DOCX");
    if (file.size > DOCX_MAX_BYTES) return err(413, "Tệp Word lớn hơn 4 MB. Cô tách đề nhỏ hơn rồi tải lại nhé.", "TOO_LARGE");

    let read;
    try { read = await readDocx(Buffer.from(await file.arrayBuffer())); }
    catch (e) {
      if (e instanceof DocxError) return err(e.code === "TOO_LARGE" ? 413 : 400, e.message, e.code);
      throw e;
    }
    const parsed = parseAzotaBlocks(read.blocks);
    if (read.extraImages > 0) parsed.warnings.push({ question: "", code: "too_many_images", message: `Tệp có quá ${DOCX_MAX_IMAGES} hình; ${read.extraImages} hình thừa không được lấy. Chèn lại bằng tay ở những câu còn thiếu hình.` });
    if (parsed.questions.length > AZOTA_MAX_QUESTIONS || (parsed.fatal && /quá giới hạn/.test(parsed.fatal))) {
      return err(422, parsed.fatal ?? `Tệp có quá ${AZOTA_MAX_QUESTIONS} câu.`, "TOO_MANY");
    }

    // Tải hình (mỗi hình một lần dù nhiều câu dùng chung), tối đa 4 lượt song song.
    const urlByIndex = new Map<number, string>();
    const wanted = [...new Set(parsed.questions.flatMap(q => (q.imageIndex !== undefined ? [q.imageIndex] : [])))];
    let cursor = 0;
    const failed = new Set<number>();
    const worker = async () => {
      for (;;) {
        const i = wanted[cursor++];
        if (i === undefined) return;
        const buf = read.images[i], mime = read.mime[i];
        if (!buf || !mime || !cloudinaryServerConfigured) { failed.add(i); continue; }
        try { urlByIndex.set(i, await uploadImageBufferToCloudinary(buf, `word-${Date.now().toString(36)}-${i}.${mime.split("/")[1].replace("jpeg", "jpg")}`, mime)); }
        catch (e) { console.error("[nhap-word] upload ảnh", e); failed.add(i); }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    const images: { key: string; url: string }[] = [];
    for (const q of parsed.questions) {
      if (q.imageIndex === undefined) continue;
      const url = urlByIndex.get(q.imageIndex);
      if (url) { q.imageUrl = url; images.push({ key: q.key, url }); }
      else {
        if (!q.flags.includes("image_unreadable")) q.flags.push("image_unreadable");
        parsed.warnings.push({ question: q.key, code: "image_upload_failed", message: `Câu ${q.number}: chưa tải được hình lên. Chèn lại hình ở bước chỉnh sửa.` });
      }
      delete q.imageIndex;
    }
    const out: AzotaParse & { images: { key: string; url: string }[] } = { ...parsed, stats: { ...parsed.stats, withImage: parsed.questions.filter(q => !!q.imageUrl).length }, images };
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e) {
    console.error("[POST /api/tutor/ngan-hang/nhap-word]", e);
    return err(500, "Chưa đọc được tệp Word. Thử lại sau ít phút.");
  }
}
