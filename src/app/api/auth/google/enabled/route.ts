// GET → nút "Tiếp tục với Google" có hiện không (cả hai biến môi trường đều có). Không lộ giá trị biến.
import { NextResponse } from "next/server";
import { googleEnabled } from "@/lib/googleAuth";

export async function GET() {
  return NextResponse.json({ google: googleEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
