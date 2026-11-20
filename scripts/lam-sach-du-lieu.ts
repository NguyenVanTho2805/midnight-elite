// LAM-SACH (17/11/2026, chủ: "cứ reset đi, giờ tôi muốn tạo web clean để tạo lớp lại từ đầu") — xoá sạch dữ liệu dạy học để mở lớp lại từ đầu.
// KHÔNG tự chạy. Mặc định CHỈ ĐỌC (in bảng sẽ xoá / giữ + số dòng). Xoá thật cần đủ:  --apply --da-sao-luu --xac-nhan <tên database>
//
//   Xem trước:   npx tsx scripts/lam-sach-du-lieu.ts
//   Xoá thật:    npx tsx scripts/lam-sach-du-lieu.ts --apply --da-sao-luu --xac-nhan <tên database>
//   Xoá cả tài khoản gia sư / học sinh (chỉ giữ quản trị cấp 1 và quản trị nội dung):  thêm --xoa-tai-khoan
//
// Trước khi xoá thật PHẢI sao lưu:  pg_dump "$DATABASE_URL" -Fc -f kin-truoc-lam-sach-$(date +%Y%m%d-%H%M).dump
//   (khôi phục: pg_restore --clean --if-exists -d "$DATABASE_URL" <tệp .dump>)
//
// GIỮ (bảng KEEP dưới đây): tài khoản và cài đặt của từng người, nội dung hệ thống (danh mục môn, tin tức, điểm chuẩn, tiếng Anh, cấu hình gói, nội dung trang).
// XOÁ: mọi bảng khác — lớp, lịch, buổi, điểm danh, ghi danh, mã mời, yêu cầu vào lớp, bài tập, đề, ngân hàng câu hỏi, bài làm, điểm, học liệu,
//   thông báo, hỏi đáp / cộng đồng, nhật ký, học phí (phiếu, khoản phí, gói buổi…). Tệp trên Cloudinary KHÔNG bị xoá (chỉ mất bản ghi trỏ tới).
// An toàn: TRUNCATE … CASCADE xoá cả bảng nào có khoá ngoại trỏ vào bảng bị xoá — script dừng (không ghi gì) nếu một bảng GIỮ có khoá ngoại tới bảng XOÁ.
// Cả lần xoá chạy trong MỘT giao dịch: lỗi giữa chừng thì không mất gì.
// Mã thoát: 0 xong / xem trước xong · 1 sai tham số hoặc thiếu xác nhận · 2 bị chặn (bảng giữ trỏ vào bảng xoá, DB lạ) · 3 lỗi khi ghi.
import { prisma } from "@/lib/prisma";

const KEEP = new Set([
  // tài khoản và thứ gắn với từng tài khoản
  "users", "wallets", "push_subscriptions", "tutor_subscriptions", "tutor_payout_accounts", "tutor_doc_brands", "student_field_defs", "consent_records",
  // cấu hình / nội dung hệ thống
  "plan_configs", "setting_kv", "site_content", "course_categories", "articles", "admission_scores", "admission_formulas", "library_videos",
  "eng_words", "eng_texts", "eng_books", "eng_book_pages", "eng_units", "eng_chunks", "eng_exercises",
  // Prisma
  "_prisma_migrations",
]);
/** Khi --xoa-tai-khoan: tài khoản quản trị được giữ. */
const KEEP_ADMIN_ROLES = ["admin_super", "admin_content"];

interface Args { apply: boolean; backedUp: boolean; confirm: string | null; dropAccounts: boolean }
function parseArgs(argv: string[]): Args | string {
  const a: Args = { apply: false, backedUp: false, confirm: null, dropAccounts: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--apply") a.apply = true;
    else if (k === "--da-sao-luu") a.backedUp = true;
    else if (k === "--xoa-tai-khoan") a.dropAccounts = true;
    else if (k === "--xac-nhan") { const v = argv[++i]; if (!v || v.startsWith("--")) return "--xac-nhan cần tên database"; a.confirm = v; }
    else return `Tham số lạ: ${k}`;
  }
  return a;
}

const q = (t: string) => `"${t.replace(/"/g, '""')}"`;

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === "string") { console.error(args); return 1; }

  const [{ db }] = await prisma.$queryRawUnsafe<{ db: string }[]>(`select current_database()::text as db`);
  const tables = (await prisma.$queryRawUnsafe<{ t: string }[]>(`select tablename::text as t from pg_tables where schemaname = 'public' order by 1`)).map(r => r.t);
  if (!tables.includes("users") || !tables.includes("courses")) { console.error(`Database "${db}" không giống KiN (thiếu users / courses). Dừng.`); return 2; }

  const wipe = tables.filter(t => !KEEP.has(t));
  const keep = tables.filter(t => KEEP.has(t));
  const missingKeep = [...KEEP].filter(t => t !== "_prisma_migrations" && !tables.includes(t));

  // Bảng GIỮ mà có khoá ngoại trỏ vào bảng XOÁ ⇒ TRUNCATE CASCADE sẽ xoá luôn bảng giữ. Dừng.
  const fks = await prisma.$queryRawUnsafe<{ src: string; dst: string; col: string }[]>(`
    select c.conrelid::regclass::text as src, c.confrelid::regclass::text as dst, a.attname::text as col
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace`);
  const unq = (s: string) => s.replace(/^"|"$/g, "");
  const bad = fks.filter(f => KEEP.has(unq(f.src)) && !KEEP.has(unq(f.dst)));
  if (bad.length) {
    console.error("Bảng GIỮ có khoá ngoại tới bảng XOÁ — xoá sẽ kéo theo bảng giữ. Dừng, chưa ghi gì:");
    for (const b of bad) console.error(`  ${unq(b.src)}.${b.col} → ${unq(b.dst)}`);
    return 2;
  }

  const count = async (t: string) => Number((await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*)::bigint as n from ${q(t)}`))[0].n);
  console.log(`Database: ${db}`);
  console.log(`\nSẼ XOÁ (${wipe.length} bảng):`);
  let total = 0;
  for (const t of wipe) { const n = await count(t); total += n; if (n) console.log(`  ${t.padEnd(34)} ${n}`); }
  console.log(`  … ${wipe.length} bảng, tổng ${total} dòng (bảng rỗng không in)`);
  console.log(`\nGIỮ (${keep.length} bảng):`);
  for (const t of keep) console.log(`  ${t.padEnd(34)} ${await count(t)}`);
  if (missingKeep.length) console.log(`  (không có trong DB này: ${missingKeep.join(", ")})`);

  const userWhere = `not ("role" = 'admin' and "adminRole" in (${KEEP_ADMIN_ROLES.map(r => `'${r}'`).join(",")}))`;
  const userFks = fks.filter(f => unq(f.dst) === "users" && KEEP.has(unq(f.src)) && unq(f.src) !== "users");
  if (args.dropAccounts) {
    const n = Number((await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*)::bigint as n from users where ${userWhere}`))[0].n);
    const admins = Number((await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*)::bigint as n from users where not (${userWhere})`))[0].n);
    console.log(`\n--xoa-tai-khoan: xoá ${n} tài khoản (gia sư, học sinh, quản trị khác), giữ ${admins} tài khoản quản trị (${KEEP_ADMIN_ROLES.join(", ")}).`);
    if (admins === 0) { console.error("Không còn tài khoản quản trị nào sau khi xoá — sẽ không vào được trang quản trị. Dừng."); return 2; }
  }

  if (!args.apply) {
    console.log(`\nĐây là bản XEM TRƯỚC, chưa xoá gì. Xoá thật:\n  pg_dump "$DATABASE_URL" -Fc -f kin-truoc-lam-sach.dump\n  npx tsx scripts/lam-sach-du-lieu.ts --apply --da-sao-luu --xac-nhan ${db}${args.dropAccounts ? " --xoa-tai-khoan" : ""}`);
    return 0;
  }
  if (!args.backedUp) { console.error("\nThiếu --da-sao-luu. Sao lưu bằng pg_dump trước rồi chạy lại."); return 1; }
  if (args.confirm !== db) { console.error(`\n--xac-nhan phải đúng tên database đang nối ("${db}"). Dừng.`); return 1; }

  try {
    await prisma.$transaction(async tx => {
      if (wipe.length) await tx.$executeRawUnsafe(`truncate table ${wipe.map(q).join(", ")} restart identity cascade`);
      if (args.dropAccounts) {
        for (const f of userFks) await tx.$executeRawUnsafe(`delete from ${q(unq(f.src))} where ${q(f.col)} in (select id from users where ${userWhere})`);
        await tx.$executeRawUnsafe(`delete from users where ${userWhere}`);
      }
    }, { timeout: 120_000 });
  } catch (e) {
    console.error("\nLỗi khi xoá — giao dịch đã hoàn tác, dữ liệu còn nguyên:", (e as Error).message);
    return 3;
  }
  console.log(`\nĐã làm sạch ${wipe.length} bảng${args.dropAccounts ? " và xoá tài khoản không phải quản trị" : ""}. Còn lại:`);
  for (const t of keep) console.log(`  ${t.padEnd(34)} ${await count(t)}`);
  return 0;
}

main().then(code => prisma.$disconnect().then(() => process.exit(code))).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(3); });
