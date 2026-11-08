// GET → nút "Tiếp tục với Facebook" có hiện không (cả hai biến môi trường đều có). Không lộ giá trị biến.
import { NextResponse } from "next/server";
import { facebookEnabled } from "@/lib/facebookAuth";

export async function GET() {
  return NextResponse.json({ facebook: facebookEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
