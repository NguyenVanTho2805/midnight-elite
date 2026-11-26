import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const g = globalThis as typeof globalThis & { _bcaDb?: PrismaClient };

function taoClient() {
  const url = process.env.BCA_DATABASE_URL;
  if (!url) throw new Error("Thiếu biến môi trường BCA_DATABASE_URL");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Tạo khi dùng lần đầu (để `next build` không cần DB). */
export const db = new Proxy({} as PrismaClient, {
  get: (_, k) => Reflect.get((g._bcaDb ??= taoClient()), k),
});
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Khoá dòng buổi (FOR UPDATE) trong transaction ghi: hai thao tác cùng buổi chạy lần lượt. Gọi SAU khi đã kiểm quyền. */
export const khoaBuoi = (tx: Tx, id: number) => tx.$queryRaw`SELECT id FROM buoi_hoc WHERE id = ${id} FOR UPDATE`;
