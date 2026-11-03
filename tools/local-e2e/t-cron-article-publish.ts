// BU-08 / ADM-002 — GET /api/cron/article-publish: báo học sinh khi bài hẹn giờ đã lên, đúng MỘT lần dù cron chạy chồng nhau.
// Máy chủ dev phải chạy với CRON_SECRET (≥ 16 ký tự) trùng biến môi trường của bài này. Đã chạy tuần tự trên máy test (02/11/2026), số liệu trong PR.
// Ca phá cố ý: bỏ bước giành khoá SettingKV (settingKV.create) trong articleScheduleServer.ts → ca "5 lần gọi song song" đỏ;
// bỏ điều kiện `lte: now` → ca "bài tương lai không báo" đỏ.
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { BASE, mkUser, wipe, check, section, done } from "./h";

const SECRET = process.env.CRON_SECRET ?? "";
const call = (key?: string) => fetch(`${BASE}/api/cron/article-publish`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
const MIN = 60_000;

(async () => {
  await wipe();
  section("Xác thực");
  check("không khoá → 401 hoặc 503 (chưa cấu hình), KHÔNG chạy việc", [401, 503].includes((await call()).status));
  if (SECRET.length < 16) { console.log("  ⚠ CRON_SECRET (≥16 ký tự) chưa đặt cho bài này — bỏ qua phần còn lại"); await done(); return; }
  check("khoá sai → 401 và không ghi nhận lần gọi", (await call("sai-khoa")).status === 401 && !(await prisma.settingKV.findUnique({ where: { key: "cron.article-publish.lastCall" } })));

  const s1 = await mkUser({ name: "Học sinh Một" }), s2 = await mkUser({ name: "Học sinh Hai" });
  const banned = await mkUser({ name: "Học sinh bị khoá" });
  await prisma.user.update({ where: { id: banned.id }, data: { banned: true } });
  const sys = await prisma.user.create({ data: { name: "Khách", email: "khach@he-thong.kin.invalid", password: await bcrypt.hash("x", 4), role: "student", emailVerified: true } });
  const admin = await mkUser({ name: "Quản trị", role: "admin", adminRole: "admin_super" });

  const mkArt = (slug: string, o: { published: boolean; publishedAt: Date | null }) => prisma.article.create({ data: { slug, title: `Tiêu đề ${slug}`, excerpt: "e", content: "c", category: "tin", author: "KiN", authorId: admin.id, ...o } });
  const due = await mkArt("bai-hen-gio-den-gio", { published: true, publishedAt: new Date(Date.now() - 10 * MIN) });
  const future = await mkArt("bai-hen-gio-tuong-lai", { published: true, publishedAt: new Date(Date.now() + 60 * MIN) });
  const draft = await mkArt("bai-nhap", { published: false, publishedAt: new Date(Date.now() - 10 * MIN) });
  const old = await mkArt("bai-qua-3-ngay", { published: true, publishedAt: new Date(Date.now() - 4 * 86_400_000) });
  const instant = await mkArt("bai-dang-ngay", { published: true, publishedAt: new Date(Date.now() - 5 * MIN) });
  await prisma.notification.create({ data: { userId: s1.id, type: "article_new", title: "Bài viết mới", message: `Bài viết mới: "Tiêu đề bai-dang-ngay"`, link: `/tin-tuc/${instant.slug}` } }); // đã báo lúc lưu
  const count = (slug: string, userId?: string) => prisma.notification.count({ where: { type: "article_new", link: `/tin-tuc/${slug}`, ...(userId ? { userId } : {}) } });

  section("Báo đúng bài, đúng người");
  const r = await call(SECRET);
  const j = await r.json();
  check("200 và { notified: 1 } (chỉ bài hẹn giờ vừa tới giờ); phản hồi không có tiêu đề / tên", r.status === 200 && j.notified === 1 && !JSON.stringify(j).includes("Tiêu đề"), j);
  check("mỗi học sinh thường nhận đúng 1 thông báo của bài đến giờ, cùng chữ với route lưu bài", (await count(due.slug, s1.id)) === 1 && (await count(due.slug, s2.id)) === 1 && !!(await prisma.notification.findFirst({ where: { link: `/tin-tuc/${due.slug}` } }).then(n => n && n.title === "Bài viết mới" && n.message === `Bài viết mới: "Tiêu đề ${due.slug}"`)));
  check("KHÔNG báo học sinh bị khoá, tài khoản hệ thống, quản trị", (await count(due.slug, banned.id)) === 0 && (await count(due.slug, sys.id)) === 0 && (await count(due.slug, admin.id)) === 0);
  check("bài tương lai / bài nháp / bài quá 3 ngày → không báo", (await count(future.slug)) === 0 && (await count(draft.slug)) === 0 && (await count(old.slug)) === 0);
  check("bài đăng ngay đã có thông báo → không gửi lại (vẫn 1 thông báo)", (await count(instant.slug)) === 1);
  check("AuditLog article.scheduled_notify, actor null, resource Article, metadata { recipients: 2 }", await (async () => { const l = await prisma.auditLog.findFirst({ where: { action: "article.scheduled_notify", resourceId: due.id } }); return !!l && l.actorId === null && l.resourceType === "Article" && (l.metadata as any)?.recipients === 2; })());
  check("recordCronRun: cron.article-publish.lastCall là ISO", !Number.isNaN(new Date((await prisma.settingKV.findUnique({ where: { key: "cron.article-publish.lastCall" } }))!.value).getTime()));

  section("Không gửi hai lần");
  const r2 = await (await call(SECRET)).json();
  check("gọi lần 2 → notified 0, vẫn đúng 1 thông báo mỗi học sinh", r2.notified === 0 && (await count(due.slug, s1.id)) === 1);
  const due2 = await mkArt("bai-hen-gio-thu-hai", { published: true, publishedAt: new Date(Date.now() - 2 * MIN) });
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => call(SECRET).then(x => x.json())));
  check("5 lần gọi SONG SONG → tổng notified = 1; mỗi học sinh đúng 1 thông báo, chỉ 1 dòng log", rs.reduce((a, x) => a + (x.notified ?? 0), 0) === 1 && (await count(due2.slug, s1.id)) === 1 && (await count(due2.slug, s2.id)) === 1 && (await prisma.auditLog.count({ where: { action: "article.scheduled_notify", resourceId: due2.id } })) === 1, rs);
  check("hàng khoá SettingKV article.notified.<id> có cho bài đã báo", !!(await prisma.settingKV.findUnique({ where: { key: `article.notified.${due.id}` } })));

  // BU-08 rà soát (P2-3A): dedupe theo link (slug) không đủ — sửa slug sau khi đã báo sẽ báo lần hai cho cả trường.
  section("Đổi slug sau khi đã báo → không báo lần hai");
  check("bài đăng ngay (đã báo theo link cũ) được ghi khoá theo id ngay lần cron đầu", !!(await prisma.settingKV.findUnique({ where: { key: `article.notified.${instant.id}` } })));
  await prisma.article.update({ where: { id: instant.id }, data: { slug: "bai-dang-ngay-slug-moi" } });
  const r3 = await (await call(SECRET)).json();
  check("đổi slug rồi cron chạy → notified 0, KHÔNG có thông báo nào trỏ tới slug mới", r3.notified === 0 && (await count("bai-dang-ngay-slug-moi")) === 0, r3);

  // BU-08 rà soát (P2-3B): notifyMany nuốt lỗi → trước đây khoá đã giành, bài không bao giờ được báo lại và nhật ký vẫn ghi recipients. Gây lỗi THẬT bằng trigger (chỉ DB thử, gỡ trong finally).
  section("Ghi thông báo lỗi → không mất bài, lần cron sau gửi lại");
  const due3 = await mkArt("bai-hen-gio-loi-ghi", { published: true, publishedAt: new Date(Date.now() - 1 * MIN) });
  let failedRun: { notified?: number } = {};
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION kin_test_chan_tb() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'kin_test: chặn thông báo'; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER kin_test_chan_tb BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION kin_test_chan_tb()`);
  try { failedRun = await (await call(SECRET)).json(); }
  finally { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS kin_test_chan_tb ON notifications`); await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS kin_test_chan_tb()`); }
  check("ghi thông báo lỗi: notified 0, KHÔNG nhật ký 'đã báo', khoá được nhả (để thử lại)", failedRun.notified === 0 && (await count(due3.slug)) === 0
    && !(await prisma.auditLog.findFirst({ where: { action: "article.scheduled_notify", resourceId: due3.id } })) && !(await prisma.settingKV.findUnique({ where: { key: `article.notified.${due3.id}` } })), failedRun);
  const retry = await (await call(SECRET)).json();
  check("lần cron sau (hết lỗi) → báo đúng 1 lần: mỗi học sinh 1 thông báo, có nhật ký và khoá", retry.notified === 1 && (await count(due3.slug, s1.id)) === 1 && (await count(due3.slug, s2.id)) === 1
    && !!(await prisma.auditLog.findFirst({ where: { action: "article.scheduled_notify", resourceId: due3.id } })) && !!(await prisma.settingKV.findUnique({ where: { key: `article.notified.${due3.id}` } })), retry);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
