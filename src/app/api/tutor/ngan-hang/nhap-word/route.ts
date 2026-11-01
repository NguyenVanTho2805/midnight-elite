// BU-03 P1 — POST /api/tutor/ngan-hang/nhap-word (multipart `file` = .docx mẫu Azota) → AzotaParse + images[{key,url}].
// CHỈ XEM TRƯỚC: không ghi DB, không AI (không reserveAiExtract, không Gemini, không nhúng), không trừ lượt nào.
// Hình raster (png/jpg/gif/webp) lấy từ Word được tải lên Cloudinary (uploadImageBufferToCloudinary); mỗi câu giữ 1 hình.
// 400 NOT_DOCX · 413 TOO_LARGE · 422 TOO_MANY.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { DOCX_MAX_BYTES } from "@/lib/azotaDocxRead";
import { analyseDocx, failResponse } from "@/lib/deThiServer"; // bộ đọc Word dùng chung với "Tách tệp đề gốc" (deThiServer.analyseDocx)

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

    const out = await analyseDocx(Buffer.from(await file.arrayBuffer()));
    if (!out.ok) return failResponse(out);
    return NextResponse.json(out.parsed, { headers: NO_STORE });
  } catch (e) {
    console.error("[POST /api/tutor/ngan-hang/nhap-word]", e);
    return err(500, "Chưa đọc được tệp Word. Thử lại sau ít phút.");
  }
}
