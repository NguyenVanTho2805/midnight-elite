// Thanh bên RỘNG theo Figma "Nền móng" (khung con "Điều hướng", 25/10/2026) — màn hình thật: 272px là MẶC ĐỊNH, mục xếp theo NHÓM với biểu tượng + chữ,
// logo + nhãn vai ở đầu, "Miễn phí ra mắt" ở chân. Gồm vỏ gia sư, học sinh, quản trị; điểm gãy 1024px; thanh hẹp / thu vẫn chọn được; điện thoại không đổi.
// Các bài ui-* khác chạy ở thanh HẸP (ctxFor đặt sẵn "mo"); bài này dùng rail: "mac-dinh" để thấy đúng thứ người dùng mới thấy.
import { mkUser, mkTutor, mkSuper, wipe, check, eventually, section, done, BASE, api } from "./h";
import { launch, ctxFor, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";
import { visibleModules } from "@/lib/adminNav";

import { FEATURES as KIN_FEATURES, featureOn as kinFeatureOn } from "@/lib/features";

// LOI-01 (11/11/2026): bài này khẳng định ĐỦ menu / khối trang chủ của các phần mà LOI-01 mặc định ẨN (Lịch, Cộng đồng, Tin tức, Thư viện, Tìm gia sư, Tiếng Anh, Xếp hạng, Coin, Điểm chuẩn).
// Chạy với NEXT_PUBLIC_KIN_MO_<TÊN>=1 (bật hết) cho CẢ máy chủ dev lẫn bài (cùng env.sh) mới có nghĩa; cờ đang tắt thì bỏ qua có thông báo thay vì đỏ vì thiếu mục đang bị ẩn có chủ đích.
// Hành vi KHI ẨN do bài của LOI-01 phủ: t-features-lib, ui-links-everywhere, ui-role-everything, ui-tutor-shell, ui-student-shell, ui-coin-an, ui-loi-cong-dong-lop.
const KIN_OFF = KIN_FEATURES.filter(k => !kinFeatureOn(k));
if (KIN_OFF.length) {
  console.log(`\n(BỎ QUA cả bài: LOI-01 đang ẨN ${KIN_OFF.join(", ")}. Chạy với NEXT_PUBLIC_KIN_MO_<TÊN>=1 cho cả máy chủ dev và bài để kiểm đủ menu/khối.)\n0 pass / 0 fail`);
  process.exit(0);
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Gia Bảo" });
  const SA = await mkSuper("Quản trị cấp 1");
  const AC = await mkUser({ name: "Biên tập", role: "admin", adminRole: "admin_content" });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(m.text()); }); };
  const nav = (p: any, name: string) => p.getByRole("navigation", { name });
  const groupsOf = (p: any, name: string) => p.evaluate((n: string) => {
    const nv = Array.from(document.querySelectorAll("nav")).find(e => e.getAttribute("aria-label") === n && getComputedStyle(e).position !== "fixed")!;
    return Array.from(nv.querySelectorAll('.kin-rail-groups [role="group"]')).map(g => ({ title: g.getAttribute("aria-label"), items: Array.from(g.querySelectorAll("a")).map(a => (a.textContent ?? "").trim()), heading: (g.querySelector(".kin-rail-gh") as HTMLElement | null)?.innerText }));
  }, name) as Promise<{ title: string; items: string[]; heading?: string }[]>;
  const wrapW = (p: any) => p.evaluate(`Math.round(document.querySelector("#kin-rail")?.getBoundingClientRect().width ?? -1)`) as Promise<number>;
  const attr = (p: any) => p.evaluate(`document.documentElement.getAttribute("data-kin-rail")`) as Promise<string | null>;

  // ───────────── Gia sư
  section("Gia sư: mặc định thanh RỘNG 272px; chế độ gọn tường minh (modules: [] → Lịch + Học phí) → nhóm ngắn hơn Figma nhưng đủ nhóm");
  // BU-00 (31/10/2026): chưa chọn gì = ĐỦ module, nên muốn thử chế độ gọn phải ghi tường minh `modules: []`.
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: [] } } });
  const ctxT = await ctxFor(T, { width: 1440, height: 1000, rail: "mac-dinh" });
  const pt = await ctxT.newPage(); watch(pt);
  await pt.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await nav(pt, "Module của gia sư").first().waitFor({ timeout: 90000 });
  check("rộng 272px, <html data-kin-rail=rong> dù máy chưa lưu gì", (await wrapW(pt)) === 272 && (await attr(pt)) === "rong" && (await pt.evaluate(`localStorage.getItem("kin.thanh-ben")`)) === null);
  const gt = await groupsOf(pt, "Module của gia sư");
  check("năm nhóm đúng thứ tự Figma: Làm việc hằng ngày · Dạy học · Tiền · Giới thiệu · Tài khoản", gt.map(g => g.title).join("|") === "Làm việc hằng ngày|Dạy học|Tiền|Giới thiệu|Tài khoản", gt.map(g => g.title));
  check("tiêu đề nhóm hiện CHỮ HOA (LÀM VIỆC HẰNG NGÀY…) như Figma", gt.map(g => g.heading).join("|") === "LÀM VIỆC HẰNG NGÀY|DẠY HỌC|TIỀN|GIỚI THIỆU|TÀI KHOẢN", gt.map(g => g.heading));
  check("chế độ gọn: nhóm đầu = Lịch + Học sinh (GS-09: Học sinh không phụ thuộc module Lớp); Tiền = Học phí + Doanh thu; Dạy học đủ 4 (có Tổng quan; GS-LOP-GON: không còn Kế hoạch buổi vì Hộp việc tắt); Giới thiệu 3 (+ Yêu cầu tìm gia sư); Tài khoản 3 (Gói của tôi, Cài đặt, + Thêm module khi còn module ẩn; B2: bỏ Liên hệ hỗ trợ)",
    gt[0].items.join("|") === "Lịch|Học sinh" && gt[1].items.join("|") === "Tổng quan|Báo cáo tháng|Sổ điểm|Kiểm duyệt cộng đồng" && gt[2].items.join("|") === "Học phí|Doanh thu"
    && gt[3].items.join("|") === "Hồ sơ gia sư|Bài đăng tìm học sinh|Yêu cầu tìm gia sư" && gt[4].items.join("|") === "Gói của tôi|Cài đặt|Thêm module", gt);
  const lichItem = nav(pt, "Module của gia sư").first().getByRole("link", { name: "Lịch", exact: true });
  check("mục đang ở ('Lịch') có aria-current=page, nền 'đang chọn', chữ đậm", await lichItem.getAttribute("aria-current") === "page" && await lichItem.evaluate((e: any) => getComputedStyle(e).backgroundColor !== "rgba(0, 0, 0, 0)" && Number(getComputedStyle(e).fontWeight) >= 600));
  check("chỉ MỘT mục aria-current trong thanh rộng (Hộp việc, Học phí… không sáng theo)", (await nav(pt, "Module của gia sư").first().locator('.kin-rail-groups [aria-current="page"]').count()) === 1);
  check("logo KiN + nhãn vai 'GIA SƯ' ở đầu thanh; chân 'Miễn phí ra mắt'", await pt.locator("#kin-rail [data-rail-home]").isVisible() && (await pt.locator("#kin-rail .kin-rail-tag").innerText()).trim() === "GIA SƯ" && await pt.locator("#kin-rail [data-rail-footnote]").isVisible() && (await pt.locator("#kin-rail [data-rail-footnote]").innerText()).trim() === "Miễn phí ra mắt");
  const dims = await pt.evaluate(() => { const it = document.querySelector<HTMLElement>("#kin-rail .kin-rail-wi")!; const r = it.getBoundingClientRect(); const ic = it.querySelector("svg")!.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), icon: Math.round(ic.width), gap: Math.round(it.querySelector("span")!.getBoundingClientRect().left - ic.right) }; });
  check("số đo Figma: mục cao 37px, biểu tượng 21px, cách chữ 12px (màn chuột)", dims.h === 37 && dims.icon === 21 && dims.gap === 12 && dims.w > 220, dims);
  check("không tràn ngang, thanh sát mép trái", await pt.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean && (await pt.locator("#kin-rail").boundingBox())?.x === 0);
  // xoá lựa chọn (về mặc định BU-00 = đủ module): Lớp → hiện Lớp + Học sinh; Hộp việc → đứng đầu
  await prisma.user.update({ where: { id: T.id }, data: { preferences: {} } });
  await pt.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await nav(pt, "Module của gia sư").first().waitFor({ timeout: 90000 });
  const gt2 = await groupsOf(pt, "Module của gia sư");
  check("chưa chọn module (mặc định BU-00) = đủ module: nhóm đầu = Hộp việc, Lịch, Lớp, Học sinh, Bài tập, Thư viện (đúng Figma); hết 'Thêm module'", gt2[0].items.join("|") === "Hộp việc|Lịch|Lớp|Học sinh|Bài tập|Thư viện" && !gt2[4].items.includes("Thêm module"), gt2);
  await pt.getByRole("link", { name: "Gói của tôi", exact: true }).first().click();
  await pt.waitForURL(/\/lop-cua-toi\/goi/, { timeout: 90000 });
  check("bấm 'Gói của tôi' → sang trang gói, mục đó sáng, 'Lịch' hết sáng", await nav(pt, "Module của gia sư").first().getByRole("link", { name: "Gói của tôi" }).getAttribute("aria-current") === "page" && (await nav(pt, "Module của gia sư").first().locator('.kin-rail-groups [aria-current="page"]').count()) === 1);
  await ctxT.close();

  // ───────────── Học sinh
  section("Học sinh: Làm việc hằng ngày (3 module) · Khám phá · Tự học");
  const ctxS = await ctxFor(S, { width: 1440, height: 1000, rail: "mac-dinh" });
  const ps = await ctxS.newPage(); watch(ps);
  await ps.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await nav(ps, "Module của học sinh").first().waitFor({ timeout: 90000 });
  const gs = await groupsOf(ps, "Module của học sinh");
  // BU-00 bước 6 (31/10/2026): bỏ nhóm "Học tập" và rút Khám phá / Tài khoản — học sinh chỉ thấy việc học; lệch Figma 575:5571 CÓ CHỦ ĐÍCH (kế hoạch BIGUPDATE BU-00 ghi cập nhật khung).
  check("ba nhóm: Làm việc hằng ngày · Khám phá · Tự học (B2 08/11: nhóm Tài khoản rút, đã có ở menu tài khoản)", gs.map(g => g.title).join("|") === "Làm việc hằng ngày|Khám phá|Tự học", gs.map(g => g.title));
  check("đúng mục: Trang chủ (BU-HS-TRANG-CHU 09/11) + 3 module (B1: bỏ Bài tập); Khám phá = Lớp miễn phí, Gia sư, Cộng đồng, Tin tức (08/11: lối tìm lớp miễn phí); Tự học = Tiếng Anh tự học", gs[0].items.join("|") === "Trang chủ|Việc của tôi|Lịch học|Lớp của tôi"
    && gs[1].items.join("|") === "Lớp miễn phí|Gia sư|Cộng đồng|Tin tức" && gs[2].items.join("|") === "Tiếng Anh tự học", gs);
  check("BU-HS-TRANG-CHU: 'Trang chủ' đứng đầu thanh rộng, → '/', KHÔNG sáng ở /student/*; logo thanh bên cũng → '/' (không còn → Việc của tôi)",
    (await nav(ps, "Module của học sinh").first().getByRole("link", { name: "Trang chủ", exact: true }).getAttribute("href")) === "/" && (await nav(ps, "Module của học sinh").first().getByRole("link", { name: "Trang chủ", exact: true }).getAttribute("aria-current")) === null
    && (await ps.locator("#kin-rail [data-rail-home]").getAttribute("href")) === "/");
  check("nhãn vai 'HỌC SINH', thanh 272px, 'Việc của tôi' đang sáng", (await ps.locator("#kin-rail .kin-rail-tag").innerText()).trim() === "HỌC SINH" && (await wrapW(ps)) === 272 && await nav(ps, "Module của học sinh").first().getByRole("link", { name: /^Việc của tôi/ }).getAttribute("aria-current") === "page");
  await nav(ps, "Module của học sinh").first().getByRole("link", { name: "Lịch học", exact: true }).click();
  await ps.waitForURL(/\/student\/lich-hoc/, { timeout: 90000 });
  check("bấm 'Lịch học' → vào /student/lich-hoc, mục đó sáng; vẫn ở thanh RỘNG", await nav(ps, "Module của học sinh").first().getByRole("link", { name: "Lịch học" }).getAttribute("aria-current") === "page" && (await wrapW(ps)) === 272);
  // thu hẹp / thu / mở lại
  await ps.locator("[data-rail-widen]").click();
  await eventually("nút thu hẹp → 79px, <html data-kin-rail=mo>, nhóm ẩn, biểu tượng hiện", async () => (await wrapW(ps)) === 79 && (await attr(ps)) === "mo" && (await ps.locator("#kin-rail .kin-rail-groups").evaluate((e: any) => getComputedStyle(e).display)) === "none");
  await ps.locator("[data-rail-close]").click();
  await eventually("thu hẳn → 0px", async () => (await wrapW(ps)) === 0 && (await attr(ps)) === "thu");
  await ps.keyboard.press("[");
  await eventually("phím '[' mở lại về bề rộng đã dùng (79px, vì vừa thu hẹp)", async () => (await wrapW(ps)) === 79);
  await ctxS.close();

  // ───────────── Điểm gãy 1024px + điện thoại
  section("Màn 900px: dù đã chọn 'rộng' vẫn dùng thanh hẹp 79px (thanh rộng chỉ từ 1024px); điện thoại không đổi");
  // Cách ly bài: phần 1440px ở trên đã bấm thu hẹp/thu/mở nên tài khoản S đã lưu rail="mo" (PUT /api/users/me/preferences, railStore.ts saveRailToAccount) và máy mới đăng nhập S sẽ nhận lại "mo".
  // Muốn kiểm "người chọn rộng" ở 900px thì đặt lại tài khoản về "rong" — đây là điều kiện đầu vào, không nới điều kiện kiểm.
  await api("PUT", "/api/users/me/preferences", { as: S, body: { rail: "rong" } });
  const ctxM = await ctxFor(S, { width: 900, height: 800, rail: "mac-dinh" });
  const pn = await ctxM.newPage(); watch(pn);
  await pn.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await nav(pn, "Module của học sinh").first().waitFor({ timeout: 90000 });
  check("900px: <html data-kin-rail=rong> (lựa chọn được giữ) nhưng thanh rộng 79px, biểu tượng + nhãn dưới, không có nhóm", (await attr(pn)) === "rong" && (await wrapW(pn)) === 79 && (await pn.locator("#kin-rail .kin-rail-groups").evaluate((e: any) => getComputedStyle(e).display)) === "none");
  await ctxM.close();
  const ctxP = await ctxFor(S, { width: 390, height: 844, rail: "mac-dinh" });
  const pp = await ctxP.newPage(); watch(pp);
  await pp.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await nav(pp, "Module của học sinh").last().waitFor({ timeout: 90000 });
  check("điện thoại 390px: thanh dưới cao 60px đủ 4 ô (3 module + Khác), không có thanh bên, không tràn ngang", await pp.evaluate(() => { const n = Array.from(document.querySelectorAll("nav")).find(e => getComputedStyle(e).position === "fixed")!; return Math.round(n.getBoundingClientRect().height) === 60 && n.querySelectorAll("a, button").length === 4 && document.documentElement.scrollWidth <= window.innerWidth; }) && (await pp.locator("#kin-rail").isVisible()) === false);
  await ctxP.close();

  // ───────────── Quản trị
  section("Quản trị: mỗi module là một NHÓM, trang con là mục; dải tab trang con vẫn còn; quyền quyết định mục nào hiện");
  const ctxA = await ctxFor(SA, { width: 1600, height: 1100, rail: "mac-dinh" });
  const pa = await ctxA.newPage(); watch(pa);
  await pa.goto(`${ADMIN}/admin/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await nav(pa, "Module quản trị").first().waitFor({ timeout: 90000 });
  const ga = await groupsOf(pa, "Module quản trị");
  // Cấu trúc thanh rộng lấy từ adminNav (BU-08: BỐN module Việc chờ · Con người · Học vụ · Vận hành); khung Figma 567:4791 (năm nhóm) đã cũ. "Hôm nay" không còn là mục: chỉ vào bằng logo.
  const wantG = visibleModules("admin_super");
  check("bốn nhóm theo adminNav: Việc chờ · Con người · Học vụ · Vận hành (tiêu đề hiện CHỮ HOA)", ga.map(g => g.title).join("|") === wantG.map(m => m.label).join("|") && ga.map(g => g.heading).join("|") === wantG.map(m => m.label.toLocaleUpperCase("vi")).join("|"), ga);
  check("quản trị cấp 1 thấy đủ mục theo adminNav, đúng thứ tự, KHÔNG có mục 'Hôm nay'", wantG.every((m, k) => ga[k]?.items.join("|") === m.subs.map(x => x.label).join("|")) && !ga.flatMap(g => g.items).includes("Hôm nay"), ga);
  check("nhãn vai 'QUẢN TRỊ', logo dẫn về /admin, thanh 272px", (await pa.locator("#kin-rail .kin-rail-tag").innerText()).trim() === "QUẢN TRỊ" && (await pa.locator("#kin-rail [data-rail-home]").getAttribute("href")) === "/admin" && (await wrapW(pa)) === 272);
  check("'Lớp' đang sáng; dải tab các trang con của module 'Học vụ' vẫn hiện ở đầu trang (Figma 567:4791 có cả hai)", await nav(pa, "Module quản trị").first().getByRole("link", { name: "Lớp", exact: true }).getAttribute("aria-current") === "page" && await pa.getByRole("navigation", { name: "Trang của Học vụ" }).isVisible());
  check("dải trên: chữ 'Quản trị KiN' bên trái và ngày hôm nay (Figma); logo KiN chỉ còn ở điện thoại", await pa.locator("[data-top-title]").innerText() === "Quản trị KiN" && await pa.locator("[data-top-date]").isVisible());
  await ctxA.close();
  const ctxC = await ctxFor(AC, { width: 1600, height: 1100, rail: "mac-dinh" });
  const pc = await ctxC.newPage(); watch(pc);
  await pc.goto(`${ADMIN}/admin/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await nav(pc, "Module quản trị").first().waitFor({ timeout: 90000 });
  const gc = await groupsOf(pc, "Module quản trị");
  const flat = gc.flatMap(g => g.items);
  check("quản trị cấp nội dung KHÔNG thấy mục cần quyền cao (Quản trị viên, Doanh thu, Gói KiN Pro, Lịch sử nạp Coin, Nhật ký) — quyền giữ nguyên như dải tab cũ", !["Quản trị viên", "Doanh thu", "Gói KiN Pro", "Lịch sử nạp Coin", "Nhật ký"].some(x => flat.includes(x)) && flat.includes("Lớp") && flat.includes("Hàng chờ"), flat);
  await ctxC.close();

  check("không có lỗi JavaScript trên trang nào", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
