// Bộ component KiN (Figma Nút 6:50 · Thẻ trạng thái 8:139 · Tab 106:30 · Toast 106:23 · Hộp xác nhận 106:51) trên trang mẫu /kin-mau.
// Đo bằng style tính ra: kích thước, màu theo token, trạng thái rê chuột / focus / tắt, bàn phím, tương phản, điện thoại 390px.
import { BASE, check, section, done, eventually } from "./h";
import { launch, ctxFor, closeAll } from "./ui";

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
  check("chữ 13,3px, bo 9px", (await css(nut.first(), "fontSize")) === "13.3px" && (await css(nut.first(), "borderTopLeftRadius")) === "9px");
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
  check("cao 16px, chữ 13,3px", (await tt.evaluateAll(els => els.every(e => Math.round(e.getBoundingClientRect().height) === 16 && getComputedStyle(e).fontSize === "13.3px"))));
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
  check("đang mở: chữ đậm 600, đen, cỡ 13.3px; gạch chân 2px màu nhấn là thanh chung nằm đúng dưới tab đó", t0.w === "600" && same(t0.c, chinh) && t0.fs === "13.3px" && ink.h === 2 && same(ink.bg, navy) && ink.dx < 1.5 && ink.dw < 1.5 && ink.dy < 3, { t0, ink });
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

  check("không lỗi console/pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
