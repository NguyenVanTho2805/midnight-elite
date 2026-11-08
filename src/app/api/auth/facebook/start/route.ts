// GET → chuyển sang Facebook Login. Chỉ đặt cookie trạng thái ngắn hạn, không ghi gì vào DB. ?redirect= chỉ nhận đường nội bộ.
import { NextResponse } from "next/server";
import { isAdminHost } from "@/lib/hostRouting";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { safeRedirect } from "@/lib/safeRedirect";
import { COOKIE_PATH, STATE_TTL_SEC, randomToken, signFlow } from "@/lib/socialAuth";
import { FACEBOOK_COOKIE, buildFacebookAuthUrl, facebookEnabled, facebookEndpoints, facebookRedirectUri } from "@/lib/facebookAuth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (code: string) => NextResponse.redirect(new URL(`/dang-nhap?facebook=${code}`, url), 303);
  if (!facebookEnabled()) return NextResponse.redirect(new URL("/dang-nhap", url), 303);
  if (isAdminHost(req.headers.get("host") ?? "")) return fail("wrong-host");
  if (!rateLimit(`facebook-start:${getClientIp(req)}`, 20, 60_000)) return fail("failed");
  try {
    const state = randomToken();
    const redirect = safeRedirect(url.searchParams.get("redirect"));
    const res = NextResponse.redirect(buildFacebookAuthUrl({ appId: process.env.FACEBOOK_APP_ID!.trim(), redirectUri: facebookRedirectUri(req), state, authUrl: facebookEndpoints().auth }), 303);
    res.cookies.set(FACEBOOK_COOKIE, await signFlow("facebook", { state, nonce: "-", verifier: "-", redirect }), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: COOKIE_PATH.facebook, maxAge: STATE_TTL_SEC,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("[facebook/start]", (e as Error).message);
    return fail("failed");
  }
}
