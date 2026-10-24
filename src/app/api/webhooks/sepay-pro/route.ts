// KiN Pro — webhook SePay xác nhận thanh toán gói Pro. KHÁC webhook học phí (/api/webhooks/sepay/[tutorId]): địa chỉ riêng, khoá lấy từ BIẾN MÔI TRƯỜNG
// (KINPRO_SEPAY_API_KEY, SePay gửi `Authorization: Apikey <khoá>`), tiền tố mã đơn riêng (KINPRO_CODE_PREFIX, mặc định "KINPRO-"), bảng ghi riêng (ProPayment).
//
// TẮT (503, không đụng DB) khi: thiếu khoá, thiếu tài khoản nhận tiền KINPRO_*, tiền tố mã có thể nhầm với mã phiếu học phí; bản xem trước (VERCEL_ENV=preview) → 403.
// Mỗi lần nhận:
//   1. Kiểm khoá (so thời gian không đổi). Sai → 401 (mỗi IP tối đa 30 lần sai/phút).
//   2. Chỉ nhận tiền VÀO. Nếu SePay báo số tài khoản nhận và khác tài khoản KiN Pro đã cấu hình → bỏ qua, không ghi.
//   3. Chống trùng theo (sepay, mã giao dịch). Gọi lại → 200 {duplicate:true}, không kích hoạt lần hai.
//   4. Khớp theo MÃ ĐƠN trong nội dung. Chỉ kích hoạt khi mã đúng, yêu cầu còn chờ và số tiền BẰNG ĐÚNG; còn lại ghi "review" cho admin duyệt tay. Không tự hoàn tiền.
//   5. Lỗi hệ thống → 500 để SePay gửi lại (an toàn vì bước 3).
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, limitOrBlock, rateLimit } from "@/lib/rate-limit";
import { extractApiKey, parseSepayPayload } from "@/lib/tuitionInvoice";
import { proWebhookConfig, verifyEnvApiKey } from "@/lib/proPayment";
import { settleProPayment } from "@/lib/proPaymentServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const cfg = proWebhookConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ success: false, error: cfg.reason === "preview" ? "preview" : "disabled" }, { status: cfg.reason === "preview" ? 403 : 503, headers: NO_STORE });
  }
  const blocked = limitOrBlock("sepay-pro", "sepay-pro-webhook", 300, 60_000);
  if (blocked) return blocked;

  if (!verifyEnvApiKey(extractApiKey(req.headers.get("authorization")), cfg.apiKey)) {
    if (!rateLimit(`sepay-pro-fail:${getClientIp(req)}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: "too many requests" }, { status: 429, headers: NO_STORE });
    }
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseSepayPayload(body);
  if ("ignore" in parsed) return NextResponse.json({ success: true, ignored: true }, { headers: NO_STORE });
  if ("error" in parsed) return NextResponse.json({ success: false, error: parsed.error }, { status: 400, headers: NO_STORE });

  const acct = (body as Record<string, unknown>).accountNumber;
  if (typeof acct === "string" && acct.trim() && cfg.accountNo && acct.replace(/\s+/g, "") !== cfg.accountNo) {
    return NextResponse.json({ success: true, ignored: true }, { headers: NO_STORE }); // tiền vào tài khoản khác cùng khoá SePay, không phải của KiN Pro
  }

  try {
    const r = await settleProPayment(parsed.tx, cfg.prefix);
    return NextResponse.json({ success: true, ...(r.outcome === "duplicate" ? { duplicate: true } : {}) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[POST /api/webhooks/sepay-pro]", e);
    return NextResponse.json({ success: false, error: "internal" }, { status: 500, headers: NO_STORE });
  }
}
