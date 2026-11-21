// SCL-A (21/11/2026, Q7 + Q10) — dữ liệu MỘT LẦN: lớp cũ đã lỡ công khai và lớp joinPolicy null.
// KHÔNG tự chạy. Mặc định CHỈ ĐỌC (in danh sách lớp sẽ đổi). Ghi thật cần đủ:  --apply --xac-nhan <tên database>
//
//   Xem trước:  npx tsx scripts/scl-an-lop-cong-khai.ts
//   Ghi thật:   pg_dump "$DATABASE_URL" -Fc -f kin-truoc-an-lop-$(date +%Y%m%d-%H%M).dump
//               npx tsx scripts/scl-an-lop-cong-khai.ts --apply --xac-nhan <tên database>
//
// Chỉ lớp của GIA SƯ (chủ lớp adminRole teacher); khoá học trung tâm không đụng.
// Đổi (kế hoạch thuần ở src/lib/classPrivacyFix.ts): joinPolicy null → "approve"; lớp không phải "open" → status false (ẩn khỏi trang công khai);
//   tên gia sư trống / "KiN" → tên thật của chủ lớp. Không đụng lớp "open", học phí, ghi danh, mã mời. Mọi thay đổi trong MỘT giao dịch.
// Mã thoát: 0 xong / xem trước xong · 1 sai tham số hoặc thiếu xác nhận · 3 lỗi khi ghi.
import { prisma } from "@/lib/prisma";
import { planClassFix } from "@/lib/classPrivacyFix";

function parseArgs(argv: string[]): { apply: boolean; confirm: string | null } | string {
  const a = { apply: false, confirm: null as string | null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--apply") a.apply = true;
    else if (k === "--xac-nhan") { const v = argv[++i]; if (!v || v.startsWith("--")) return "--xac-nhan cần tên database"; a.confirm = v; }
    else return `Tham số lạ: ${k}`;
  }
  return a;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === "string") { console.error(args); return 1; }
  const [{ db }] = await prisma.$queryRawUnsafe<{ db: string }[]>(`select current_database()::text as db`);

  const rows = await prisma.course.findMany({ select: { id: true, name: true, status: true, joinPolicy: true, instructor: true, owner: { select: { name: true, adminRole: true } } }, orderBy: { id: "asc" } });
  const plan = planClassFix(rows.map(r => ({ id: r.id, name: r.name, status: r.status, joinPolicy: r.joinPolicy, instructor: r.instructor, ownerName: r.owner?.name ?? null, ownerAdminRole: r.owner?.adminRole ?? null })));
  console.log(`Database: ${db} · ${rows.length} lớp · ${plan.length} lớp sẽ đổi`);
  for (const p of plan) console.log(`  ${p.id.padEnd(32)} ${JSON.stringify(p.data)}`);

  if (!args.apply) {
    console.log(`\nĐây là bản XEM TRƯỚC, chưa ghi gì. Ghi thật:\n  npx tsx scripts/scl-an-lop-cong-khai.ts --apply --xac-nhan ${db}`);
    return 0;
  }
  if (args.confirm !== db) { console.error(`\n--xac-nhan phải đúng tên database đang nối ("${db}"). Dừng.`); return 1; }
  try {
    await prisma.$transaction(plan.map(p => prisma.course.update({ where: { id: p.id }, data: p.data })));
  } catch (e) {
    console.error("\nLỗi khi ghi — giao dịch đã hoàn tác, dữ liệu còn nguyên:", (e as Error).message);
    return 3;
  }
  console.log(`\nĐã đổi ${plan.length} lớp.`);
  return 0;
}

main().then(code => prisma.$disconnect().then(() => process.exit(code))).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(3); });
