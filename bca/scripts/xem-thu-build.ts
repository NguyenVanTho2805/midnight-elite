// Bước nạp dữ liệu GIẢ khi Vercel dựng bản XEM THỬ (gọi từ `npm run build:xem-thu`).
// Chỉ chạy khi: VERCEL_ENV khác "production" VÀ BCA_SEED_GIA=1.
// Từ chối (dừng build) nếu DB đã có học sinh mà KHÔNG có dấu DU_LIEU_GIA — tức có thể là dữ liệu thật.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { seedGia } from "./seed-gia";

if (process.env.VERCEL_ENV === "production" || process.env.BCA_SEED_GIA !== "1") {
  console.log("xem-thu-build: bỏ qua nạp dữ liệu giả (production hoặc chưa đặt BCA_SEED_GIA=1).");
  process.exit(0);
}
const url = process.env.BCA_DATABASE_URL;
if (!url) {
  console.error("xem-thu-build: thiếu BCA_DATABASE_URL.");
  process.exit(1);
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const soHs = await db.hoc_sinh.count();
const dau = await db.cai_dat.findUnique({ where: { khoa: "DU_LIEU_GIA" } });
if (soHs > 0 && !dau) {
  console.error(`xem-thu-build: TỪ CHỐI — DB có ${soHs} học sinh nhưng không có dấu DU_LIEU_GIA (có thể là dữ liệu thật).`);
  await db.$disconnect();
  process.exit(1);
}
console.log("xem-thu-build:", await seedGia(db));
await db.$disconnect();
