// T23: phiên 30 ngày tự gia hạn — ký lại cookie khi phiên đã cấp hơn 1 ngày.
// Giữ nguyên `bd` (lúc bắt đầu phiên) để chủ thu hồi phiên vẫn có hiệu lực (server/phien.ts).
// Proxy KHÔNG kiểm quyền: mọi route tự kiểm ở máy chủ.
import { NextResponse, type NextRequest } from "next/server";
import { cookieOpt, docPhien, kyPhien, TEN_COOKIE } from "@/server/token";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const p = await docPhien(req.cookies.get(TEN_COOKIE)?.value);
  if (p && Date.now() / 1000 - p.iat > 24 * 3600) res.cookies.set(TEN_COOKIE, await kyPhien(p), cookieOpt);
  return res;
}

export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
