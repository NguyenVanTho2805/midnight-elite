// Hạ tầng test: DB thử riêng (tên phải kết thúc _test), seed giả, gọi route handler như HTTP thật.
import { db } from "@/server/db";
import { kyPhien, TEN_COOKIE } from "@/server/token";
import { seedGia } from "@/scripts/seed-gia";
import type { Nguoi } from "@/lib/quyen";

export function kiemDbThu() {
  const url = process.env.BCA_DATABASE_URL ?? "";
  if (!/\/[\w-]+_test(\?|$)/.test(url)) throw new Error("Test cần BCA_DATABASE_URL trỏ tới DB tên *_test (test xoá sạch dữ liệu)");
}
export async function napSeed() {
  kiemDbThu();
  return seedGia(db);
}

export async function cookieNd(gmail: string) {
  const nd = await db.nguoi_dung.findUniqueOrThrow({ where: { gmail } });
  return `${TEN_COOKIE}=${await kyPhien({ sub: nd.id, vai: "nd", bd: Math.floor(Date.now() / 1000) })}`;
}
export async function cookieHs(maHs: string) {
  const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: maHs } });
  return `${TEN_COOKIE}=${await kyPhien({ sub: String(hs.id), vai: "hs", bd: Math.floor(Date.now() / 1000) })}`;
}
export async function nguoi(gmail: string): Promise<Nguoi> {
  const nd = await db.nguoi_dung.findUniqueOrThrow({ where: { gmail }, include: { phan_cong: true } });
  return { vai: nd.vai_tro, id: nd.id, ten: nd.ten_hien_thi, monIds: nd.phan_cong.map((p) => p.mon_id) };
}
export async function nguoiHs(maHs: string): Promise<Nguoi> {
  const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: maHs } });
  return { vai: "hoc_sinh", hocSinhId: hs.id, ten: hs.ho_ten };
}

type H = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
export async function goi(handler: unknown, opt: { cookie?: string; method?: string; body?: unknown; params?: Record<string, string>; path?: string } = {}) {
  const req = new Request(`http://localhost${opt.path ?? "/api/x"}`, {
    method: opt.method ?? (opt.body === undefined ? "GET" : "POST"),
    headers: { ...(opt.cookie ? { cookie: opt.cookie } : {}), "content-type": "application/json" },
    body: opt.body === undefined ? undefined : JSON.stringify(opt.body),
  });
  const res = await (handler as H)(req, { params: Promise.resolve(opt.params ?? {}) });
  return { status: res.status, json: (await res.json().catch(() => null)) as any };
}

export const CHU = "chu.thu@bca.invalid", GV_TOAN = "gv.toan@bca.invalid", GV_ANH = "gv.anh@bca.invalid";
export { db };
