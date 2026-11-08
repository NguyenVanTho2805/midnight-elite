// GET → chuyển sang Google (Authorization Code + PKCE). Chỉ đặt cookie trạng thái ngắn hạn, không ghi gì vào DB. ?redirect= chỉ nhận đường nội bộ.
import { NextResponse } from "next/server";
import { isAdminHost } from "@/lib/hostRouting";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { safeRedirect } from "@/lib/safeRedirect";
import {
  GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, GOOGLE_STATE_TTL_SEC, buildAuthUrl, googleEnabled, googleEndpoints, googleRedirectUri, randomToken, signFlowState,
} from "@/lib/googleAuth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (code: string) => NextResponse.redirect(new URL(`/dang-nhap?google=${code}`, url), 303);
  if (!googleEnabled()) return NextResponse.redirect(new URL("/dang-nhap", url), 303);
  if (isAdminHost(req.headers.get("host") ?? "")) return fail("wrong-host");
  if (!rateLimit(`google-start:${getClientIp(req)}`, 20, 60_000)) return fail("failed");

  try {
    const state = randomToken(), nonce = randomToken(), verifier = randomToken(48);
    const redirect = safeRedirect(url.searchParams.get("redirect"));
    const target = buildAuthUrl({
      clientId: process.env.GOOGLE_CLIENT_ID!.trim(), redirectUri: googleRedirectUri(req), state, nonce, verifier, authUrl: googleEndpoints().auth,
    });
    const res = NextResponse.redirect(target, 303);
    res.cookies.set(GOOGLE_COOKIE, await signFlowState({ state, nonce, verifier, redirect }), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: GOOGLE_COOKIE_PATH, maxAge: GOOGLE_STATE_TTL_SEC,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("[google/start]", (e as Error).message);
    return fail("failed");
  }
}
