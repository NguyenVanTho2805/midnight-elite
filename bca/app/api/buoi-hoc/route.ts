import { route } from "@/server/api";
import { danhSachBuoi } from "@/server/buoi-hoc";
import { ngayVN } from "@/lib/ngay";

/** ?thang=2026-11&mon=toan */
export const GET = route((u, req) => {
  const q = new URL(req.url).searchParams;
  return danhSachBuoi(u, { thang: q.get("thang") ?? ngayVN(new Date()).slice(0, 7), mon: q.get("mon") || undefined });
});
