// GET ← Facebook chuyển về đây với ?code&state. Lỗi nào cũng về /dang-nhap?facebook=<mã> (câu chữ ở SOCIAL_NOTICES). Luật: src/lib/socialAuth.ts (không tự liên kết theo email).
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isAdminHost } from "@/lib/hostRouting";
import { landingPath } from "@/lib/landing";
import { safeRedirect } from "@/lib/safeRedirect";
import { COOKIE_PATH, readFlow, resolveSocialUser, safeEqual } from "@/lib/socialAuth";
import { FACEBOOK_COOKIE, facebookEnabled, facebookEndpoints, facebookRedirectUri, profileFromGraph } from "@/lib/facebookAuth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectUri = facebookRedirectUri(req);
  const origin = new URL(redirectUri).origin;
  const done = async (to: string) => {
    (await cookies()).set(FACEBOOK_COOKIE, "", { httpOnly: true, path: COOKIE_PATH.facebook, maxAge: 0 }); // dùng một lần, thành hay bại đều xoá
    const res = NextResponse.redirect(new URL(to, origin), 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  const fail = (code: string) => done(`/dang-nhap?facebook=${code}`);

  if (!facebookEnabled()) return done("/dang-nhap");
  if (isAdminHost(req.headers.get("host") ?? "")) return fail("wrong-host");
  if (!rateLimit(`facebook-cb:${getClientIp(req)}`, 20, 60_000)) return fail("failed");

  try {
    if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "cancelled" : "failed");
    const raw = req.headers.get("cookie")?.split(/;\s*/).find(c => c.startsWith(`${FACEBOOK_COOKIE}=`))?.slice(FACEBOOK_COOKIE.length + 1);
    const flow = await readFlow("facebook", raw ? decodeURIComponent(raw) : undefined);
    const code = url.searchParams.get("code"), state = url.searchParams.get("state");
    if (!flow || !code || !state || !safeEqual(state, flow.state)) return fail("failed");

    const ep = facebookEndpoints();
    const tok = new URL(ep.token);
    tok.search = new URLSearchParams({ client_id: process.env.FACEBOOK_APP_ID!.trim(), client_secret: process.env.FACEBOOK_APP_SECRET!.trim(), redirect_uri: redirectUri, code }).toString();
    const tokenRes = await fetch(tok, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!tokenRes.ok) return fail("failed");
    const accessToken = ((await tokenRes.json().catch(() => null)) as { access_token?: string } | null)?.access_token;
    if (!accessToken) return fail("failed");

    const me = new URL(ep.me);
    me.search = new URLSearchParams({ fields: "id,name,email" }).toString();
    const meRes = await fetch(me, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!meRes.ok) return fail("failed");
    const profile = profileFromGraph(await meRes.json().catch(() => null));
    if (!profile) return fail("failed");

    const r = await resolveSocialUser("facebook", profile);
    if (!r.ok) return fail(r.reason);
    await createSession({ userId: r.userId, role: r.role as "student" | "admin" });
    return done(safeRedirect(flow.redirect) ?? landingPath(r.role, r.adminRole));
  } catch (e) {
    console.error("[facebook/callback]", (e as Error).message);
    return fail("failed");
  }
}
