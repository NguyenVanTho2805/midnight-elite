// BU-08 — Hàng chờ một cửa (Figma 608:1515): bảng NN/g + panel bên + chọn nhiều + thanh ngữ cảnh + hoàn tác 5 giây. Chụp 1280 và 390.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-hang-cho.ts   (DB thử, KHÔNG phải DB thật: bài tự wipe()).
import { mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";
import { COIN_VISIBLE } from "@/lib/features";

const N_REVIEWS = 6;
const SKIP_44 = /nextjs-portal|KinToast|Mở rộng thanh bên/;

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const author = await mkUser({ name: "Trần Thị Bích" });
  const course = await mkCourse(null, { name: "Toán 9 BU08" });

  // 6 đánh giá chờ (mỗi học sinh một đánh giá: unique userId+courseId)
  for (let i = 0; i < N_REVIEWS; i++) {
    const s = await mkUser({ name: `Em Đánh Giá ${i}` });
    await prisma.courseReview.create({ data: { userId: s.id, courseId: course.id, rating: 5 - (i % 3), comment: `DANH_GIA_${i} khoá học rất tốt`, status: "pending", createdAt: new Date(Date.now() - (N_REVIEWS - i) * 3_600_000) } });
  }
  // 1 báo cáo bài viết (để thử chọn lẫn loại), 1 báo cáo câu trả lời có thưởng, 2 yêu cầu nạp Coin (1 của chính người xem)
  const th = await prisma.thread.create({ data: { content: "BAI_GO_BO_BU08", authorId: author.id, category: "hoi-dap" } });
  await prisma.threadReport.create({ data: { threadId: th.id, reporterId: author.id, reason: "Quảng cáo" } });
  const q = await prisma.question.create({ data: { authorId: author.id, title: "CAU_HOI_BU08", content: "nội dung", bountyPaid: 0 } });
  const ans = await prisma.answer.create({ data: { questionId: q.id, authorId: author.id, content: "Trả lời sai", rewardPaid: 20 } });
  await prisma.answerReport.create({ data: { answerId: ans.id, reporterId: author.id, reason: "Sai kiến thức" } });
  const topupOther = await prisma.coinTopupRequest.create({ data: { userId: author.id, amountVnd: 100000, coinAmount: 100000, bankRef: "REF_BU08" } });
  await prisma.coinTopupRequest.create({ data: { userId: SA.id, amountVnd: 50000, coinAmount: 50000, bankRef: "REF_TU_DUYET" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };

  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  const rows = () => pg.locator("[data-queue-table] tbody tr");
  const panel = () => pg.locator("aside[data-side-panel]");
  const reqs: string[] = [];
  pg.on("request", r => { if (/\/api\/admin\/reviews\//.test(r.url()) && r.method() === "PATCH") reqs.push(r.url()); });

  section("Bảng 1280: cột đầu là định danh, ≤ 2 nút mỗi hàng");
  await pg.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.locator("[data-queue-table]").waitFor({ timeout: 120000 });
  const total = N_REVIEWS + 1 + 1 + (COIN_VISIBLE ? 2 : 0); // đánh giá + bài viết + trả lời (+ 2 nạp Coin khi cờ Coin bật; 05/11/2026 Coin ẩn → không có dòng nạp Coin)
  check(`${total} dòng; chip 'Tất cả ${total}' và 'Đánh giá khoá ${N_REVIEWS}'`, await rows().count() === total && await pg.locator('[data-chip="tat-ca"]').innerText() === `Tất cả ${total}` && /Đánh giá khoá 6/.test(await pg.locator('[data-chip="danh-gia"]').innerText()));
  const heads = await pg.locator("[data-queue-table] thead th").allInnerTexts();
  check("cột đầu là 'Việc' (định danh), không phải ô tick riêng", /^Việc$/i.test(heads[0].trim()) && heads.length === 5, heads);
  const first = rows().first();
  check("ô tick nằm TRONG ô cột đầu (cùng hàng th scope=row)", await first.locator('th[scope="row"] input[type=checkbox]').count() === 1);
  let maxBtn = 0; for (let i = 0; i < await rows().count(); i++) maxBtn = Math.max(maxBtn, await rows().nth(i).locator("button, a[href]").count());
  check("mỗi hàng ≤ 2 nút/liên kết (Xem + tối đa 1 lệnh nhanh)", maxBtn <= 2, maxBtn);
  check("đánh giá có lệnh nhanh 'Duyệt'; nạp Coin / trả lời không có lệnh nhanh", await rows().filter({ hasText: "DANH_GIA_0" }).locator("[data-row-quick]").count() === 1 && await rows().filter({ hasText: "REF_BU08" }).locator("[data-row-quick]").count() === 0);
  check("tên học sinh rút gọn 'Bích T.', không lộ email trong trang", /Bích T\./.test(await pg.innerText("body")) && !/@test\.local/.test(await pg.content()));
  const small = await pg.evaluate(`(() => [...document.querySelectorAll("button, a[href], input[type=checkbox]")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5) && !/nextjs-portal|KinToast|Mở rộng thanh bên/.test(e.closest("nextjs-portal") ? "nextjs-portal" : (e.getAttribute("aria-label") || "") + (e.textContent || "")) && !/styles-module__/.test(String(e.className)) && !e.closest("[data-feedback-toolbar],[data-annotation-popup],[data-annotation-marker]") && !e.closest("[class*=styles-module__]"); }).map(e => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 30)))()`) as string[];
  check("không nút/liên kết/ô tick nào < 44px (trừ 3 ngoại lệ đã nêu)", small.length === 0, small.filter(s => !SKIP_44.test(s)));
  check("không role=alert trần trong cây admin", await pg.locator('main [role="alert"]').count() === 0);
  await shot(pg, "admin-hang-cho-1280");

  section("Chọn tất cả / thanh ngữ cảnh / chọn lẫn loại");
  check("chưa chọn: không có thanh ngữ cảnh", await pg.locator("[data-bulk-bar]").count() === 0);
  await pg.getByLabel("Chọn tất cả các dòng đang hiện").check();
  check(`chọn tất cả → chọn đúng ${total} dòng đang hiện, thanh hiện 'Đã chọn ${total}'`, await pg.locator("[data-row] input:checked").count() === total && (await pg.locator("[data-bulk-count]").innerText()) === `Đã chọn ${total}`);
  check("chọn lẫn loại → KHÔNG có nút lệnh, có dòng 'Chọn cùng một loại'", await pg.locator("[data-bulk-cmd]").count() === 0 && /Chọn cùng một loại/.test(await pg.locator("[data-bulk-reason]").innerText()));
  await pg.getByLabel("Chọn tất cả các dòng đang hiện").uncheck();
  check("bỏ chọn → thanh ngữ cảnh biến mất", await pg.locator("[data-bulk-bar]").count() === 0);

  section("Lọc ?loai=: dải 'Đang lọc'");
  await pg.locator('[data-chip="danh-gia"]').click();
  await pg.waitForURL(/loai=danh-gia/, { timeout: 30000 });
  await pg.waitForFunction(`document.querySelectorAll("[data-queue-table] tbody tr").length === ${N_REVIEWS}`, null, { timeout: 60000 });
  check("dải 'Đang lọc: Đánh giá khoá' + nút xoá lọc", /Đang lọc: Đánh giá khoá/.test(await pg.locator("[data-dang-loc]").innerText()) && await pg.getByRole("link", { name: /Bỏ lọc/ }).count() === 1);

  section("Hoàn tác 5 giây: không có cuộc gọi API");
  await pg.getByLabel("Chọn tất cả các dòng đang hiện").check();
  await pg.locator('[data-bulk-cmd="approve"]').click();
  check("hiện đếm ngược và nút Hoàn tác", await pg.locator("[data-bulk-undo]").isVisible() && /sau [1-5] giây/.test(await pg.locator("[data-bulk-bar]").innerText()));
  await pg.locator("[data-bulk-undo]").click();
  await pg.waitForTimeout(6500);
  check("bấm Hoàn tác → đợi quá 5 giây vẫn KHÔNG có cuộc gọi PATCH nào, DB còn nguyên chờ", reqs.length === 0 && await prisma.courseReview.count({ where: { status: "pending" } }) === N_REVIEWS, reqs);
  check("sau Hoàn tác: các dòng vẫn còn, vẫn được chọn", await rows().count() === N_REVIEWS && await pg.locator("[data-row] input:checked").count() === N_REVIEWS);

  section("Hết 5 giây → gọi từng API; dòng biến mất; giữ lựa chọn các dòng còn lại");
  await pg.getByLabel("Chọn tất cả các dòng đang hiện").uncheck();
  await rows().nth(0).locator("input[type=checkbox]").check();
  await rows().nth(1).locator("input[type=checkbox]").check();
  await pg.locator('[data-bulk-cmd="approve"]').click();
  await pg.waitForFunction(`document.querySelectorAll("[data-queue-table] tbody tr").length === ${N_REVIEWS - 2}`, null, { timeout: 60000 });
  check("2 đánh giá được duyệt: 2 cuộc gọi, DB 'approved' = 2", reqs.length === 2 && await prisma.courseReview.count({ where: { status: "approved" } }) === 2, reqs.length);
  check("mỗi cuộc gọi tự ghi nhật ký review.approve (2 dòng)", await prisma.auditLog.count({ where: { action: "review.approve" } }) === 2);
  check("thanh báo 'Đã xử lý 2/2' và nói không hoàn tác được", /Đã xử lý 2\/2/.test(await pg.locator("[data-bulk-msg]").innerText()) && /không hoàn tác/.test(await pg.locator("[data-bulk-msg]").innerText()));

  section("Lệnh nhanh 1 chạm");
  await rows().first().locator("[data-row-quick]").click();
  await pg.waitForFunction(`document.querySelectorAll("[data-queue-table] tbody tr").length === ${N_REVIEWS - 3}`, null, { timeout: 60000 });
  check("'Duyệt' nhanh → dòng biến mất, DB approved = 3", await prisma.courseReview.count({ where: { status: "approved" } }) === 3);

  section("Panel bên: không hộp thoại, Esc đóng và trả tiêu điểm, chừa lề");
  await pg.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.locator("[data-queue-table]").waitFor({ timeout: 120000 });
  const tr = COIN_VISIBLE ? rows().filter({ hasText: "REF_BU08" }).first() : rows().filter({ hasText: "Câu trả lời bị báo cáo" }).first();
  const openBtn = tr.locator("[data-row-open]");
  await openBtn.focus(); await pg.keyboard.press("Enter");
  await panel().waitFor({ timeout: 30000 });
  check("panel là aside[data-side-panel]; [role=dialog] = 0", await panel().count() === 1 && await pg.locator("[role=dialog]").count() === 0);
  const lay = await pg.evaluate(`(() => { const t = document.querySelector("[data-queue-table]").getBoundingClientRect(); const p = document.querySelector("aside[data-side-panel]").getBoundingClientRect(); return { tableRight: t.right, panelLeft: p.left, scrollX: document.documentElement.scrollWidth - innerWidth }; })()`) as any;
  check("≥1280: bảng không bị panel đè (mép phải bảng ≤ mép trái panel), không tràn ngang", lay.tableRight <= lay.panelLeft + 1 && lay.scrollX <= 1, lay);
  if (COIN_VISIBLE) {
  const approve = panel().getByRole("button", { name: "Duyệt nạp Coin" });
  await approve.click();
  const okBtn = panel().getByRole("button", { name: /^Xác nhận: Duyệt nạp Coin/ });
  check("nạp Coin: Duyệt khoá cho tới khi tick 'Đã đối chiếu sao kê'", await okBtn.isDisabled());
  await panel().getByLabel("Đã đối chiếu sao kê").check();
  check("tick xong → nút xác nhận mở", await okBtn.isEnabled());
  await panel().getByRole("button", { name: "Quay lại" }).click();
  await panel().getByRole("button", { name: "Từ chối" }).click();
  check("từ chối cần lý do (nút xác nhận khoá khi trống)", await panel().getByRole("button", { name: /^Xác nhận: Từ chối/ }).isDisabled());
  }
  await pg.keyboard.press("Escape");
  await panel().waitFor({ state: "detached", timeout: 10000 });
  // adm-test: tiêu điểm trả về trong requestAnimationFrame SAU khi panel gỡ — chờ tối đa 3 giây thay vì đọc ngay (đọc ngay là cuộc đua).
  const focusBack = await pg.waitForFunction(`document.activeElement?.getAttribute("data-row-open") !== null && document.activeElement?.getAttribute("data-row-open") !== undefined`, null, { timeout: 3000 }).then(() => true, () => false);
  check("Esc đóng panel và trả tiêu điểm về nút 'Xem' của dòng", focusBack, await pg.evaluate(`document.activeElement?.outerHTML.slice(0,120)`));

  if (COIN_VISIBLE) {
  // nạp Coin của chính mình: khoá hẳn
  const mine = rows().filter({ hasText: "REF_TU_DUYET" }).first();
  await mine.locator("[data-row-open]").click();
  await panel().waitFor({ timeout: 30000 });
  check("yêu cầu của chính người xem: nút Duyệt khoá hẳn + nói lý do", await panel().getByRole("button", { name: "Duyệt nạp Coin" }).isDisabled() && /Không tự duyệt yêu cầu của chính mình/.test(await panel().innerText()));
  await pg.keyboard.press("Escape");
  }

  // trả lời có thưởng: phải tick trừ Coin
  await rows().filter({ hasText: "Câu trả lời bị báo cáo" }).locator("[data-row-open]").click();
  await panel().waitFor({ timeout: 30000 });
  check("trả lời có thưởng: panel nói trừ phần thưởng (Coin ẩn: không có chữ Coin)", COIN_VISIBLE ? /Sẽ trừ 20 Coin/.test(await panel().innerText()) : (/Sẽ trừ lại phần thưởng/.test(await panel().innerText()) && !/coin/i.test(await panel().innerText())));
  await panel().getByRole("button", { name: "Xác nhận vi phạm" }).click();
  check("'Xác nhận vi phạm' chỉ mở sau khi tick 'Tôi hiểu sẽ trừ 20 Coin'", await panel().getByRole("button", { name: /^Xác nhận: Xác nhận vi phạm/ }).isDisabled());
  await panel().getByLabel(COIN_VISIBLE ? /Tôi hiểu sẽ trừ 20 Coin/ : /Tôi hiểu sẽ trừ lại phần thưởng/).check();
  check("tick → mở", await panel().getByRole("button", { name: /^Xác nhận: Xác nhận vi phạm/ }).isEnabled());
  await pg.keyboard.press("Escape");

  if (COIN_VISIBLE) {
  // duyệt thật một nạp Coin của người khác → 409 coi như xong ở lần hai
  await tr.locator("[data-row-open]").click();
  await panel().waitFor({ timeout: 30000 });
  await panel().getByRole("button", { name: "Duyệt nạp Coin" }).click();
  await panel().getByLabel("Đã đối chiếu sao kê").check();
  await prisma.coinTopupRequest.update({ where: { id: topupOther.id }, data: { status: "approved", reviewedAt: new Date(), reviewedBy: SA.id } }); // người khác vừa xử lý
  await panel().getByRole("button", { name: /^Xác nhận: Duyệt nạp Coin/ }).click();
  await pg.waitForFunction(`!document.querySelector("aside[data-side-panel]")`, null, { timeout: 60000 });
  check("API trả 409 (đã có người xử lý) → coi như xong: panel đóng, dòng biến mất", await rows().filter({ hasText: "REF_BU08" }).count() === 0);
  }

  section("Trạng thái rỗng / rỗng khi lọc / 403 loại");
  await pg.goto(`${ADMIN}/admin/kiem-duyet?loai=khach-hoi`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.getByText(/Bạn không có quyền xem loại này|Không có việc loại này/).first().waitFor({ timeout: 60000 });
  check("loại chưa hỗ trợ (BU-05 chưa gộp) → nói rõ, có 'Xoá lọc', không ngõ cụt", await pg.getByRole("link", { name: "Xoá lọc" }).count() >= 1);
  await ctx.close();

  section("Điện thoại 390px: thẻ, không tràn, nút ≥ 44px");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pm.locator("[data-queue-cards]").waitFor({ timeout: 120000 });
  check("390: danh sách thẻ (không bảng), không tràn ngang", await pm.locator("[data-queue-table]").count() === 0 && await pm.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  const cardH = await pm.locator("[data-queue-cards] > li").first().evaluate(e => e.getBoundingClientRect().height);
  check("thẻ cao ≥ 72px", cardH >= 72, cardH);
  await pm.locator("[data-queue-cards] > li").first().locator("[data-row-open]").click();
  await pm.locator("aside[data-side-panel]").waitFor({ timeout: 30000 });
  const pr = await pm.evaluate(`(() => { const r = document.querySelector("aside[data-side-panel]").getBoundingClientRect(); return { w: r.width, vw: innerWidth }; })()`) as any;
  check("390: panel là tấm toàn màn hình, không tràn", Math.abs(pr.w - pr.vw) <= 1 && await pm.locator("[role=dialog]").count() === 0, pr);
  await shot(pm, "admin-hang-cho-390");
  await cm.close();

  check("không lỗi console/pageerror lạ", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
