// ADM-002 (API + DB thật) — bài viết: luật máy chủ (slug / tiêu đề / nội dung) và thông báo "Bài viết mới" tối đa MỘT lần cho mỗi bài.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-002.ts  (Postgres + Next dev, xem README).
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - Bỏ `validateArticleText` ở POST → ca "tiêu đề 9 ký tự → 400" đỏ.
//   - Bỏ `{ slugChanged: ... }` ở PATCH → ca "bài cũ ngắn vẫn bật/tắt đăng được" đỏ.
//   - Trong noticeArticlePublishedNow bỏ nhánh P2002 (hoặc bỏ tạo khoá) → ca "bật → tắt → bật lại: vẫn đúng 1 thông báo" đỏ.
//   - Bỏ kiểm `before` (thông báo cũ theo link) → ca "bài đã báo từ trước khi có khoá" đỏ.
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkSuper, wipe, check, section, done } from "./h";
import { articleNotifiedKey } from "@/lib/articleSchedule";
import { runArticlePublishNotices } from "@/lib/articleScheduleServer";

const PAD = "Nội dung đủ dài để qua luật tối thiểu một trăm ký tự của bài viết trên KiN. ".repeat(2);
const U = "/api/admin/articles";
const body = (o: Record<string, unknown> = {}) => ({ title: "Thông báo tuyển sinh 2026", slug: "thong-bao-ts-2026", excerpt: "Tóm tắt bài.", content: PAD, category: "tuyen-sinh", published: false, ...o });
const notices = (slug: string) => prisma.notification.count({ where: { type: "article_new", link: `/tin-tuc/${slug}` } });

async function main() {
  await wipe();
  const SA = await mkSuper();
  const S1 = await mkUser({ name: "Em Một" }), S2 = await mkUser({ name: "Em Hai" });
  const hidden = await mkUser({ name: "Em Đã Ẩn" });
  await prisma.user.update({ where: { id: hidden.id }, data: { deletedAt: new Date(), banned: true } });

  section("POST: luật máy chủ");
  let r = await api("POST", U, { as: SA, body: body({ title: "Tám ký tự" }) });
  check("tiêu đề 9 ký tự → 400, nêu field title", r.status === 400 && r.json?.field === "title" && /10 ký tự/.test(r.json?.error ?? ""), r);
  r = await api("POST", U, { as: SA, body: body({ content: "n".repeat(99) }) });
  check("nội dung 99 ký tự → 400, nêu field content", r.status === 400 && r.json?.field === "content", r);
  for (const [n, slug] of [["2 ký tự", "ab"], ["81 ký tự", "a".repeat(81)], ["chữ hoa", "Bai-Viet"], ["có dấu", "tuyển-sinh"], ["gạch dưới", "bai_viet"], ["chỉ gạch ngang", "---"]] as const) {
    r = await api("POST", U, { as: SA, body: body({ slug }) });
    check(`slug sai (${n}) → 400, nêu field slug`, r.status === 400 && r.json?.field === "slug", r);
  }
  check("không có bài nào được tạo bởi các yêu cầu sai", (await prisma.article.count()) === 0);
  r = await api("POST", U, { as: SA, body: body({ title: "x".repeat(10), slug: "abc", content: "n".repeat(100) }) });
  check("biên: tiêu đề đúng 10, slug đúng 3, nội dung đúng 100 → 201", r.status === 201, r);
  r = await api("POST", U, { as: SA, body: body({ slug: "a".repeat(80) }) });
  check("biên: slug đúng 80 ký tự → 201", r.status === 201, r);
  check("slug ngắn kiểu cũ ('x') không còn tạo được (trước đây regex cho 1–200)", (await api("POST", U, { as: SA, body: body({ slug: "x" }) })).status === 400);

  section("PATCH: chỉ kiểm trường được gửi");
  const legacy = await prisma.article.create({ data: { slug: "Bai_Cu", title: "Cũ", excerpt: "x", content: "ngắn", category: "tuyen-sinh", author: "A", authorId: "", published: true, publishedAt: new Date(Date.now() - 86_400_000) } });
  r = await api("PATCH", `${U}/${legacy.id}`, { as: SA, body: { published: false } });
  check("bài cũ ngắn (slug sai, tiêu đề/nội dung ngắn) vẫn gỡ đăng được khi chỉ gửi published", r.status === 200 && r.json?.published === false, r);
  r = await api("PATCH", `${U}/${legacy.id}`, { as: SA, body: { slug: "Bai_Cu", published: true } });
  check("gửi lại đúng slug cũ không hợp lệ → vẫn qua (slug không đổi)", r.status === 200, r);
  r = await api("PATCH", `${U}/${legacy.id}`, { as: SA, body: { slug: "bai-cu-moi", title: "Tiêu đề mới đủ dài" } });
  check("đổi sang slug hợp lệ + tiêu đề đủ dài → 200", r.status === 200 && r.json?.slug === "bai-cu-moi", r);
  r = await api("PATCH", `${U}/${legacy.id}`, { as: SA, body: { slug: "Sai Roi" } });
  check("đổi sang slug sai → 400 field slug", r.status === 400 && r.json?.field === "slug", r);
  r = await api("PATCH", `${U}/${legacy.id}`, { as: SA, body: { title: "ngắn" } });
  check("gửi tiêu đề ngắn → 400 field title", r.status === 400 && r.json?.field === "title", r);
  r = await api("PATCH", `${U}/${legacy.id}`, { as: SA, body: { content: "ngắn" } });
  check("gửi nội dung ngắn → 400 field content", r.status === 400 && r.json?.field === "content", r);
  check("sau các yêu cầu 400 bài giữ nguyên tiêu đề/nội dung đã lưu", (await prisma.article.findUniqueOrThrow({ where: { id: legacy.id } })).content === "ngắn");

  section("Thông báo: tối đa MỘT lần mỗi bài");
  await wipe(); const SA2 = await mkSuper(); const A = await mkUser({ name: "Em A" }), B = await mkUser({ name: "Em B" });
  const sys = await mkUser({ name: "Tài khoản ẩn" }); await prisma.user.update({ where: { id: sys.id }, data: { deletedAt: new Date(), banned: true } });
  r = await api("POST", U, { as: SA2, body: body({ slug: "tb-mot-lan", published: true }) });
  check("tạo bài đã đăng → 201 và đúng 2 thông báo (2 học sinh đang hoạt động, không tính tài khoản đã ẩn)", r.status === 201 && (await notices("tb-mot-lan")) === 2, r);
  const id = r.json.id;
  check("khoá article.notified.<id> đã ghi", !!(await prisma.settingKV.findUnique({ where: { key: articleNotifiedKey(id) } })));
  r = await api("PATCH", `${U}/${id}`, { as: SA2, body: { published: false } });
  check("gỡ đăng không tạo thông báo", r.status === 200 && (await notices("tb-mot-lan")) === 2);
  r = await api("PATCH", `${U}/${id}`, { as: SA2, body: { published: true } });
  check("bật → tắt → bật lại: vẫn đúng 2 thông báo (không báo lần hai)", r.status === 200 && (await notices("tb-mot-lan")) === 2, r);
  r = await api("PATCH", `${U}/${id}`, { as: SA2, body: { isPinned: true } });
  check("sửa trường khác không báo thêm", (await notices("tb-mot-lan")) === 2);

  section("Thông báo: bài nháp rồi đăng");
  r = await api("POST", U, { as: SA2, body: body({ slug: "tb-nhap-roi-dang", published: false }) });
  check("tạo nháp → 0 thông báo", r.status === 201 && (await notices("tb-nhap-roi-dang")) === 0);
  const id2 = r.json.id;
  r = await api("PATCH", `${U}/${id2}`, { as: SA2, body: { published: true } });
  check("bật đăng lần đầu → 2 thông báo", r.status === 200 && (await notices("tb-nhap-roi-dang")) === 2, r);
  await api("PATCH", `${U}/${id2}`, { as: SA2, body: { published: false } });
  await api("PATCH", `${U}/${id2}`, { as: SA2, body: { published: true } });
  check("đăng lại lần nữa vẫn 2", (await notices("tb-nhap-roi-dang")) === 2);

  section("Thông báo: hai yêu cầu đăng cùng lúc");
  r = await api("POST", U, { as: SA2, body: body({ slug: "tb-song-song", published: false }) });
  const id3 = r.json.id;
  const both = await Promise.all([api("PATCH", `${U}/${id3}`, { as: SA2, body: { published: true } }), api("PATCH", `${U}/${id3}`, { as: SA2, body: { published: true } })]);
  check("hai PATCH đăng song song → đúng 2 thông báo, không gấp đôi", both.every(x => x.status === 200) && (await notices("tb-song-song")) === 2, both.map(x => x.status));

  section("Thông báo: bài đã báo từ trước khi có khoá");
  const old = await prisma.article.create({ data: { slug: "bai-bao-truoc", title: "Bài đã báo trước đây", excerpt: "x", content: PAD, category: "tuyen-sinh", author: "A", authorId: SA2.id, published: false } });
  await prisma.notification.create({ data: { userId: A.id, type: "article_new", title: "Bài viết mới", message: "x", link: "/tin-tuc/bai-bao-truoc" } });
  r = await api("PATCH", `${U}/${old.id}`, { as: SA2, body: { published: true } });
  check("đã có thông báo theo link (không có khoá) → đăng không báo lại, ghi khoá", r.status === 200 && (await notices("bai-bao-truoc")) === 1 && !!(await prisma.settingKV.findUnique({ where: { key: articleNotifiedKey(old.id) } })), r);

  section("Thông báo: cron không báo đôi với API");
  const due = await api("POST", U, { as: SA2, body: body({ slug: "tb-cron-sau", published: true }) });
  check("đăng ngay qua API → 2 thông báo", due.status === 201 && (await notices("tb-cron-sau")) === 2);
  const run = await runArticlePublishNotices(new Date(Date.now() + 60_000));
  check("cron chạy sau đó không báo lại bài này", (await notices("tb-cron-sau")) === 2 && run.notified === 0, run);

  section("Bài hẹn giờ tương lai: API không báo, cron báo MỘT lần");
  const future = new Date(Date.now() + 3600_000).toISOString();
  const f = await api("POST", U, { as: SA2, body: body({ slug: "tb-hen-gio", published: true, publishedAt: future }) });
  check("hẹn giờ tương lai → chưa báo", f.status === 201 && (await notices("tb-hen-gio")) === 0, f);
  const later = new Date(Date.now() + 2 * 3600_000);
  const c1 = await runArticlePublishNotices(later);
  check("tới giờ cron báo → 2 thông báo", (await notices("tb-hen-gio")) === 2 && c1.notified >= 1, c1);
  await api("PATCH", `${U}/${f.json.id}`, { as: SA2, body: { published: false } });
  await api("PATCH", `${U}/${f.json.id}`, { as: SA2, body: { published: true } });
  check("đã báo bằng cron rồi, bật lại đăng qua API → vẫn 2", (await notices("tb-hen-gio")) === 2);

  section("Người không quyền không báo được");
  const t = await mkUser({ name: "Em Không Quyền" });
  r = await api("POST", U, { as: t, body: body({ slug: "tb-khong-quyen", published: true }) });
  check("học sinh POST → 403, không có bài, không có thông báo", r.status === 403 && (await prisma.article.count({ where: { slug: "tb-khong-quyen" } })) === 0 && (await notices("tb-khong-quyen")) === 0, r);
  void S1; void S2; void B;
  done();
}
main().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
