// Đăng ký tài khoản là MỘT giao dịch: lỗi ở bước nào thì không để lại tài khoản dở dang (01/11/2026).
//
// Lỗi cũ: /api/auth/register, /api/auth/register-tutor, POST /api/admin/students tạo User xong mới tạo ví + xu khởi đầu + link xác thực / đặt mật khẩu, không
// trong giao dịch chung. Lỗi ở bước sau (DB chập chờn, hết hạn mức...) trả "Lỗi server" nhưng User đã nằm trong DB: không ví, không link, và đăng ký lại bị 409
// "Email này đã được đăng ký" — người dùng không còn lối nào (đúng chuỗi "đăng ký lại cũng không được").
//
// Cách gây lỗi thật: trigger Postgres (CHỈ trên DB thử) làm mọi INSERT vào một bảng nổ tung — tới bước nào bảng đó được ghi thì bước đó lỗi. Bài luôn gỡ trigger
// khi xong (kể cả khi sập). Ca phá cố ý: với src/ bản cũ các ca "không còn tài khoản dở dang" đỏ.
import { mkdirSync, rmSync } from "node:fs";
import { mkSuper, wipe, api, check, eventually, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { SIGNUP_BONUS } from "@/lib/wallet-constants";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }

let ip = Math.floor(Math.random() * 200);
const fresh = () => ({ "x-forwarded-for": `10.55.${Math.floor(Math.random() * 250)}.${++ip % 250}` });
const stamp = Date.now();
let n = 0;
const mail = (p: string) => `${p}.${stamp}.${++n}@example.com`;

const failOn = (table: string) => prisma.$executeRawUnsafe(`CREATE TRIGGER kin_test_fail_${table} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION kin_test_fail()`);
const heal = async () => { for (const t of ["wallets", "coin_transactions", "verify_tokens", "password_reset_tokens"]) await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS kin_test_fail_${t} ON ${t}`); };

const STUDENT = (email: string) => ({ name: "Phương Uyên", email, password: "uyen2005xyz", phone: "0912345678" });
const TUTOR = (email: string) => ({ name: "Cô Lan", email, password: "colan2005xyz", phone: "0912345679", bio: "Dạy Toán", subjects: ["Toán"] });

type Route = { name: string; call: (email: string) => Promise<{ status: number; json: any }>; lastTable: string; extra: (userId: string) => Promise<boolean> };
const ROUTES: Route[] = [];

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();
  const admin = await mkSuper("Quản trị");
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION kin_test_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'kin-test: chặn ghi vào %', TG_TABLE_NAME; END $$ LANGUAGE plpgsql`);
  await heal();

  ROUTES.push(
    { name: "đăng ký học sinh /api/auth/register", call: e => api("POST", "/api/auth/register", { body: STUDENT(e), headers: fresh() }), lastTable: "verify_tokens",
      extra: async id => (await prisma.verifyToken.count({ where: { userId: id } })) === 1 },
    { name: "đăng ký gia sư /api/auth/register-tutor", call: e => api("POST", "/api/auth/register-tutor", { body: TUTOR(e), headers: fresh() }), lastTable: "verify_tokens",
      extra: async id => (await prisma.verifyToken.count({ where: { userId: id } })) === 1 && !!(await prisma.user.findUnique({ where: { id } }))?.tutorAppliedAt },
    { name: "quản trị thêm học sinh POST /api/admin/students", call: e => api("POST", "/api/admin/students", { as: admin, body: { name: "Học Sinh", email: e } }), lastTable: "password_reset_tokens",
      extra: async id => (await prisma.passwordResetToken.count({ where: { userId: id } })) === 1 },
  );

  try {
    for (const R of ROUTES) {
      section(`${R.name}`);
      // 1) Lỗi ở bước TẠO VÍ (bước đầu sau khi tạo User)
      let e = mail("vi");
      await failOn("wallets");
      let r = await R.call(e);
      await heal();
      check("ví không tạo được → trả lỗi (không phải 200)", r.status >= 400, r);
      check("KHÔNG còn tài khoản dở dang (bản cũ: User nằm lại trong DB)", (await prisma.user.count({ where: { email: e } })) === 0);
      r = await R.call(e);
      check("đăng ký LẠI cùng email được ngay (bản cũ: 409 'Email này đã được đăng ký')", r.status === 200 || r.status === 201, r);

      // 2) Lỗi ở bước CUỐI (link xác thực / đặt mật khẩu) — User, ví, xu đã ghi nhưng giao dịch chưa xong
      e = mail("cuoi");
      await failOn(R.lastTable);
      r = await R.call(e);
      await heal();
      check(`${R.lastTable} không ghi được → trả lỗi`, r.status >= 400, r);
      check("không còn User / ví / xu khởi đầu nào của email này (hoàn tác cả giao dịch)",
        (await prisma.user.count({ where: { email: e } })) === 0 && (await prisma.wallet.count({ where: { user: { email: e } } })) === 0 && (await prisma.coinTransaction.count({ where: { user: { email: e } } })) === 0);
      r = await R.call(e);
      check("đăng ký lại cùng email được", r.status === 200 || r.status === 201, r);

      // 3) Đường thường: đủ cả bốn thứ
      const u = await prisma.user.findUnique({ where: { email: e }, include: { wallet: true } });
      check("đường thường: có User", !!u);
      check(`đường thường: ví đúng ${SIGNUP_BONUS} xu`, u?.wallet?.balance === SIGNUP_BONUS, u?.wallet);
      check("đường thường: đúng MỘT giao dịch xu khởi đầu", !!u && (await prisma.coinTransaction.count({ where: { userId: u.id, amount: SIGNUP_BONUS } })) === 1);
      check("đường thường: có link xác thực / đặt mật khẩu", !!u && await R.extra(u.id));
    }

    // 4) Hai yêu cầu CÙNG email chạy song song
    section("Hai yêu cầu cùng email chạy song song (bấm hai lần, hai thiết bị)");
    const e = mail("song-song");
    const [a, b] = await Promise.all([
      api("POST", "/api/auth/register", { body: STUDENT(e), headers: fresh() }),
      api("POST", "/api/auth/register", { body: STUDENT(e), headers: fresh() }),
    ]);
    const codes = [a.status, b.status].sort();
    check("đúng một bên thành công (200), bên kia 409 'đã được đăng ký' — KHÔNG có 500 'Lỗi server'", codes[0] === 200 && codes[1] === 409, { a: a.status, b: b.status, ja: a.json, jb: b.json });
    check("trong DB đúng MỘT tài khoản, MỘT ví", (await prisma.user.count({ where: { email: e } })) === 1 && (await prisma.wallet.count({ where: { user: { email: e } } })) === 1);
    void eventually;
  } finally {
    await heal().catch(() => {});
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS kin_test_fail()`).catch(() => {});
  }

  await done();
})().catch(async e => { console.error(e); await heal().catch(() => {}); process.exit(1); });
