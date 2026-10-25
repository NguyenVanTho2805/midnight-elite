// Dữ liệu GIẢ cho môi trường cục bộ — để người dùng mở web trên máy và THỬ ngay, không phải tự gõ dữ liệu.
// Chỉ chạy được với cơ sở dữ liệu trên máy (DATABASE_URL chứa "@localhost:"); KHÔNG BAO GIỜ chạy với DB thật.
//
//   bash .local-dev/seed.sh            nạp nếu DB còn trống
//   bash .local-dev/seed.sh --reset    xoá sạch (wipe) rồi nạp lại
//
// Cách làm: dựng "thế giới" gia sư + học sinh có sẵn của bộ test (tutor-world / student-world, gọi API thật của máy chủ dev đang chạy ở BASE),
// đặt email dễ nhớ, rồi chạy MỌI tệp trong tools/local-e2e/mock/*.ts. Mỗi tính năng mới mang theo một tệp mock của riêng nó
// (quy ước: `export default async function mock(ctx: MockCtx): Promise<string[]>`, trả về các dòng "xem ở đâu, thấy gì").
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { prisma } from "@/lib/prisma";
import { wipe } from "./h";
import { seedTutorWorld } from "./tutor-world";
import { seedStudentWorld } from "./student-world";

export const MOCK_PASSWORD = "Passw0rd!"; // mật khẩu chung do h.ts đặt cho mọi tài khoản thử

type TW = Extract<Awaited<ReturnType<typeof seedTutorWorld>>, { empty: false }>;
type SW = Awaited<ReturnType<typeof seedStudentWorld>>;
export interface MockCtx {
  prisma: typeof prisma;
  /** Gia sư chính, có đủ dữ liệu (lớp, lịch, học phí, hộp việc…): giasu@kin.local */
  tutor: { id: string; email: string; name: string };
  /** Học sinh chính: hocsinh@kin.local */
  student: { id: string; email: string; name: string };
  /** Quản trị cấp 1: admin@kin.local */
  admin: { id: string; email: string; name: string };
  tw: TW;
  sw: SW;
}
export type MockFn = (ctx: MockCtx) => Promise<string[]>;

async function main() {
  if (!/@localhost:/.test(process.env.DATABASE_URL ?? "")) throw new Error("DỪNG: DATABASE_URL không phải DB trên máy.");
  if (process.argv.includes("--reset")) { await wipe(); console.log("Đã xoá sạch DB trên máy."); }
  else if (await prisma.user.count()) { console.log("DB trên máy đã có dữ liệu. Nạp lại từ đầu: bash .local-dev/seed.sh --reset"); return; }

  const sw = await seedStudentWorld();
  const tw = await seedTutorWorld();
  if (tw.empty) throw new Error("seedTutorWorld trả thế giới rỗng");

  const accounts = [
    { u: tw.T, email: "giasu@kin.local", vai: "Gia sư chính (lớp, lịch, học phí, phiếu, hộp việc)" },
    { u: sw.S, email: "hocsinh@kin.local", vai: "Học sinh" },
    { u: sw.T, email: "giasu2@kin.local", vai: "Gia sư thứ hai" },
    { u: sw.SA, email: "admin@kin.local", vai: "Quản trị cấp 1 (cần tên miền admin — xem .local-dev/HUONG-DAN.md mục 5)" },
  ];
  for (const a of accounts) await prisma.user.update({ where: { id: a.u.id }, data: { email: a.email } });

  const ctx: MockCtx = {
    prisma,
    tutor: { id: tw.T.id, email: "giasu@kin.local", name: tw.T.name },
    student: { id: sw.S.id, email: "hocsinh@kin.local", name: sw.S.name },
    admin: { id: sw.SA.id, email: "admin@kin.local", name: sw.SA.name },
    tw, sw,
  };

  const dir = join(__dirname, "mock");
  const files = (() => { try { return readdirSync(dir).filter(f => f.endsWith(".ts")).sort(); } catch { return []; } })();
  const notes: string[] = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const fn: MockFn | undefined = mod.default ?? mod.mock;
    if (!fn) { notes.push(`(bỏ qua ${f}: không có export default)`); continue; }
    notes.push(...(await fn(ctx)));
  }

  console.log(`\nĐã nạp dữ liệu mẫu. Đăng nhập ở ${process.env.BASE ?? "http://localhost:3000"}/dang-nhap — mật khẩu chung: ${MOCK_PASSWORD}`);
  for (const a of accounts) console.log(`  ${a.email.padEnd(20)} ${a.vai}`);
  if (notes.length) { console.log("\nDữ liệu giả của từng tính năng:"); for (const n of notes) console.log("  • " + n); }
}

main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
