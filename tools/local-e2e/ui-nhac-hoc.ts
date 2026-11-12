// LOI-04 mục 8 — "Nhắc học" của học sinh, trình duyệt thật, 1600 và 390 (ảnh: scratchpad/shots/loi04-*.png; SHOTS=<thư mục> để đổi):
//   thanh có "Nhắc học" (điện thoại 4 ô khi LICH tắt, 5 khi bật) · nhãn vai .kin-rail-role "HỌC SINH"
//   → tài khoản MỚI: rỗng theo nhóm (Hôm nay / Tất cả) + ô thêm nhanh → gõ "Ôn chương 2 #toan" Enter (Enter hai lần nhanh chỉ tạo 1 mục) ⇒ hàng có "#toan", ô xoá + giữ con trỏ
//   → mở chi tiết (1600: panel phải, danh sách vẫn thấy; 390: thay danh sách, ?muc=<id>, nút Quay lại của máy về danh sách) → hẹn ngày mai 15:00 ⇒ "Đã hẹn" "Ngày mai · 15:00"
//   → thêm thẻ (thẻ hỏng báo lỗi tại chỗ), lọc thẻ (lọc rỗng "Không có mục nào mang #…" + Bỏ lọc thẻ) → dán link trong ghi chú ⇒ link tab mới, không dính ")."
//   → bấm Xong ⇒ sang "Đã xong" → "Xoá các mục đã xong" (KinConfirm) ⇒ rỗng
//   → học sinh có dữ liệu giả (mock/loi-03 + mock/loi-04): "Quá hạn" có CHỮ, quá hạn lên đầu; "Hôm nay" có [data-nhac-buoi] bài 19:30 với Mở ↗ / Bài Azota ↗ / Làm bài tập,
//     khối buổi học TRÊN mục tự ghi, KHÔNG có bài nháp; "Đã hẹn" có mục gắn lớp Văn + buổi Ngày mai 00:30 (chỉ tên bài, không tài liệu)
//   → "Ghi chú cho buổi này" tạo mục gắn bài (lop.lessonId, 19:30) và mở chi tiết → PATCH 500 ⇒ lỗi tại chỗ, không báo xong giả → GET 500 ⇒ ErrorStrip + Thử lại
//   → quản trị xem thử ⇒ "Nhắc học chỉ dùng được với tài khoản học sinh." (không ErrorStrip) → khách ⇒ /dang-nhap?redirect=/student/nhac-hoc (waitForURL).
//   Riêng tư: title trang không chứa ghi chú; không console nào in ghi chú. 390: không cuộn ngang; mọi nút / liên kết / ô Xong ≥ 44px.
// Dữ liệu: wipe() DB riêng của worktree rồi chạy CHÍNH mock/loi-03.ts + mock/loi-04.ts (của stu-code) với học sinh của bài này. "Hôm nay" theo giờ VN lúc chạy —
// chạy sát 00:00 VN có thể đỏ giả, chạy lại. Không bật máy chủ dev ở đây: stu-test chạy `source scratchpad/env.sh && npx tsx tools/local-e2e/ui-nhac-hoc.ts`.
import { BASE, mkTutor, mkSuper, mkUser, wipe, check, section, done, eventually, type TUser } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import type { MockCtx } from "./mock-seed";
import mockLoi03 from "./mock/loi-03";
import mockLoi04 from "./mock/loi-04";

const NOT_OVERFLOW = `document.documentElement.scrollWidth <= window.innerWidth`;
const RAIL = "Module của học sinh";
const MOBILE_CELLS = featureOn("LICH") ? 5 : 4;
const MOCK_IDS = ["nh-loi04-luong-giac", "nh-loi04-khao-sat", "nh-loi04-lang", "nh-loi04-but-chi", "nh-loi04-de-thu"];
const NOTE_SECRET = "Ôn sin, cos, tan"; // chữ trong ghi chú giả — không được lọt ra title / console

type Item = { id: string; title: string; tags: string[]; dueDate: string | null; dueTime: string | null; doneAt: string | null; note: string | null; lop: { lessonId: string | null; courseName: string } | null };

(async () => {
  await wipe();
  const today = vnDateKeyOf(new Date());
  const tomorrow = addDaysKey(today, 1);
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" });
  const SA = await mkSuper("Quản trị");
  const ctx = { prisma, tutor: T, student: S, admin: SA } as unknown as MockCtx; // hai mock chỉ đọc prisma / tutor / student
  for (const line of [...(await mockLoi03(ctx)), ...(await mockLoi04(ctx))]) console.log(`  · ${line}`);
  const resetMock = async () => {
    await prisma.studentReminder.deleteMany({ where: { userId: S.id, id: { notIn: MOCK_IDS } } });
    await mockLoi04(ctx);
  };

  await launch();
  const errors: string[] = [];
  const consoleText: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => {
      consoleText.push(m.text());
      if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 400)}`);
    });
  };
  const open = async (u: TUser | null, w: number, path = "/student/nhac-hoc") => {
    const c = await ctxFor(u, { width: w, height: w <= 400 ? 844 : 1000 });
    const p = await c.newPage(); watch(p);
    await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
    return { c, p };
  };
  const items = async (p: Page) => ((await p.evaluate(`fetch("/api/student/nhac-hoc", { cache: "no-store" }).then(r => r.json())`)) as { items: Item[] }).items;
  // Vùng chạm < 44px trong trang: nút, liên kết, ô Xong (input checkbox trong suốt 44×44). Liên kết NẰM TRONG đoạn ghi chú là chữ thường trong câu ⇒ không tính.
  const tooSmall = (p: Page) => p.evaluate(`[...document.querySelectorAll("main a, main button, main input[type=checkbox]")]
    .filter(e => e.offsetParent && !e.closest("[inert]") && !e.closest("[data-nhac-ghi-chu-xem]") && e.getBoundingClientRect().width > 0)
    .map(e => [Math.round(e.getBoundingClientRect().height), (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)])
    .filter(([h]) => h < 44)`) as Promise<[number, string][]>;
  const nhom = (p: Page, k: string) => p.locator(`[data-nhac-nhom="${k}"]`);
  const row = (p: Page, id: string) => p.locator(`[data-nhac-muc="${id}"]`);
  const panel = (p: Page) => p.locator("[data-nhac-chi-tiet]");
  const saved = (p: Page) => eventually("panel báo 'Đã lưu'", async () => /Đã lưu/.test(await p.locator("[data-nhac-luu]").innerText()), 20000);

  for (const w of [1600, 390]) {
    const narrow = w === 390;
    // ═════════ Tài khoản mới: rỗng → thêm nhanh → chi tiết → hẹn → thẻ → ghi chú → xong → xoá đã xong ═════════
    section(`${w}px · tài khoản mới — rỗng, thêm nhanh`);
    const E = await mkUser({ name: `Bạn Mới ${w}` });
    const { c, p } = await open(E, w);
    await p.getByRole("heading", { level: 1, name: "Nhắc học" }).waitFor({ timeout: 120000 });
    await p.locator("[data-nhac-them]").waitFor({ timeout: 60000 });
    check("h1 'Nhắc học' + dòng phụ 'Chỉ mình bạn xem được.'", await p.getByText("Việc bạn tự ghi và buổi học có hẹn ngày. Chỉ mình bạn xem được.").isVisible());
    check("title trang 'Nhắc học — KiN'", (await p.title()) === "Nhắc học — KiN", await p.title());
    check("nhãn vai .kin-rail-role 'HỌC SINH'", ((await p.locator(".kin-rail-role").first().textContent()) ?? "").trim() === "HỌC SINH");
    const navLinks = p.getByRole("navigation", { name: RAIL }).getByRole("link", { name: /^Nhắc học/ });
    check("thanh module có 'Nhắc học' → /student/nhac-hoc, aria-current=page", (await navLinks.count()) >= 1 && (await navLinks.first().getAttribute("href")) === "/student/nhac-hoc" && (await navLinks.first().getAttribute("aria-current")) === "page");
    if (narrow) {
      const cells = await p.evaluate(`[...document.querySelectorAll('nav[aria-label="${RAIL}"] a, nav[aria-label="${RAIL}"] button')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height))`) as number[];
      check(`390: thanh dưới ${MOBILE_CELLS} ô (Việc của tôi · Nhắc học · Lớp của tôi · Khác${MOBILE_CELLS === 5 ? " · Lịch học" : ""}), mỗi ô ≥ 44px`, cells.length === MOBILE_CELLS && cells.every(h => h >= 44), cells);
    }
    check("ô thêm nhanh: nhãn 'Thêm nhắc việc', placeholder có '#thẻ' và 'Enter'", (await p.getByLabel("Thêm nhắc việc").count()) === 1 && /#thẻ.*Enter/.test((await p.locator("[data-nhac-them]").getAttribute("placeholder")) ?? ""));
    check("4 nhóm Hôm nay (0) · Đã hẹn (0) · Tất cả (0) · Đã xong (0), 'Hôm nay' aria-pressed", (await p.getByRole("navigation", { name: "Nhóm nhắc việc" }).locator("[data-nhac-nhom]").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim()).join("|") === "Hôm nay (0)|Đã hẹn (0)|Tất cả (0)|Đã xong (0)" && (await nhom(p, "hom-nay").getAttribute("aria-pressed")) === "true");
    check("rỗng 'Hôm nay': 'Hôm nay chưa có việc nào. Gõ vào ô trên để thêm.'", (await p.locator('[data-nhac-rong="hom-nay"]').innerText()).trim() === "Hôm nay chưa có việc nào. Gõ vào ô trên để thêm.");
    await nhom(p, "tat-ca").click();
    await eventually("rỗng 'Tất cả': 'Chưa có nhắc việc nào' + câu giải thích", async () => /Chưa có nhắc việc nào/.test(await p.locator('[data-nhac-rong="tat-ca"]').innerText()) && /như ghi chú trên điện thoại/.test(await p.locator('[data-nhac-rong="tat-ca"]').innerText()));
    if (narrow) check("390 rỗng: không cuộn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
    await shot(p, `loi04-rong-${w}`);
    await nhom(p, "hom-nay").click();

    const quick = p.locator("[data-nhac-them]");
    await quick.fill("Ôn chương 2 #toan");
    await quick.press("Enter");
    await quick.press("Enter"); // Enter đôi: ô đang khoá ⇒ không tạo mục thứ hai
    await eventually("gõ 'Ôn chương 2 #toan' + Enter ⇒ hàng mới 'Ôn chương 2' có '#toan' và 'Hôm nay'", async () => {
      const r = p.locator("[data-nhac-muc]");
      return (await r.count()) === 1 && /Ôn chương 2/.test(await r.innerText()) && /#toan/.test(await r.innerText()) && /Hôm nay/.test(await r.innerText());
    }, 30000);
    await p.waitForTimeout(800);
    let mine = await items(p);
    check("Enter hai lần nhanh chỉ tạo ĐÚNG 1 mục; tiêu đề đã tách thẻ, hẹn hôm nay (đang ở nhóm Hôm nay), chưa có giờ", mine.length === 1 && mine[0].title === "Ôn chương 2" && mine[0].tags.join() === "toan" && mine[0].dueDate === today && mine[0].dueTime === null, mine);
    check("ô thêm nhanh đã xoá chữ và vẫn giữ con trỏ", (await quick.inputValue()) === "" && (await p.evaluate(`document.activeElement?.hasAttribute("data-nhac-them")`)) === true);
    const id = mine[0].id;
    check("ô 'Xong' của hàng có nhãn 'Đánh dấu xong: Ôn chương 2'", (await p.getByRole("checkbox", { name: "Đánh dấu xong: Ôn chương 2" }).count()) === 1);

    section(`${w}px · mở chi tiết`);
    await row(p, id).locator("[data-nhac-mo]").click();
    await panel(p).waitFor({ timeout: 30000 });
    if (narrow) {
      await p.waitForURL(u => u.searchParams.get("muc") === id, { timeout: 30000 });
      check("390: chi tiết THAY danh sách (ô thêm nhanh + danh sách ẩn), có nút '← Nhắc học', không hộp thoại", !(await quick.isVisible()) && !(await row(p, id).isVisible()) && await p.locator("[data-nhac-quay-lai]").isVisible() && (await p.getByRole("dialog").count()) === 0);
      await p.goBack();
      await p.waitForURL(u => !u.searchParams.has("muc"), { timeout: 30000 });
      await eventually("390: nút Quay lại của máy ⇒ về danh sách, chi tiết đóng", async () => await row(p, id).isVisible() && (await panel(p).count()) === 0, 15000);
      await row(p, id).locator("[data-nhac-mo]").click();
      await p.waitForURL(u => u.searchParams.get("muc") === id, { timeout: 30000 });
      await panel(p).waitFor({ timeout: 30000 });
    } else {
      const lb = await row(p, id).boundingBox(), pb = await p.locator('aside[aria-label="Chi tiết nhắc việc"]').boundingBox();
      check("1600: panel chi tiết bên PHẢI danh sách, danh sách vẫn thấy, không hộp thoại", !!lb && !!pb && pb.x > lb.x + lb.width - 1 && await row(p, id).isVisible() && (await p.getByRole("dialog").count()) === 0, { lb, pb });
      check("1600: panel rộng ~400px, ba cột (nhóm bên trái danh sách)", !!pb && pb.width >= 380 && pb.width <= 430 && ((await nhom(p, "hom-nay").boundingBox())?.x ?? 9999) < (lb?.x ?? 0), pb);
    }
    check("chi tiết: tiêu đề 'Ôn chương 2', chip '#toan', câu riêng tư cuối panel", (await panel(p).locator("[data-nhac-tieu-de]").inputValue()) === "Ôn chương 2" && (await panel(p).locator('[data-nhac-the-chip="toan"]').count()) === 1 && await panel(p).getByText("Ghi chú chỉ mình bạn xem. Đừng ghi mật khẩu hay số điện thoại vào đây.").isVisible());

    section(`${w}px · hẹn ngày mai 15:00`);
    await panel(p).locator("[data-nhac-ngay]").fill(tomorrow);
    await panel(p).locator("[data-nhac-ngay]").blur();
    await saved(p);
    await panel(p).locator("[data-nhac-gio]").fill("15:00");
    await panel(p).locator("[data-nhac-gio]").blur();
    await eventually("máy chủ lưu dueDate = ngày mai, dueTime = 15:00", async () => { const it = (await items(p))[0]; return it.dueDate === tomorrow && it.dueTime === "15:00"; }, 20000);
    // Có giờ mà xoá ngày ⇒ chặn tại chỗ, không gửi.
    await panel(p).locator("[data-nhac-ngay]").fill("");
    await panel(p).locator("[data-nhac-ngay]").blur();
    await eventually("xoá ngày khi còn giờ ⇒ báo 'cần chọn ngày' tại chỗ, máy chủ vẫn giữ ngày mai 15:00", async () => /cần chọn ngày/.test(await p.locator("[data-nhac-loi-hen]").innerText().catch(() => "")) && (await items(p))[0].dueDate === tomorrow, 10000);
    await panel(p).locator("[data-nhac-ngay]").fill(tomorrow);
    await panel(p).locator("[data-nhac-ngay]").blur();

    section(`${w}px · thẻ`);
    const tagIn = panel(p).locator("[data-nhac-the-o]");
    await tagIn.fill("<b>");
    await tagIn.press("Enter");
    await eventually("thẻ hỏng '<b>' ⇒ lỗi tại chỗ, không lưu", async () => /không hợp lệ/.test(await p.locator("[data-nhac-loi-the]").innerText().catch(() => "")) && (await items(p))[0].tags.join() === "toan", 10000);
    await tagIn.fill("#Ôn-Thi");
    await tagIn.press("Enter");
    await eventually("gõ '#Ôn-Thi' Enter ⇒ chip '#ôn-thi' (chuẩn hoá), máy chủ có 2 thẻ", async () => (await panel(p).locator('[data-nhac-the-chip="ôn-thi"]').count()) === 1 && (await items(p))[0].tags.join() === "toan,ôn-thi", 20000);

    section(`${w}px · ghi chú có link`);
    await panel(p).locator("[data-nhac-ghi-chu]").fill("Tài liệu cô gửi: https://azota.vn/x). Làm trước thứ Sáu.");
    await panel(p).locator("[data-nhac-ghi-chu]").blur();
    const noteLink = panel(p).locator('[data-nhac-ghi-chu-xem] a[href="https://azota.vn/x"]');
    await eventually("sau khi rời ô: ghi chú hiện dạng xem, link https://azota.vn/x (không dính ').')", async () => (await noteLink.count()) === 1 && (await noteLink.innerText()) === "https://azota.vn/x", 20000);
    check("link trong ghi chú mở tab mới, rel='noopener noreferrer'", (await noteLink.getAttribute("target")) === "_blank" && /noopener/.test((await noteLink.getAttribute("rel")) ?? "") && /noreferrer/.test((await noteLink.getAttribute("rel")) ?? ""));
    check("ghi chú KHÔNG lọt vào title trang", !/azota|Tài liệu cô gửi/.test(await p.title()));
    if (narrow) {
      check("390 chi tiết: không cuộn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
      const s = await tooSmall(p);
      check("390 chi tiết: mọi nút / liên kết / ô Xong cao ≥ 44px", s.length === 0, s.slice(0, 6));
    }
    await shot(p, `loi04-chi-tiet-${w}`);

    section(`${w}px · 'Đã hẹn' + lọc thẻ`);
    if (narrow) { await p.locator("[data-nhac-quay-lai]").click(); await p.waitForURL(u => !u.searchParams.has("muc"), { timeout: 30000 }); }
    await nhom(p, "da-hen").click();
    await eventually("'Đã hẹn' có mục với dòng phụ 'Ngày mai · 15:00'", async () => (await row(p, id).count()) === 1 && /Ngày mai · 15:00/.test(await row(p, id).innerText()), 15000);
    check("hôm nay không còn mục ⇒ 'Hôm nay (0)', 'Đã hẹn (1)'", /Hôm nay\s*\(0\)/.test(await nhom(p, "hom-nay").innerText()) && /Đã hẹn\s*\(1\)/.test(await nhom(p, "da-hen").innerText()));
    const chip = p.locator('[data-nhac-the="ôn-thi"]');
    check("chip lọc '#ôn-thi (1)' có trong nhóm 'Lọc theo thẻ'", (await p.getByRole("group", { name: "Lọc theo thẻ" }).locator("[data-nhac-the]").count()) === 2 && /#ôn-thi\s*\(1\)/.test(await chip.innerText()));
    await chip.click();
    await eventually("bấm chip ⇒ aria-pressed=true, mục vẫn hiện ở 'Đã hẹn'", async () => (await chip.getAttribute("aria-pressed")) === "true" && await row(p, id).isVisible(), 8000);
    await nhom(p, "hom-nay").click();
    await eventually("lọc '#ôn-thi' ở 'Hôm nay' ⇒ 'Không có mục nào mang #ôn-thi.' + nút 'Bỏ lọc thẻ'", async () => /Không có mục nào mang #ôn-thi\./.test(await p.locator('[data-nhac-rong="hom-nay"]').innerText()) && (await p.getByRole("button", { name: "Bỏ lọc thẻ" }).count()) >= 1, 8000);
    await p.locator("[data-nhac-bo-loc]").click();
    await eventually("'Bỏ lọc thẻ' ⇒ chip hết sáng", async () => (await chip.getAttribute("aria-pressed")) === "false", 8000);

    section(`${w}px · bấm Xong ⇒ 'Đã xong' → xoá các mục đã xong`);
    await nhom(p, "da-hen").click();
    await row(p, id).locator("[data-nhac-xong]").click();
    await eventually("bấm 'Xong' ⇒ mục rời 'Đã hẹn', 'Đã xong (1)'", async () => (await row(p, id).count()) === 0 && /Đã xong\s*\(1\)/.test(await nhom(p, "da-xong").innerText()), 20000);
    mine = await items(p);
    check("máy chủ đặt doneAt (giao diện không tự báo xong)", !!mine[0].doneAt, mine[0]);
    await nhom(p, "da-xong").click();
    await eventually("'Đã xong' có mục, ô Xong đã tích", async () => (await row(p, id).count()) === 1 && await row(p, id).locator("[data-nhac-xong]").isChecked(), 8000);
    await p.locator("[data-nhac-xoa-da-xong]").click();
    const dlg = p.getByRole("dialog", { name: "Xoá các mục đã xong?" });
    await dlg.waitFor({ timeout: 10000 });
    check("xoá các mục đã xong hỏi lại bằng KinConfirm (không window.confirm)", await dlg.isVisible());
    await dlg.getByRole("button", { name: "Xoá các mục đã xong" }).click();
    await eventually("sau xác nhận ⇒ 'Chưa có việc nào đã xong.', máy chủ còn 0 mục", async () => /Chưa có việc nào đã xong\./.test(await p.locator('[data-nhac-rong="da-xong"]').innerText().catch(() => "")) && (await items(p)).length === 0, 20000);
    await c.close();

    // ═════════ Học sinh có dữ liệu giả (mock loi-03 + loi-04) ═════════
    section(`${w}px · dữ liệu giả — Hôm nay: quá hạn + buổi học có phiếu`);
    await resetMock();
    const o = await open(S, w);
    const q = o.p;
    await q.locator("[data-nhac-muc]").first().waitFor({ timeout: 120000 });
    await q.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    const late = row(q, "nh-loi04-khao-sat");
    check("'Nộp phiếu khảo sát' (hôm qua, chỉ ngày) có CHỮ 'Quá hạn' (KinStatus), đứng ĐẦU 'Hôm nay'", await late.isVisible() && (await late.locator('[data-kin-status="loi"]').innerText()).trim() === "Quá hạn"
      && (await q.locator('[data-nhac-danh-sach="hom-nay"] [data-nhac-muc]').first().getAttribute("data-nhac-muc")) === "nh-loi04-khao-sat");
    check("'Ôn công thức lượng giác' ở 'Hôm nay' có '15:00' và '#toan · #on-thi'", /15:00/.test(await row(q, "nh-loi04-luong-giac").innerText()) && /#toan · #on-thi/.test(await row(q, "nh-loi04-luong-giac").innerText()));
    const buoi = q.locator('[data-nhac-buoi="l-loi03-toan-1"]');
    check("khối 'Buổi học' bài 1 lúc 19:30 (Toán 9) có tên bài là liên kết", await buoi.isVisible() && /Buổi học · 19:30 · Toán 9 \(LOI-03\)/.test((await buoi.innerText()).replace(/\s+/g, " ")) && (await buoi.locator("[data-nhac-buoi-ten-bai]").getAttribute("href")) === "/student/bai-giang/l-loi03-toan-1");
    const doc = buoi.locator("[data-nhac-buoi-tai-lieu]");
    check("phiếu: tài liệu 'Mở ↗' + 'Bài Azota ↗' mở tab mới noopener noreferrer; 'Làm bài tập' → ?tab=bai-tap",
      (await doc.count()) === 1 && /Mở ↗/.test(await doc.innerText()) && (await doc.getAttribute("target")) === "_blank" && /noopener noreferrer/.test((await doc.getAttribute("rel")) ?? "")
      && (await buoi.locator("[data-nhac-buoi-azota]").count()) === 1 && (await buoi.locator("[data-nhac-buoi-azota]").getAttribute("target")) === "_blank"
      && (await buoi.locator("[data-nhac-buoi-bai-tap]").getAttribute("href")) === "/student/bai-giang/l-loi03-toan-1?tab=bai-tap");
    check("mục tự động KHÔNG có ô 'Xong' (chỉ đọc), có nút 'Ghi chú cho buổi này'", (await buoi.locator("input[type=checkbox]").count()) === 0 && (await buoi.locator("[data-nhac-buoi-ghi-chu]").innerText()).trim() === "Ghi chú cho buổi này");
    const bb = await buoi.boundingBox(), fb = await late.boundingBox();
    check("khối buổi học nằm TRÊN các mục tự ghi", !!bb && !!fb && bb.y < fb.y, { bb, fb });
    const html = await q.locator("main").innerHTML();
    check("KHÔNG có bài nháp (tên / id), không userId / notifiedAt / isCorrect, không mã hex trong vùng trang", (await q.locator('[data-nhac-buoi="l-loi03-toan-nhap"]').count()) === 0 && !/Bài nháp chưa đăng|l-loi03-toan-nhap|userId|notifiedAt|isCorrect/.test(html) && !/#[0-9a-f]{6}\b/i.test(html));
    if (narrow) {
      check("390: không cuộn ngang ở 'Hôm nay' có dữ liệu", await q.evaluate(NOT_OVERFLOW) as boolean);
      const s = await tooSmall(q);
      check("390: mọi nút / liên kết / ô Xong trong trang cao ≥ 44px (nhóm, thẻ, hàng, phiếu buổi học)", s.length === 0, s.slice(0, 6));
      const boxes = await q.evaluate(`[...document.querySelectorAll("main input[type=checkbox]")].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })`) as [number, number][];
      check("390: ô 'Xong' (input checkbox) rộng và cao ≥ 44px", boxes.length > 0 && boxes.every(([a, b]) => a >= 44 && b >= 44), boxes);
    }
    await shot(q, `loi04-hom-nay-${w}`);

    section(`${w}px · dữ liệu giả — Đã hẹn / Tất cả`);
    await nhom(q, "da-hen").click();
    await eventually("'Đã hẹn': 'Đọc trước bài Làng' 19:00 gắn lớp Văn 9", async () => /19:00/.test(await row(q, "nh-loi04-lang").innerText()) && /Văn 9 \(LOI-03\)/.test(await row(q, "nh-loi04-lang").innerText()), 10000);
    const up = q.locator('[data-nhac-buoi="l-loi03-toan-4"]');
    check("'Đã hẹn' có buổi 'Ngày mai' 00:30 (bài 4): chỉ tên bài + nút ghi chú, không tài liệu / Azota", await up.isVisible() && /00:30/.test(await up.innerText()) && (await up.locator("[data-nhac-buoi-tai-lieu], [data-nhac-buoi-azota]").count()) === 0
      && /Ngày mai/.test(await q.locator(`[data-nhac-ngay-nhom="${tomorrow}"] h3`).innerText()));
    await shot(q, `loi04-da-hen-${w}`);
    await nhom(q, "tat-ca").click();
    await row(q, "nh-loi04-but-chi").locator("[data-nhac-mo]").click();
    await panel(q).waitFor({ timeout: 30000 });
    const wiki = panel(q).locator('[data-nhac-ghi-chu-xem] a[href^="https://vi.wikipedia.org/"]');
    check("'Mua bút chì 2B': ghi chú hiện link wikipedia, tab mới", (await wiki.count()) === 1 && (await wiki.getAttribute("target")) === "_blank");
    if (narrow) { await q.goBack(); await q.waitForURL(u => !u.searchParams.has("muc"), { timeout: 30000 }); }
    else await panel(q).getByRole("button", { name: "Đóng" }).click();

    section(`${w}px · 'Ghi chú cho buổi này'`);
    await nhom(q, "hom-nay").click();
    await q.locator('[data-nhac-buoi="l-loi03-toan-1"] [data-nhac-buoi-ghi-chu]').click();
    await panel(q).waitFor({ timeout: 30000 });
    await eventually("tạo mục 'Ghi chú: Bài 1 · …' gắn bài l-loi03-toan-1, hẹn hôm nay 19:30, mở chi tiết", async () => {
      const it = (await items(q)).find(x => x.lop?.lessonId === "l-loi03-toan-1");
      return !!it && it.title === "Ghi chú: Bài 1 · Căn bậc hai và hằng đẳng thức" && it.dueDate === today && it.dueTime === "19:30"
        && (await panel(q).getAttribute("data-nhac-chi-tiet")) === it.id && (await panel(q).locator("[data-nhac-tieu-de]").inputValue()) === it.title;
    }, 20000);
    check("chi tiết có liên kết 'Mở Bài 1 · … →' tới bài", (await panel(q).locator("[data-nhac-mo-lop]").getAttribute("href")) === "/student/bai-giang/l-loi03-toan-1");
    if (narrow) await q.waitForURL(u => !!u.searchParams.get("muc"), { timeout: 30000 });
    await shot(q, `loi04-ghi-chu-buoi-${w}`);
    if (narrow) { await q.locator("[data-nhac-quay-lai]").click(); await q.waitForURL(u => !u.searchParams.has("muc"), { timeout: 30000 }); }

    section(`${w}px · lỗi ghi / lỗi tải`);
    await q.route("**/api/student/nhac-hoc/*", r => (r.request().method() === "PATCH" ? r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Lỗi server"}' }) : r.continue()));
    await row(q, "nh-loi04-luong-giac").locator("[data-nhac-xong]").click();
    await eventually("PATCH 500 ⇒ lỗi tại chỗ 'Chưa đánh dấu xong được…', ô Xong KHÔNG tích, mục vẫn ở 'Hôm nay'", async () => /Chưa đánh dấu xong được/.test(await q.locator("[data-nhac-loi-tai-cho]").innerText().catch(() => ""))
      && !(await row(q, "nh-loi04-luong-giac").locator("[data-nhac-xong]").isChecked()) && (await row(q, "nh-loi04-luong-giac").count()) === 1, 30000);
    check("máy chủ không đổi (doneAt vẫn null)", !(await items(q)).find(x => x.id === "nh-loi04-luong-giac")?.doneAt);
    await q.unroute("**/api/student/nhac-hoc/*");
    await q.route("**/api/student/nhac-hoc", r => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Lỗi server"}' }));
    await q.reload({ waitUntil: "domcontentloaded" });
    await eventually("GET 500 ⇒ ErrorStrip 'Không tải được Nhắc học.' + 'Thử lại' (không coi là rỗng)", async () => /Không tải được Nhắc học\./.test(await q.locator("[data-nhac-loi]").innerText().catch(() => "")) && (await q.locator("[data-nhac-rong]").count()) === 0, 60000);
    await q.unroute("**/api/student/nhac-hoc");
    await q.locator("[data-nhac-loi]").getByRole("button", { name: "Thử lại" }).click();
    await eventually("'Thử lại' ⇒ danh sách trở lại", async () => (await row(q, "nh-loi04-khao-sat").count()) === 1, 30000);
    await shot(q, `loi04-thu-lai-${w}`);
    await o.c.close();

    // ═════════ Quản trị xem thử, khách ═════════
    section(`${w}px · quản trị xem thử / khách`);
    const a = await open(SA, w);
    await eventually("quản trị xem thử ⇒ 'Nhắc học chỉ dùng được với tài khoản học sinh.', không ErrorStrip", async () => await a.p.getByText("Nhắc học chỉ dùng được với tài khoản học sinh.").isVisible() && (await a.p.locator("[data-nhac-loi]").count()) === 0, 120000);
    await a.c.close();
    const g = await open(null, w);
    await g.p.waitForURL(/\/dang-nhap/, { timeout: 120000 });
    check("khách ⇒ /dang-nhap?redirect=/student/nhac-hoc", /redirect=%2Fstudent%2Fnhac-hoc/.test(g.p.url()), g.p.url());
    await g.c.close();
  }

  section("Riêng tư + lỗi trình duyệt");
  check("không console nào in ghi chú / tiêu đề riêng", !consoleText.some(t => t.includes(NOTE_SECRET) || t.includes("Tài liệu cô gửi") || t.includes("Ôn chương 2")), consoleText.filter(t => /Ôn|Tài liệu/.test(t)).slice(0, 3));
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));

  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
