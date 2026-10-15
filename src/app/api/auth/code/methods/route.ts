// GET → các cách nhận mã đăng nhập đang mở. Email luôn mở; số điện thoại chỉ mở khi đã cấu hình SMS (src/lib/sms.ts).
import { NextResponse } from "next/server";
import { smsEnabled } from "@/lib/sms";

export async function GET() {
  return NextResponse.json({ email: true, phone: smsEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
