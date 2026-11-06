// HOME-02 (trình duyệt thật, 1600 và 390): màn /admin/trang-chu — quyền, xem trước cùng component, bộ đếm, khôi phục + hoàn tác, lưu, 409 hai tab, 390px không tràn, bàn phím.
// KHÔNG chạy chung với bài khác trên cổng 3100 (xem tools/local-e2e/README.md).
import { prisma } from "@/lib/prisma";
import { DEFAULT_HOME_CONTENT as DEF } from "@/lib/siteContent";
import { BASE, mkTutor, mkSuper, mkUser, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll, ADMIN } from "./ui";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const open = async (ctx: any) => { const p = await ctx.newPage(); watch(p); await p.goto(`${ADMIN}/admin/trang-chu`, { waitUntil: "networkidle", timeout: 120000 }); await p.locator("[data-home-state=ready]").waitFor({ timeout: 90000 }); return p; };
  const frame = (p: any) => p.frameLocator('iframe[title="Xem trước trang chủ"]');
  const save = (p: any) => p.locator("[data-save]");

  section("Quyền: gia sư không thấy, quản trị nội dung thấy");
  {
    const ct = await ctxFor(T, { width: 1280, height: 800 });
    const pt = await ct.newPage(); watch(pt);
    await pt.goto(`${BASE}/admin/trang-chu`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await pt.waitForTimeout(2500);
    check("gia sư mở /admin/trang-chu: không có biểu mẫu sửa", (await pt.locator("[data-home-editor]").count()) === 0);
    await ct.close();
    const cc = await ctxFor(CA, { width: 1600, height: 1000, rail: "mac-dinh" });
    const pc = await open(cc);
    // BU-08: bốn module (Việc chờ · Con người · Học vụ · Vận hành); "Trang chủ" nằm ở Học vụ, nhóm Truyền thông.
    const tabs = pc.getByRole("navigation", { name: "Trang của Học vụ" });
    check("quản trị nội dung thấy mục 'Trang chủ' ở module Học vụ (nhóm Truyền thông), đang ở trang đó", await tabs.getByRole("link", { name: "Chữ trang chủ" }).getAttribute("aria-current") === "page");
    await cc.close();
  }

  section("1600: hai cột + xem trước dùng đúng component trang thật");
  const c16 = await ctxFor(SA, { width: 1600, height: 1000, rail: "mac-dinh" });
  const p = await open(c16);
  {
    const ed = await p.locator("[data-pane=sua]").boundingBox(), pv = await p.locator("[data-pane=xem]").boundingBox();
    check("form bên trái (≤ 640px), xem trước bên phải cùng hàng", !!ed && !!pv && ed.width <= 640 && pv.x >= ed.x + ed.width - 1 && Math.abs(pv.y - ed.y) < 200, { ed, pv });
    check("dòng trạng thái: chưa sửa lần nào, nút Lưu tắt", /Chưa sửa lần nào/.test(await p.locator("[data-home-status]").innerText()) && await save(p).isDisabled());
    await frame(p).locator("h1").waitFor({ timeout: 60000 });
    check("xem trước hiện h1 mặc định", /Học cùng gia sư thật/.test(await frame(p).locator("h1").innerText()));
    await p.locator("#f-title").fill("Chữ xem trước mới\nDòng thứ hai");
    const t0 = Date.now();
    await frame(p).getByRole("heading", { level: 1, name: /Chữ xem trước mới/ }).waitFor({ timeout: 3000 });
    check("gõ vào tiêu đề → iframe đổi trong ≤ 1,5 giây", Date.now() - t0 <= 1500, Date.now() - t0);
    check("xem trước KHÔNG có khối số liệu và có ghi chú 'Số liệu thật hiện ở trang công khai'", (await frame(p).locator("dl").count()) === 0 && (await p.getByText("Số liệu thật (học sinh, đề thi, gia sư) hiện ở trang công khai").count()) === 1);
    check("xem trước không bọc thanh module / tab quản trị (trang trần)", (await frame(p).locator("[aria-label='Module quản trị']").count()) === 0 && (await frame(p).locator("#kin-rail").count()) === 0);
    const geo = async () => frame(p).locator("h1").evaluate((h: HTMLElement) => {
      const lab = [...document.querySelectorAll("p")].find(x => /ĐANG MỞ LUYỆN THI/.test(x.textContent ?? ""))!;
      return { w: window.innerWidth, h1Bottom: h.getBoundingClientRect().bottom, h1Right: h.getBoundingClientRect().right, labTop: lab.getBoundingClientRect().top, labLeft: lab.getBoundingClientRect().left };
    });
    const dt = await geo();
    check("Máy tính: iframe 1280 logic, hero hai cột (nhãn kỳ thi nằm bên phải tiêu đề)", dt.w === 1280 && dt.labLeft > dt.h1Right - 40, dt);
    await p.locator("[data-preview-mode=dien-thoai]").click();
    await p.waitForTimeout(400);
    const ph = await geo();
    const fw = await p.locator("iframe[title='Xem trước trang chủ']").evaluate((e: HTMLElement) => e.getBoundingClientRect().width);
    check("Điện thoại: iframe 390 logic, hero xếp MỘT cột (nhãn kỳ thi nằm dưới tiêu đề)", ph.w === 390 && ph.labTop > ph.h1Bottom - 4 && Math.round(fw) <= 390, { ph, fw });
    await p.locator("[data-preview-mode=may-tinh]").click();
  }

  section("Bộ đếm: vượt giới hạn");
  {
    await p.locator("#f-badge").fill("a".repeat(105));
    check("bộ đếm đỏ + chữ 'Dài hơn', nút Lưu tắt", (await p.locator("#f-badge-dem[data-counter=vuot]").innerText()).includes("Dài hơn 5") && await save(p).isDisabled());
    await p.locator("#f-badge").fill("a".repeat(90));
    check("gần hết chỗ: chữ 'Sắp hết chỗ' (không chỉ màu)", (await p.locator("#f-badge-dem[data-counter=gan]").innerText()).includes("Sắp hết chỗ"));
    await p.locator("#f-badge").fill("Dòng nhỏ mới");
    check("sửa lại hợp lệ → Lưu bật", await save(p).isEnabled());
  }

  section("Cụm cấm báo ngay tại chỗ");
  {
    await p.locator("#f-cta-desc").fill("Học live mỗi tối cùng gia sư");
    check("hiện câu lỗi nêu cụm 'live mỗi tối' và Lưu tắt", /live mỗi tối/.test(await p.locator("[data-field-error='cta.desc']").innerText()) && await save(p).isDisabled());
    await p.locator("[data-restore=khoi-keu-goi]").click();
    check("khôi phục khối kêu gọi → hết lỗi", (await p.locator("[data-field-error='cta.desc']").count()) === 0 && (await p.locator("#f-cta-desc").inputValue()) === DEF.cta.desc);
  }

  section("Khôi phục khối + Hoàn tác (không hộp thoại)");
  {
    let dialog = false; p.on("dialog", (d: any) => { dialog = true; d.dismiss(); });
    await p.locator("#f-lead").fill("Mô tả đã sửa tay");
    await p.locator("[data-restore=khoi-dau]").click();
    check("bấm 'Khôi phục khối này' → mô tả về mặc định, KHÔNG có confirm()", (await p.locator("#f-lead").inputValue()) === DEF.lead && !dialog);
    await p.getByRole("button", { name: "Hoàn tác" }).click();
    check("Hoàn tác → mô tả đã sửa tay trở lại", (await p.locator("#f-lead").inputValue()) === "Mô tả đã sửa tay");
    check("nút khôi phục tắt khi khối đã bằng mặc định (khối Gia sư chưa sửa)", await p.locator("[data-restore=khoi-gia-su]").isDisabled());
  }

  section("Chọn icon bằng bàn phím");
  {
    await p.locator("[data-card='0'] button", { hasText: "Sửa" }).first().click();
    const radios = p.locator("[data-card='0'] [role=radio]");
    check("lưới 10 icon, đúng một ô được chọn, mỗi ô cao ≥ 44px", (await radios.count()) === 10 && (await p.locator("[data-card='0'] [role=radio][aria-checked=true]").count()) === 1 && (await radios.first().boundingBox())!.height >= 44);
    await p.locator("[data-card='0'] [role=radio][aria-checked=true]").focus();
    await p.keyboard.press("ArrowRight");
    check("mũi tên phải chuyển sang icon kế (calendar)", await p.locator("[data-card='0'] [data-icon=calendar]").getAttribute("aria-checked") === "true");
    await p.keyboard.press("ArrowLeft");
  }

  section("Lưu: Ctrl+S, toast, mốc mới, lưu lần hai tắt");
  {
    await p.locator("#f-title").fill("Học cùng gia sư thật\nTheo lớp và theo lịch");
    await p.keyboard.press("Control+s");
    await p.getByText("Trang chủ cập nhật trong vài giây.").waitFor({ timeout: 15000 });
    const row = await prisma.siteContent.findUnique({ where: { key: "home" } });
    check("toast 'Đã lưu'; CSDL có hàng với updatedBy là người lưu; nhật ký 1 dòng", !!row && row.updatedBy === SA.id && (row.data as any).lead === "Mô tả đã sửa tay" && (await prisma.auditLog.count({ where: { action: "site_content.update" } })) === 1);
    check("sau khi lưu: nút Lưu tắt, trạng thái 'Sửa lần cuối … bởi bạn'", await save(p).isDisabled() && /Sửa lần cuối.*bởi bạn/.test(await p.locator("[data-home-status]").innerText()));
    // Trang chủ thật nhận chữ mới
    const home = await (await fetch(BASE + "/", { cache: "no-store" })).text();
    check("trang chủ thật (GET /) có mô tả đã lưu", home.includes("Mô tả đã sửa tay"));
  }

  section("Hai tab: 409 và ghi đè có chủ ý");
  {
    const pb = await c16.newPage(); watch(pb);
    await pb.goto(`${ADMIN}/admin/trang-chu`, { waitUntil: "networkidle", timeout: 120000 });
    await pb.locator("[data-home-state=ready]").waitFor({ timeout: 90000 });
    await p.locator("#f-cta-title").fill("Tab A lưu trước");
    await save(p).click();
    await p.getByText("Trang chủ cập nhật trong vài giây.").waitFor({ timeout: 15000 });
    await pb.locator("#f-cta-title").fill("Tab B lưu sau");
    await save(pb).click();
    await pb.locator("[data-conflict]").waitFor({ timeout: 15000 });
    check("tab B thấy dải 409 'vừa lưu … Bạn đang sửa bản cũ hơn', CSDL vẫn là bản của tab A",
      /vừa lưu.*bản cũ hơn/s.test(await pb.locator("[data-conflict]").innerText()) && ((await prisma.siteContent.findUnique({ where: { key: "home" } }))!.data as any).cta.title === "Tab A lưu trước");
    await pb.locator("[data-conflict-overwrite]").click();
    await pb.getByText("Trang chủ cập nhật trong vài giây.").waitFor({ timeout: 15000 });
    check("'Giữ bản của tôi và ghi đè' thành công; dải 409 biến mất", ((await prisma.siteContent.findUnique({ where: { key: "home" } }))!.data as any).cta.title === "Tab B lưu sau" && (await pb.locator("[data-conflict]").count()) === 0);
    await pb.close();
  }
  await c16.close();

  section("390: không tràn ngang, tab Sửa | Xem trước, Lưu luôn thấy");
  {
    const c = await ctxFor(SA, { width: 390, height: 800 });
    const m = await open(c);
    check("không tràn ngang (scrollWidth ≤ 390)", await m.evaluate(() => document.documentElement.scrollWidth) <= 390, await m.evaluate(() => document.documentElement.scrollWidth));
    check("tab 'Sửa' đang mở: thấy form, không thấy khung xem trước", await m.locator("[data-pane=sua]").isVisible() && !(await m.locator("[data-pane=xem]").isVisible()));
    await m.getByRole("tab", { name: "Xem trước" }).click();
    check("tab 'Xem trước': thấy khung xem trước, form ẩn", await m.locator("[data-pane=xem]").isVisible() && !(await m.locator("[data-pane=sua]").isVisible()));
    check("tab Xem trước cũng không tràn ngang", await m.evaluate(() => document.documentElement.scrollWidth) <= 390);
    await m.getByRole("tab", { name: "Sửa" }).click();
    await m.locator("#f-khoi-keu-goi").scrollIntoViewIfNeeded().catch(() => {});
    await m.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const sb = await save(m).boundingBox();
    check("cuộn xuống cuối, nút Lưu vẫn trong khung nhìn và cao ≥ 44px", !!sb && sb.y >= 0 && sb.y + sb.height <= 800 && sb.height >= 44, sb);
    const small = await m.evaluate(() => [...document.querySelectorAll("[data-home-editor] button, [data-home-editor] a, [data-home-editor] select, [data-home-editor] input")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !(e as HTMLInputElement).hidden; }).map(e => (e.textContent || e.getAttribute("aria-label") || e.id).slice(0, 30)));
    check("mọi nút / ô nhập trong màn cao ≥ 44px", small.length === 0, small);
    await c.close();
  }

  check("không lỗi trang / console trong cả bài", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
