// QZ — tải bảng Excel MẪU nhập câu hỏi (GET, chỉ gia sư). Không có dữ liệu cá nhân nào trong tệp; vẫn đòi đăng nhập gia sư cho đồng bộ với các route quiz khác.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { TEMPLATE_FILENAME, XLSX_MIME, quizSheetTemplate } from "@/lib/quizSheetTemplate";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const bytes = await quizSheetTemplate();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${TEMPLATE_FILENAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[GET quiz mau-excel]", e);
    return NextResponse.json({ error: "Chưa dựng được bảng mẫu. Thử lại sau ít phút." }, { status: 500 });
  }
}
