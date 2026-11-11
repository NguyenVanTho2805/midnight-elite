// Bộ component KiN (Figma Nút 6:50 · Thẻ trạng thái 8:139 · Tab 106:30 · Toast 106:23 · Hộp xác nhận 106:51) trên trang mẫu /kin-mau.
// Đo bằng style tính ra: kích thước, màu theo token, trạng thái rê chuột / focus / tắt, bàn phím, tương phản, điện thoại 390px.
import { BASE, check, section, done, eventually } from "./h";
import { launch, ctxFor, closeAll, kinSelect, kinSelectValue, kinSelectOptions, ADMIN } from "./ui";

type Rgb = [number, number, number];
const parse = (c: string): Rgb => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) throw new Error("không đọc được màu: " + c); const [r, g, b] = m[1].split(",").map(x => parseFloat(x)); return [r, g, b]; };
const lum = ([r, g, b]: Rgb) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a: Rgb, b: Rgb) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const WHITE: Rgb = [255, 255, 255];
const same = (a: string, b: string) => parse(a).join() === parse(b).join();

(async () => {
  await launch();
  const errors: string[] = [];
  const ctx = await ctxFor(null, { width: 1280, height: 1000 });
  const pg = await ctx.newPage();
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); });
  const hide = () => pg.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });

  await pg.goto(`${BASE}/kin-mau`, { waitUntil: "networkidle", timeout: 170000 });
  await pg.getByRole("heading", { name: "Bộ component KiN" }).waitFor({ timeout: 90000 });
  await hide();

  // màu của một token, tính trong vùng sáng (như các trang thật)
  const tok = (name: string) => pg.evaluate((n) => { const el = document.createElement("span"); el.style.color = `var(${n})`; document.querySelector('[data-vung="sang"]')!.appendChild(el); const c = getComputedStyle(el).color; el.remove(); return c; }, name);
  const css = (loc: ReturnType<typeof pg.locator>, prop: string) => loc.evaluate((e, p) => (getComputedStyle(e) as unknown as Record<string, string>)[p], prop);

  // ───────── Nút
  section("Nút (Figma 6:50): 4 kiểu + nền đỏ đặc, cao ≥ 44px, màu theo token");
  const nut = pg.locator('[data-mau="nut"] button');
  check("5 nút: Chính, Thường, Ghost, Nguy hiểm, Nguy hiểm (đặc)", await nut.count() === 5);
  const heights = await nut.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("mọi nút cao ≥ 44px", heights.every(h => h >= 44), heights);
  const coGoc = await pg.evaluate(() => { const el = document.createElement("span"); el.style.fontSize = "var(--kin-co-goc)"; document.body.appendChild(el); const f = getComputedStyle(el).fontSize; el.remove(); return f; });
  check("chữ = cỡ gốc --kin-co-goc (14px), bo 9px", coGoc === "14px" && (await css(nut.first(), "fontSize")) === coGoc && (await css(nut.first(), "borderTopLeftRadius")) === "9px");
  const [pri, sec, gho, dan, sol] = [0, 1, 2, 3, 4].map(i => nut.nth(i));
  const navy = await tok("--kin-nhan-nen"), oNhap = await tok("--kin-vien-o-nhap"), chinh = await tok("--kin-chu-chinh"), loi = await tok("--kin-tt-chu-loi"), mo = await tok("--kin-chu-mo");
  check("Chính: nền màu nhấn (Navy), chữ trắng", same(await css(pri, "backgroundColor"), navy) && same(await css(pri, "color"), "rgb(255,255,255)"), await css(pri, "backgroundColor"));
  check("Thường: nền trắng, viền 1px đủ 3:1 (--kin-vien-o-nhap), chữ đậm", same(await css(sec, "backgroundColor"), "rgb(255,255,255)") && same(await css(sec, "borderTopColor"), oNhap) && (await css(sec, "borderTopWidth")) === "1px" && same(await css(sec, "color"), chinh));
  check("Ghost: không nền, không viền, chữ xám (--kin-chu-mo)", (await css(gho, "backgroundColor")).includes("0, 0, 0, 0") && same(await css(gho, "color"), mo) && (await css(gho, "borderTopColor")).includes("0, 0, 0, 0"));
  check("Nguy hiểm: như Thường nhưng chữ đỏ (#dc2626)", same(await css(dan, "backgroundColor"), "rgb(255,255,255)") && same(await css(dan, "color"), loi) && same(await css(dan, "borderTopColor"), oNhap));
  check("Nguy hiểm (đặc): nền đỏ, chữ trắng", same(await css(sol, "backgroundColor"), loi) && same(await css(sol, "color"), "rgb(255,255,255)"));
  check("viền Thường đạt 3:1 trên nền trắng; chữ đỏ và chữ Ghost đạt 4,5:1", ratio(parse(oNhap), WHITE) >= 3 && ratio(parse(loi), WHITE) >= 4.5 && ratio(parse(mo), WHITE) >= 4.5, [ratio(parse(oNhap), WHITE), ratio(parse(loi), WHITE), ratio(parse(mo), WHITE)]);

  section("Nút: rê chuột / focus bàn phím / tắt / chờ");
  const navyRe = await tok("--kin-nhan-nen-re"), reChuot = await tok("--kin-nen-re-chuot");
  await pri.hover();
  await eventually("Chính rê chuột → nền đậm hơn (--kin-nhan-nen-re)", async () => same(await css(pri, "backgroundColor"), navyRe));
  await sec.hover();
  await eventually("Thường rê chuột → nền xám nhạt (--kin-nen-re-chuot)", async () => same(await css(sec, "backgroundColor"), reChuot));
  await gho.hover();
  await eventually("Ghost rê chuột → nền xám nhạt", async () => same(await css(gho, "backgroundColor"), reChuot));
  await pg.mouse.move(1, 1);
  await sec.focus();
  await pg.keyboard.press("Shift+Tab");
  check("Shift+Tab từ nút Thường → tiêu điểm vào nút Chính", await pri.evaluate(e => e === document.activeElement));
  const link = await tok("--kin-nhan-link");
  check("focus bàn phím: vòng 2px liền, màu xanh link, đặt NGOÀI (offset 0)", (await css(pri, "outlineWidth")) === "2px" && (await css(pri, "outlineStyle")) === "solid" && same(await css(pri, "outlineColor"), link) && (await css(pri, "outlineOffset")) === "0px", [await css(pri, "outlineWidth"), await css(pri, "outlineStyle"), await css(pri, "outlineColor"), await css(pri, "outlineOffset")]);
  check("focus không làm méo hình: bo vẫn 9px (quy tắc chung cũ ép 4px)", (await css(pri, "borderTopLeftRadius")) === "9px", await css(pri, "borderTopLeftRadius"));
  await pg.mouse.move(1, 1);
  const tat = pg.locator('[data-mau="nut-tat"] button');
  check("5 nút tắt: disabled, mờ 45%, con trỏ cấm", await tat.count() === 5 && (await tat.evaluateAll(els => els.every(e => (e as HTMLButtonElement).disabled && getComputedStyle(e).opacity === "0.45" && getComputedStyle(e).cursor === "not-allowed"))));
  await tat.first().hover();
  const reTat = await css(tat.first(), "backgroundColor");
  check("nút tắt không đổi nền khi rê chuột", same(reTat, navy), reTat);
  const cho = pg.locator('[data-mau="nut-cho"] button');
  check("đang chờ: aria-busy, khoá, hiện chữ 'Đang lưu…' thay nhãn", (await cho.first().getAttribute("aria-busy")) === "true" && await cho.first().isDisabled() && (await cho.first().innerText()) === "Đang lưu…", await cho.first().innerText());
  check("không có vòng xoay (Figma: dùng chữ, không dùng spinner)", await pg.locator('[data-mau="nut-cho"] .animate-spin, [data-mau="nut-cho"] svg').count() === 0);
  check("chờ mà không có loadingLabel → giữ nguyên nhãn", (await cho.nth(1).innerText()) === "Không nhãn chờ" && (await css(cho.nth(1), "cursor")) === "progress");

  section("Nút theo chủ đề: màu nhấn đổi theo chủ đề, màu nguy hiểm thì không");
  await pg.evaluate(`document.documentElement.setAttribute("data-chu-de", "co-vit")`);
  await eventually("chủ đề Cổ vịt: nút Chính chuyển sang #0e7490", async () => same(await css(pri, "backgroundColor"), "rgb(14, 116, 144)"));
  check("…nút Nguy hiểm (đặc) vẫn đỏ", same(await css(sol, "backgroundColor"), loi));
  await pg.evaluate(`document.documentElement.setAttribute("data-chu-de", "navy")`);

  // ───────── Thẻ trạng thái
  section("Thẻ trạng thái (Figma 8:139): chấm 7px + chữ, hai bộ màu");
  const tt = pg.locator('[data-mau="tt"] [data-kin-status]');
  check("4 thẻ: xong / cho / loi / mo, mỗi thẻ có chữ", await tt.count() === 4 && (await tt.allInnerTexts()).join("|") === "Đã chấm|Cần nhắc|Cần xử lý|Chờ 1 ngày", (await tt.allInnerTexts()).join("|"));
  // 23/10/2026 (ac8b8e8): thẻ trạng thái theo chữ gốc 14px (--kin-co-goc, khớp chữ dòng phụ cạnh nó trong ảnh Figma gia sư), cao 20px (dòng 20). Đọc cỡ chữ từ token, không gán cứng.
  check("cao 20px, chữ = --kin-co-goc (14px)", (await tt.evaluateAll((els, goc) => els.every(e => Math.round(e.getBoundingClientRect().height) === 20 && getComputedStyle(e).fontSize === goc), coGoc)));
  const dots = await tt.evaluateAll(els => els.map(e => { const d = e.firstElementChild as HTMLElement; const r = d.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(d).backgroundColor, hidden: d.getAttribute("aria-hidden"), text: getComputedStyle(e).color }; }));
  check("chấm 7×7, aria-hidden (chấm chỉ để trang trí)", dots.every(d => d.w === 7 && d.h === 7 && d.hidden === "true"), dots);
  const want = [["rgb(5, 150, 105)", "rgb(4, 120, 87)"], ["rgb(217, 119, 6)", "rgb(180, 83, 9)"], ["rgb(220, 38, 38)", "rgb(220, 38, 38)"], ["rgb(118, 127, 142)", "rgb(107, 114, 128)"]];
  check("màu chấm / màu chữ đúng bảng Figma (#059669/#047857, #D97706/#B45309, #DC2626, #767F8E/#6B7280)", dots.every((d, i) => same(d.bg, want[i][0]) && same(d.text, want[i][1])), dots);
  check("chữ đạt 4,5:1, chấm đạt 3:1 trên nền trắng", dots.every(d => ratio(parse(d.text), WHITE) >= 4.5 && ratio(parse(d.bg), WHITE) >= 3), dots.map(d => [ratio(parse(d.text), WHITE).toFixed(2), ratio(parse(d.bg), WHITE).toFixed(2)]));
  check("chấm xong ≠ chữ xong (hai bộ mã, không gộp)", !same(dots[0].bg, dots[0].text) && !same(dots[1].bg, dots[1].text));

  // ───────── Tab
  section("Tab (Figma 106:30): gạch chân 2px màu nhấn, bàn phím, cao ≥ 44px");
  const tabs = pg.getByRole("tablist", { name: "Mẫu tab" }).getByRole("tab");
  check("3 tab; tab đầu đang mở", await tabs.count() === 3 && (await tabs.nth(0).getAttribute("aria-selected")) === "true" && (await tabs.nth(1).getAttribute("aria-selected")) === "false");
  check("chỉ tab đang mở nằm trong thứ tự Tab (roving tabindex)", (await tabs.evaluateAll(els => els.map(e => e.getAttribute("tabindex")))).join() === "0,-1,-1");
  check("cao ≥ 44px", (await tabs.evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44))));
  const tabLook = (i: number) => tabs.nth(i).evaluate(e => { const [t, u] = [e.children[0] as HTMLElement, e.children[1] as HTMLElement]; return { w: getComputedStyle(t).fontWeight, c: getComputedStyle(t).color, fs: getComputedStyle(t).fontSize, uh: Math.round(u.getBoundingClientRect().height), ub: getComputedStyle(u).backgroundColor }; });
  const t0 = await tabLook(0), t1 = await tabLook(1);
  // 15/10/2026 (Lucian No.039): gạch chân 2px màu nhấn là MỘT thanh chung trượt giữa các tab (.kin-tab-ink), không còn là gạch riêng của từng tab.
  const ink = await tabs.nth(0).evaluate(e => { const i = e.parentElement!.querySelector<HTMLElement>(".kin-tab-ink")!; const r = i.getBoundingClientRect(), t = e.getBoundingClientRect(); return { h: Math.round(r.height), bg: getComputedStyle(i).backgroundColor, dx: Math.abs(r.left - t.left), dw: Math.abs(r.width - t.width), dy: Math.abs(r.bottom - t.bottom) }; });
  check("đang mở: chữ đậm vừa 500 (chuẩn mới), đen, cỡ = --kin-co-goc (14px); gạch chân 2px màu nhấn là thanh chung nằm đúng dưới tab đó", t0.w === "500" && same(t0.c, chinh) && t0.fs === coGoc && ink.h === 2 && same(ink.bg, navy) && ink.dx < 1.5 && ink.dw < 1.5 && ink.dy < 3, { t0, ink });
  check("thường: chữ 400 xám, không có gạch chân riêng (trong suốt)", t1.w === "400" && same(t1.c, mo) && t1.ub.includes("0, 0, 0, 0") && t0.ub.includes("0, 0, 0, 0"), t1);
  await tabs.nth(0).focus();
  await pg.keyboard.press("ArrowRight");
  check("→ chọn tab kế và chuyển tiêu điểm theo", (await tabs.nth(1).getAttribute("aria-selected")) === "true" && await tabs.nth(1).evaluate(e => e === document.activeElement) && await pg.locator('[data-mau="tab-dang-mo"]').innerText() === "Đang mở: ph");
  await pg.keyboard.press("End");
  check("End → tab cuối", (await tabs.nth(2).getAttribute("aria-selected")) === "true");
  await pg.keyboard.press("ArrowRight");
  check("→ ở tab cuối vòng về tab đầu", (await tabs.nth(0).getAttribute("aria-selected")) === "true");
  await pg.keyboard.press("ArrowLeft");
  check("← ở tab đầu vòng về tab cuối", (await tabs.nth(2).getAttribute("aria-selected")) === "true");
  await pg.keyboard.press("Home");
  await tabs.nth(1).click();
  check("bấm chuột chọn tab", (await tabs.nth(1).getAttribute("aria-selected")) === "true" && await pg.locator('[data-mau="tab-dang-mo"]').innerText() === "Đang mở: ph");

  // ───────── Toast
  section("Toast (Figma 106:23): 400px, bo 10px, chấm 8px, tiêu đề + dòng phụ 11,1px");
  const ts = pg.locator('[data-mau="toast"] [data-kin-toast]');
  check("4 loại: xong / cho / loi / tin", await ts.count() === 4 && (await ts.evaluateAll(els => els.map(e => e.getAttribute("data-kin-toast")))).join() === "xong,cho,loi,tin");
  const tg = await ts.evaluateAll(els => els.map(e => { const cs = getComputedStyle(e); const dot = e.children[0] as HTMLElement; const [title, detail] = Array.from((e.children[1] as HTMLElement).children) as HTMLElement[]; return { w: Math.round(e.getBoundingClientRect().width), r: cs.borderTopLeftRadius, b: cs.borderTopWidth, pt: cs.paddingTop, pl: cs.paddingLeft, dot: Math.round(dot.getBoundingClientRect().width), dotBg: getComputedStyle(dot).backgroundColor, tc: getComputedStyle(title).color, tw: getComputedStyle(title).fontWeight, tf: getComputedStyle(title).fontSize, df: getComputedStyle(detail).fontSize, dc: getComputedStyle(detail).color, role: e.getAttribute("role"), sh: cs.boxShadow }; }));
  check("rộng 400px, bo 10px, viền 1px, đệm 14/16", tg.every(t => t.w === 400 && t.r === "10px" && t.b === "1px" && t.pt === "14px" && t.pl === "16px"), tg[0]);
  check("chấm 8px; tiêu đề 13,3px đậm 600; dòng phụ 11,1px xám", tg.every(t => t.dot === 8 && t.tf === "13.3px" && t.tw === "600" && t.df === "11.1px" && same(t.dc, mo)), tg[0]);
  const wantT = [["rgb(5, 150, 105)", "rgb(4, 120, 87)"], ["rgb(217, 119, 6)", "rgb(180, 83, 9)"], ["rgb(220, 38, 38)", "rgb(220, 38, 38)"], ["rgb(118, 127, 142)", "rgb(55, 65, 81)"]];
  check("màu chấm / tiêu đề từng loại (tin: chữ #374151)", tg.every((t, i) => same(t.dotBg, wantT[i][0]) && same(t.tc, wantT[i][1])), tg.map(t => [t.dotBg, t.tc]));
  check("tiêu đề mọi loại đạt 4,5:1 trên nền trắng", tg.every(t => ratio(parse(t.tc), WHITE) >= 4.5));
  check("loại lỗi là role=alert, còn lại role=status; có bóng nổi", tg.map(t => t.role).join() === "status,status,alert,status" && tg.every(t => t.sh && t.sh !== "none"), tg.map(t => t.role));

  section("ToastProvider dùng KinToast: ok/warn/err/info + dòng phụ + nút đóng + tự tắt");
  const live = pg.locator('.fixed [data-kin-toast]');
  await pg.getByRole("button", { name: "Bật toast xong" }).click();
  await live.first().waitFor({ timeout: 5000 });
  check("toast.ok → loại 'xong', có tiêu đề + dòng phụ", (await live.first().getAttribute("data-kin-toast")) === "xong" && (await live.first().innerText()).includes("Đã lưu điểm danh.") && (await live.first().innerText()).includes("4 buổi được tính tiền"), await live.first().innerText());
  await pg.getByRole("button", { name: "Bật toast chờ" }).click();
  check("toast.warn → loại 'cho'", await live.filter({ has: pg.locator("p", { hasText: "Cần nhắc phụ huynh." }) }).getAttribute("data-kin-toast") === "cho");
  await pg.getByRole("button", { name: "Bật toast lỗi" }).click();
  check("toast.err → loại 'loi', role=alert", await pg.locator('.fixed [role="alert"][data-kin-toast="loi"]').count() === 1);
  await pg.getByRole("button", { name: "Bật toast tin" }).click();
  check("toast.info → loại 'tin'", await pg.locator('.fixed [data-kin-toast="tin"]').count() === 1);
  const first = await live.first().boundingBox();
  check("toast nổi ở góc phải trên, rộng 400px", !!first && Math.round(first.width) === 400 && first.y < 40 && first.x + first.width > 1200, first);
  await live.filter({ has: pg.locator("p", { hasText: "Đã lưu điểm danh." }) }).getByRole("button", { name: "Đóng" }).click();
  check("nút × đóng toast ngay", await live.filter({ has: pg.locator("p", { hasText: "Đã lưu điểm danh." }) }).count() === 0);
  await eventually("toast cảnh báo + lỗi tự tắt sau ~3 giây", async () => (await pg.locator('.fixed [data-kin-toast="cho"], .fixed [data-kin-toast="loi"]').count()) === 0, 8000);
  check("toast 'tin' đặt timeout 60 giây vẫn còn (tuỳ chọn timeout được tôn trọng)", await pg.locator('.fixed [data-kin-toast="tin"]').count() === 1);
  await pg.locator('.fixed [data-kin-toast="tin"]').getByRole("button", { name: "Đóng" }).click();

  // ───────── Hộp xác nhận
  section("Hộp xác nhận loại thường (Figma 106:31)");
  const openThuong = pg.getByRole("button", { name: "Mở hộp thường" });
  await openThuong.click();
  const d1 = pg.getByRole("dialog", { name: "Gửi xác nhận cho 5 phụ huynh?" });
  await d1.waitFor({ timeout: 5000 });
  const box1 = await d1.boundingBox();
  check("rộng 420px, bo 14px, có bóng nổi", !!box1 && Math.round(box1.width) === 420 && (await css(d1, "borderTopLeftRadius")) === "14px" && (await css(d1, "boxShadow")) !== "none", box1?.width);
  check("aria-modal, aria-labelledby → tiêu đề, aria-describedby → nội dung", (await d1.getAttribute("aria-modal")) === "true" && !!(await d1.getAttribute("aria-labelledby")) && !!(await d1.getAttribute("aria-describedby")));
  check("tiêu đề 16px đen; nội dung 13,3px xám đậm", (await css(d1.getByRole("heading"), "fontSize")) === "16px" && same(await css(d1.getByRole("heading"), "color"), chinh) && (await css(d1.locator("#" + (await d1.getAttribute("aria-describedby"))), "fontSize")) === "13.3px");
  const b1 = await d1.getByRole("button").evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { t: (e as HTMLElement).innerText, w: Math.round(r.width), h: Math.round(r.height) }; }));
  check("hai nút 'Để sau' + 'Gửi xác nhận', cao ≥ 44px, rộng ≥ 100px", b1.length === 2 && b1[0].t === "Để sau" && b1[1].t === "Gửi xác nhận" && b1.every(b => b.h >= 44 && b.w >= 100), b1);
  check("tiêu điểm vào nút xác nhận; nền nút = màu nhấn", await d1.getByRole("button", { name: "Gửi xác nhận" }).evaluate(e => e === document.activeElement) && same(await css(d1.getByRole("button", { name: "Gửi xác nhận" }), "backgroundColor"), navy));
  check("khoá cuộn trang khi mở", (await pg.evaluate(() => document.body.style.overflow)) === "hidden");
  check("lớp phủ phía sau phủ kín màn hình", await pg.evaluate(() => { const o = document.querySelector('[data-kin-confirm]')!.parentElement!; const r = o.getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight && getComputedStyle(o).backgroundColor.startsWith("rgba"); }));
  await pg.keyboard.press("Escape");
  await d1.waitFor({ state: "hidden", timeout: 5000 });
  check("Escape = huỷ: hộp đóng, nhật ký ghi 'huỷ thường', cuộn trang trả lại", (await pg.locator('[data-mau="nhat-ky"]').innerText()).includes("huỷ thường") && (await pg.evaluate(() => document.body.style.overflow)) !== "hidden");
  check("đóng xong, tiêu điểm trả về nút đã mở hộp", await openThuong.evaluate(e => e === document.activeElement));
  await openThuong.click();
  await d1.getByRole("button", { name: "Gửi xác nhận" }).click();
  check("bấm 'Gửi xác nhận' → onConfirm chạy", (await pg.locator('[data-mau="nhat-ky"]').innerText()).includes("xác nhận thường"));

  section("Hộp xác nhận loại nguy hiểm (Figma 106:41)");
  const openNH = pg.getByRole("button", { name: "Mở hộp nguy hiểm" });
  await openNH.click();
  const d2 = pg.getByRole("dialog", { name: "Thu hồi quyền vào lớp của Lê Hải Đăng?" });
  await d2.waitFor({ timeout: 5000 });
  check("data-kin-confirm=nguy-hiem; tiêu đề đỏ", (await d2.getAttribute("data-kin-confirm")) === "nguy-hiem" && same(await css(d2.getByRole("heading"), "color"), loi));
  const cancel2 = d2.getByRole("button").first(), ok2 = d2.getByRole("button").last(); // nhãn nút xác nhận đổi khi đang chờ → định vị theo vị trí
  check("tiêu điểm đầu tiên ở nút HUỶ (không phải nút xoá)", await cancel2.evaluate(e => e === document.activeElement));
  check("nút xác nhận nền đỏ, chữ trắng, đạt 4,5:1", same(await css(ok2, "backgroundColor"), loi) && same(await css(ok2, "color"), "rgb(255,255,255)") && ratio(parse(await css(ok2, "color")), parse(await css(ok2, "backgroundColor"))) >= 4.5);
  await pg.keyboard.press("Enter");
  await d2.waitFor({ state: "hidden", timeout: 5000 });
  const nk = await pg.locator('[data-mau="nhat-ky"]').innerText();
  check("Enter khi đang ở nút Huỷ → huỷ, KHÔNG xác nhận", nk.includes("huỷ nguy hiểm") && !nk.includes("xác nhận nguy hiểm"), nk);
  await openNH.click();
  await d2.waitFor({ timeout: 5000 });
  const inside = () => pg.evaluate(() => !!document.activeElement?.closest("[data-kin-confirm]"));
  const seq: boolean[] = [];
  for (let i = 0; i < 5; i++) { await pg.keyboard.press("Tab"); seq.push(await inside()); }
  check("Tab 5 lần: tiêu điểm xoay vòng trong hộp, không lọt ra trang", seq.every(Boolean), seq);
  await pg.keyboard.press("Shift+Tab");
  check("Shift+Tab cũng xoay vòng trong hộp", await inside());
  await pg.mouse.click(5, 5);
  await d2.waitFor({ state: "hidden", timeout: 5000 });
  check("bấm nền = huỷ", (await pg.locator('[data-mau="nhat-ky"]').innerText()).split("huỷ nguy hiểm").length === 3);
  await openNH.click();
  await d2.waitFor({ timeout: 5000 });
  await ok2.click();
  check("đang xử lý: cả hai nút khoá, nhãn 'Đang thu hồi…', aria-busy, không vòng xoay", await cancel2.isDisabled() && await ok2.isDisabled() && (await ok2.innerText()) === "Đang thu hồi…" && (await ok2.getAttribute("aria-busy")) === "true" && await d2.locator(".animate-spin").count() === 0);
  await pg.keyboard.press("Escape");
  check("đang xử lý: Escape không đóng hộp", await d2.isVisible());
  await d2.waitFor({ state: "hidden", timeout: 6000 });
  check("xử lý xong hộp đóng, nhật ký ghi 'xác nhận nguy hiểm'", (await pg.locator('[data-mau="nhat-ky"]').innerText()).includes("xác nhận nguy hiểm"));

  // ───────── Điện thoại
  section("Điện thoại 390px: không tràn ngang, toast và hộp vừa khung");
  const mctx = await ctxFor(null, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  mp.on("pageerror", e => errors.push(String(e)));
  await mp.goto(`${BASE}/kin-mau`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Bộ component KiN" }).waitFor({ timeout: 60000 });
  await mp.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
  check("trang không cuộn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), await mp.evaluate(() => document.documentElement.scrollWidth));
  check("toast mẫu vừa khung (≤ 358px)", (await mp.locator('[data-mau="toast"] [data-kin-toast]').evaluateAll(els => els.every(e => e.getBoundingClientRect().width <= 358))));
  await mp.getByRole("button", { name: "Bật toast xong" }).click();
  const mt = await mp.locator('.fixed [data-kin-toast]').first().boundingBox();
  check("toast nổi trên điện thoại nằm gọn trong màn hình", !!mt && mt.x >= 0 && mt.x + mt.width <= 390, mt);
  await mp.getByRole("button", { name: "Mở hộp nguy hiểm" }).click();
  const md = mp.getByRole("dialog", { name: /Thu hồi quyền/ });
  await md.waitFor({ timeout: 5000 });
  const mb = await md.boundingBox();
  const btns = await md.getByRole("button").evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.height >= 44; }));
  check("hộp nằm gọn trong 390px (rộng ≤ 358) và cả hai nút thấy được, cao ≥ 44px", !!mb && mb.width <= 358 && mb.x >= 16 - 1 && btns.length === 2 && btns.every(Boolean), [mb, btns]);

  // ───────── KinSelect (LOI-02 mục 2.G + 4.4) — chưa có trên /kin-mau (trang mẫu là tệp chung), đo trên ô "Lớp" của trang Học sinh gia sư (10 lớp ⇒ có ô tìm).
  section("KinSelect · ô 'Lớp' ở /lop-cua-toi/hoc-sinh (1280 + 390)");
  {
    const { mkTutor, mkUser, mkCourse } = await import("./h");
    const { prisma } = await import("@/lib/prisma");
    const T = await mkTutor("Cô Chọn");
    const S = await mkUser({ name: "Em Chọn" });
    const names = ["Toán 6", "Toán 7", "Toán 8", "Toán 9", "Lý 10", "Hoá 11", "Sinh 12", "Văn 9", "Anh 8", "Địa lý 7"];
    for (const n of names) { const c = await mkCourse(T.id, { name: n }); await prisma.enrollment.create({ data: { userId: S.id, courseId: c.id, status: "active" } }); }
    for (const [W, H] of [[1280, 900], [390, 844]] as const) {
      const cs = await ctxFor(T, { width: W, height: H });
      const ps = await cs.newPage();
      ps.on("pageerror", e => errors.push(String(e)));
      await ps.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "domcontentloaded", timeout: 170000 });
      const sel = ps.getByRole("combobox", { name: "Lớp" });
      await sel.waitFor({ timeout: 120000 });
      check(`${W}: KinSelect role=combobox, aria-haspopup=listbox, đóng (aria-expanded=false), cao ≥ 44px`, (await sel.getAttribute("aria-haspopup")) === "listbox" && (await sel.getAttribute("aria-expanded")) === "false" && ((await sel.boundingBox())?.height ?? 0) >= 43.5);
      await sel.focus();
      await ps.keyboard.press("ArrowDown");
      const lb = ps.getByRole("listbox");
      await lb.waitFor({ timeout: 5000 });
      check(`${W}: ↓ mở listbox, 11 option (Tất cả lớp + 10 lớp), mục đang chọn aria-selected`, (await lb.getByRole("option").count()) === 11 && (await lb.getByRole("option", { selected: true }).innerText()).includes("Tất cả lớp"));
      check(`${W}: > 8 lựa chọn ⇒ có ô tìm, tiêu điểm vào ô tìm`, (await ps.getByRole("searchbox", { name: "Tìm lựa chọn" }).count()) === 1 && (await ps.evaluate(() => document.activeElement?.getAttribute("role"))) === "searchbox");
      const geo = await ps.locator("[data-kin-select-mo]").evaluate(e => { const r = e.getBoundingClientRect(); return { h: r.height, right: r.right, vw: innerWidth, vh: innerHeight }; });
      check(`${W}: danh sách cao ≤ min(320px, 50vh), không vượt mép phải`, geo.h <= Math.min(320, geo.vh / 2) + 1 && geo.right <= geo.vw, geo);
      const oh = await lb.getByRole("option").evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
      check(`${W}: mỗi option ≥ 44px`, oh.every(h => h >= 43.5), oh);
      await ps.keyboard.type("dia ly"); // không dấu
      check(`${W}: gõ 'dia ly' (không dấu) lọc còn 'Địa lý 7'`, (await lb.getByRole("option").count()) === 1 && (await lb.getByRole("option").innerText()).includes("Địa lý 7"));
      await ps.keyboard.type("zzz");
      check(`${W}: không khớp → 'Không có lựa chọn khớp'`, (await ps.getByText("Không có lựa chọn khớp").count()) === 1);
      await ps.keyboard.press("Escape");
      check(`${W}: Esc đóng, tiêu điểm về nút`, (await sel.getAttribute("aria-expanded")) === "false" && (await ps.evaluate(() => document.activeElement?.getAttribute("role"))) === "combobox");
      await ps.keyboard.press("Enter");
      await ps.keyboard.type("toan 8");
      await ps.keyboard.press("Enter");
      check(`${W}: Enter mở, gõ lọc 'toan 8', Enter chọn → nút đọc 'Toán 8', đóng`, (await sel.innerText()).includes("Toán 8") && (await sel.getAttribute("aria-expanded")) === "false");
      check(`${W}: tên đọc được của nút = nhãn + giá trị ("Lớp Toán 8") — trình đọc màn hình đọc cả lựa chọn đang chọn`, (await ps.getByRole("combobox", { name: "Lớp Toán 8", exact: true }).count()) === 1);
      await sel.click();
      await ps.mouse.click(5, 5);
      check(`${W}: bấm ngoài → đóng`, (await sel.getAttribute("aria-expanded")) === "false");
      check(`${W}: không tràn ngang`, await ps.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await cs.close();
    }
  }

  // ───────── KinSelect LOI-06 — nhãn <label htmlFor> / nhãn bọc ô, danh sách không bị panel cắt, ngăn kéo có transform, 390, màn học phí gửi y giá trị cũ.
  section("KinSelect (LOI-06) · trên trang thật, 1600 + 390");
  {
    const { mkTutor, mkUser, mkCourse, mkSuper } = await import("./h");
    const { prisma } = await import("@/lib/prisma");
    const T = await mkTutor("Cô Ô Chọn"), SU = await mkSuper("Quản trị Ô Chọn"), S = await mkUser({ name: "Em Ô Chọn" });
    const C = await mkCourse(T.id, { name: "Toán 9 Ô Chọn" });
    await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
    /** Danh sách đang mở: hộp nằm trong khung nhìn, và điểm giữa mục đầu / mục cuối đang thấy bấm trúng CHÍNH mục đó (không bị panel / khung cuộn cắt hay đè). */
    const listOk = (pg: import("playwright").Page) => pg.locator("[data-kin-select-mo]").evaluate(box => {
      const r = box.getBoundingClientRect(), ul = box.querySelector('[role="listbox"]')!, u = ul.getBoundingClientRect();
      const opts = [...box.querySelectorAll<HTMLElement>('[role="option"]')].filter(o => { const q = o.getBoundingClientRect(); return q.bottom > u.top + 2 && q.top < u.bottom - 2; });
      const hit = (o: HTMLElement) => { const q = o.getBoundingClientRect(); const x = q.left + q.width / 2, y = Math.max(q.top, u.top) / 2 + Math.min(q.bottom, u.bottom) / 2; return o.contains(document.elementFromPoint(x, y)); };
      return { inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, hitFirst: !!opts[0] && hit(opts[0]), hitLast: !!opts.at(-1) && hit(opts.at(-1)!), n: opts.length, r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
    });
    const noHScroll = (pg: import("playwright").Page) => pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    for (const [W, H] of [[1600, 900], [390, 844]] as const) {
      // 1. Khách — <label htmlFor="dc-m"> riêng: tên đọc = nhãn + giá trị; chọn được bằng bàn phím.
      const cg = await ctxFor(null, { width: W, height: H }), pgG = await cg.newPage();
      pgG.on("pageerror", e => errors.push(String(e)));
      await pgG.goto(`${BASE}/diem-chuan`, { waitUntil: "domcontentloaded", timeout: 170000 });
      const dm = pgG.locator("#dc-m");
      await dm.waitFor({ timeout: 120000 });
      await eventually(`${W}: <label htmlFor> riêng ⇒ nút nối nhãn + giá trị ('Phương thức xét Tất cả')`, async () => (await pgG.getByRole("combobox", { name: "Phương thức xét Tất cả", exact: true }).count()) === 1);
      check(`${W}: getByLabel('Phương thức xét', exact) vẫn tìm đúng nút (nhãn liên kết)`, (await pgG.getByLabel("Phương thức xét", { exact: true }).getAttribute("role")) === "combobox");
      await cg.close();

      // 2. Quản trị — nhãn BỌC ô ("Khoảng thời gian"): tên đọc gọn, bấm mục không bị nhãn mở lại, giá trị đổi, máy chủ nhận ?days=7.
      const ca = await ctxFor(SU, { width: W, height: H }), pa = await ca.newPage();
      pa.on("pageerror", e => errors.push(String(e)));
      const asked: string[] = [];
      pa.on("request", r => { if (/\/api\/admin\/.*days=/.test(r.url())) asked.push(r.url()); });
      await pa.goto(`${ADMIN}/admin/so-do`, { waitUntil: "domcontentloaded", timeout: 170000 });
      const kt = pa.getByRole("combobox", { name: /^Khoảng thời gian/ });
      await kt.waitFor({ timeout: 120000 });
      await eventually(`${W}: nhãn bọc ô ⇒ tên đọc = chữ nhãn + giá trị, KHÔNG lẫn chữ của danh sách`, async () => (await pa.getByRole("combobox", { name: "Khoảng thời gian 30 ngày gần nhất", exact: true }).count()) === 1);
      await kt.click();
      await pa.getByRole("option", { name: "7 ngày gần nhất", exact: true }).click();
      await pa.waitForTimeout(400);
      check(`${W}: PHÁ — bấm mục trong ô bọc <label>: danh sách ĐÓNG và không bị nhãn mở lại; nút mang '7'`, (await kt.getAttribute("aria-expanded")) === "false" && (await kinSelectValue(kt)) === "7" && (await pa.locator("[data-kin-select-mo]").count()) === 0);
      await eventually(`${W}: máy chủ được hỏi với days=7 (giá trị số y như <select> cũ)`, async () => asked.some(u => /days=7\b/.test(u)), 20000);

      // 3. Ngăn kéo "Tạo khoá học" (fixed + transform + overflow-y-auto): danh sách bám đúng dưới nút, không lệch theo transform, không bị cắt.
      await pa.goto(`${ADMIN}/admin/khoa-hoc`, { waitUntil: "domcontentloaded", timeout: 170000 });
      await pa.getByRole("button", { name: /^Tạo khoá học/ }).filter({ visible: true }).first().click({ timeout: 120000 });
      const dmc = pa.getByRole("combobox", { name: /^Danh mục/ }).filter({ visible: true }).first();
      await dmc.waitFor({ timeout: 30000 });
      await pa.waitForTimeout(600); // ngăn kéo trượt xong
      await dmc.click();
      await pa.locator("[data-kin-select-mo]").waitFor({ timeout: 10000 });
      const g = await pa.evaluate(() => { const b = document.querySelector('[data-kin-select-nut][aria-expanded="true"]')!.getBoundingClientRect(), m = document.querySelector("[data-kin-select-mo]")!.getBoundingClientRect(); return { dx: Math.abs(m.left - Math.max(16, Math.min(b.left, innerWidth - 16 - m.width))), dy: Math.min(Math.abs(m.top - (b.bottom + 4)), Math.abs(m.bottom - (b.top - 4))) }; });
      check(`${W}: PHÁ — ngăn kéo có transform: danh sách bám mép nút (lệch ≤ 2px), không trôi theo khối chứa`, g.dx <= 2 && g.dy <= 2, g);
      const lo = await listOk(pa);
      check(`${W}: ngăn kéo: danh sách nằm trong khung nhìn, mục đầu + cuối đang thấy bấm trúng (không bị cắt/đè)`, lo.inView && lo.hitFirst && lo.hitLast, lo);
      check(`${W}: ngăn kéo: không cuộn ngang khi danh sách mở`, await noHScroll(pa));
      await pa.keyboard.press("Escape");
      await ca.close();

      // 4. Panel bên (Modal "Thêm khung giờ") — ô "Kết thúc" nhiều lựa chọn: không bị panel cắt; ở 390 (ngăn dưới) lật lên khi thiếu chỗ.
      const ct = await ctxFor(T, { width: W, height: H }), pt = await ct.newPage();
      pt.on("pageerror", e => errors.push(String(e)));
      await pt.goto(`${BASE}/lop-cua-toi/lich/khung?lop=${C.id}`, { waitUntil: "domcontentloaded", timeout: 170000 });
      await pt.locator("[data-add-block]").click({ timeout: 120000 });
      const se = pt.locator("#sched-e");
      await se.waitFor({ timeout: 30000 });
      await se.click();
      await pt.locator("[data-kin-select-mo]").waitFor({ timeout: 10000 });
      const lp = await listOk(pt);
      check(`${W}: panel bên: danh sách 'Kết thúc' trong khung nhìn, mục đầu + cuối bấm trúng (không bị panel cắt)`, lp.inView && lp.hitFirst && lp.hitLast && lp.n >= 3, lp);
      check(`${W}: panel bên: không cuộn ngang khi mở`, await noHScroll(pt));
      await pt.keyboard.press("Escape");
      await kinSelect(se, "1230");
      check(`${W}: panel bên: chọn 20:30 → nút mang 1230`, (await kinSelectValue(se)) === "1230");
      await ct.close();
    }

    // 5. Học phí (cờ TIỀN = không): chỉ đổi giao diện — giá trị GỬI ĐI y hệt <select> cũ.
    section("KinSelect (LOI-06) · màn học phí gửi đúng giá trị cũ");
    {
      const cs = await ctxFor(S, { width: 390, height: 844 }), ps = await cs.newPage();
      const got: string[] = [];
      ps.on("request", r => { const m = r.url().match(/\/api\/users\/me\/invoices\?yearMonth=([^&]*)/); if (m) got.push(m[1]); });
      await ps.goto(`${BASE}/student/hoc-phi`, { waitUntil: "domcontentloaded", timeout: 170000 });
      const th = ps.getByRole("combobox", { name: /^Tháng/ });
      await th.waitFor({ timeout: 120000 });
      await th.click();
      const lbT = ps.locator(`[id="${await th.getAttribute("aria-controls")}"]`);
      await lbT.waitFor({ timeout: 10000 });
      const vals = await lbT.getByRole("option").evaluateAll(es => es.map(e => e.getAttribute("data-value") ?? ""));
      await ps.keyboard.press("Escape");
      await lbT.waitFor({ state: "detached", timeout: 10000 });
      const exp = Array.from({ length: 12 }, (_, i) => { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() - i, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; });
      check("học sinh: 12 lựa chọn tháng mang đúng giá trị 'YYYY-MM' như <select> cũ (tháng này trước)", vals.join() === exp.join(), vals);
      const v = await kinSelect(th, { index: 1 });
      await eventually("học sinh: chọn tháng trước → gọi /api/users/me/invoices?yearMonth=<đúng giá trị đó>", async () => got.at(-1) === v && v === exp[1], 20000);
      await cs.close();

      const ct = await ctxFor(T, { width: 1600, height: 900 }), pt = await ct.newPage();
      const gets: string[] = []; let posted: unknown = null, put: unknown = null;
      pt.on("request", r => { const m = r.url().match(/\/api\/tutor\/invoices\?yearMonth=([^&]*)/); if (m && r.method() === "GET") gets.push(m[1]); });
      await pt.route("**/api/tutor/invoices", async r => { if (r.request().method() === "POST") { posted = r.request().postDataJSON(); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ created: [], skipped: [] }) }); } else await r.continue(); });
      await pt.route("**/api/tutor/payout-account", async r => { if (r.request().method() === "PUT") { put = r.request().postDataJSON(); await r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); } else await r.continue(); });
      await pt.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "domcontentloaded", timeout: 170000 });
      const tm = pt.getByRole("combobox", { name: /^Tháng/ });
      await tm.waitFor({ timeout: 120000 });
      const ym = await kinSelect(tm, { index: 1 });
      await eventually("gia sư: chọn tháng → GET /api/tutor/invoices?yearMonth=<đúng giá trị>", async () => gets.at(-1) === ym && /^\d{4}-\d{2}$/.test(ym), 20000);
      await pt.getByRole("button", { name: "Lập phiếu cả lớp" }).click();
      await eventually("gia sư: 'Lập phiếu cả lớp' gửi { yearMonth } y giá trị đang chọn (đã chặn, không ghi DB)", async () => JSON.stringify(posted) === JSON.stringify({ yearMonth: ym }), 20000);
      await pt.goto(`${BASE}/lop-cua-toi/hoc-phi?tab=nhan-tien`, { waitUntil: "domcontentloaded", timeout: 170000 });
      const nh = pt.getByRole("combobox", { name: /^Ngân hàng/ });
      await nh.waitFor({ timeout: 120000 });
      const banks = await kinSelectOptions(nh);
      check("gia sư: ô Ngân hàng liệt kê danh sách ngân hàng + 'Ngân hàng khác (nhập mã BIN)' ở cuối", banks.length >= 3 && banks.at(-1) === "Ngân hàng khác (nhập mã BIN)", banks.slice(-2));
      const bin = await kinSelect(nh, { index: 2 });
      await pt.getByLabel("Số tài khoản").fill("0123456789");
      await pt.getByLabel(/Tên chủ tài khoản/).fill("NGUYEN VAN A");
      await pt.getByRole("button", { name: "Lưu tài khoản" }).click();
      await eventually("gia sư: 'Lưu tài khoản' gửi bankBin = mã BIN của mục đã chọn (chuỗi 6 số), đã chặn", async () => !!put && (put as { bankBin?: string }).bankBin === bin && /^\d{6}$/.test(bin), 20000);
      await ct.close();
    }
  }

  check("không lỗi console/pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
