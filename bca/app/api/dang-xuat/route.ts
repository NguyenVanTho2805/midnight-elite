import { TEN_COOKIE } from "@/server/token";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "set-cookie": `${TEN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` } });
}
