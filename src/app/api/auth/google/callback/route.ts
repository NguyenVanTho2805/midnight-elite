// GET ← Google chuyển người dùng về đây với ?code&state. Mọi lỗi đều chuyển về /dang-nhap?google=<mã> (câu chữ ở SOCIAL_NOTICES, không tên/email/số tiền).
// Luồng Google ở src/lib/googleAuth.ts; tìm/tạo/liên kết người dùng ở socialAuth.ts (dùng chung với Facebook). Phiên: createSession (cùng hàm /api/auth/login dùng).
// Đích: safeRedirect(cookie) ?? landingPath.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isAdminHost } from "@/lib/hostRouting";
import { landingPath } from "@/lib/landing";
import { safeRedirect } from "@/lib/safeRedirect";
import { resolveSocialUser } from "@/lib/socialAuth";
import { GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, googleEnabled, googleEndpoints, googleRedirectUri, profileFromIdToken, readFlowState, safeEqual } from "@/lib/googleAuth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectUri = googleRedirectUri(req);
  const origin = new URL(redirectUri).origin;
  const done = async (to: string) => {
    (await cookies()).set(GOOGLE_COOKIE, "", { httpOnly: true, path: GOOGLE_COOKIE_PATH, maxAge: 0 }); // dùng một lần, thành hay bại đều xoá
    const res = NextResponse.redirect(new URL(to, origin), 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  const fail = (code: string) => done(`/dang-nhap?google=${code}`);

  if (!googleEnabled()) return done("/dang-nhap");
  if (isAdminHost(req.headers.get("host") ?? "")) return fail("wrong-host"); // Google chỉ dành cho học sinh; cửa quản trị không nhận, và kiểm TRƯỚC khi ghi DB
  if (!rateLimit(`google-cb:${getClientIp(req)}`, 20, 60_000)) return fail("failed");

  try {
    if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "cancelled" : "failed");

    const cookieVal = req.headers.get("cookie")?.split(/;\s*/).find(c => c.startsWith(`${GOOGLE_COOKIE}=`))?.slice(GOOGLE_COOKIE.length + 1);
    const flow = await readFlowState(cookieVal ? decodeURIComponent(cookieVal) : undefined);
    const code = url.searchParams.get("code"), state = url.searchParams.get("state");
    if (!flow || !code || !state || !safeEqual(state, flow.state)) return fail("failed"); // state sai / thiếu cookie / hết hạn → không đổi mã

    const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
    const tokenRes = await fetch(googleEndpoints().token, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store", signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(), redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: flow.verifier,
      }),
    });
    if (!tokenRes.ok) return fail("failed");
    const tokens = await tokenRes.json().catch(() => null) as { id_token?: string } | null;
    const parsed = profileFromIdToken(tokens?.id_token, { clientId, nonce: flow.nonce });
    if (!parsed.ok) return fail(parsed.reason === "unverified" ? "unverified" : "failed");

    const r = await resolveSocialUser("google", { id: parsed.profile.sub, email: parsed.profile.email, name: parsed.profile.name });
    if (!r.ok) return fail(r.reason);
    await createSession({ userId: r.userId, role: r.role as "student" | "admin" });
    return done(safeRedirect(flow.redirect) ?? landingPath(r.role, r.adminRole));
  } catch (e) {
    console.error("[google/callback]", (e as Error).message);
    return fail("failed");
  }
}
