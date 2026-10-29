// NC2-050 — "Tính điểm xét tuyển" (trình duyệt thật + cơ sở dữ liệu thật). Quản trị nhập công thức ở /admin/diem-chuan/cong-thuc; khách tính ở /diem-chuan.
// Kiểm: xem trước công thức khi gõ, báo lỗi vượt thang / thiếu nguồn, lưu bền, bật-tắt công khai & đối chiếu, xoá có hộp xác nhận; công cụ chỉ hiện khi có công thức CÔNG KHAI,
// tính đúng (8,5×2 + 7,25 + 9 = 33,25 × 0,75 = 24,94), lời giải từng bước, kẹp thang, báo lỗi từng ô, lưu ý "chỉ mang tính tham khảo" LUÔN hiện, không gửi điểm lên máy chủ, 390px.
import { BASE, api, mkSuper, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll, shot, ADMIN, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1"), S = await mkUser({ name: "Minh Anh" });
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 500)}`); }); };
  const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  // ───────────── Quản trị
  section("Quản trị: thêm công thức, xem trước, báo lỗi, lưu");
  const ca = await ctxFor(SA, { width: 1280, height: 1000 });
  const ap = await ca.newPage(); watch(ap);
  await ap.goto(`${ADMIN}/admin/diem-chuan/cong-thuc`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await ap.getByRole("heading", { level: 1, name: "Công thức tính điểm xét tuyển" }).waitFor({ timeout: 120000 });
  await ap.locator("[data-add-formula]").waitFor({ timeout: 60000 });
  check("trang trống: nói rõ 'Chưa có công thức nào' và công cụ chỉ hiện khi có công thức công khai", await ap.getByText(/Chưa có công thức nào/).isVisible());
  check("có lối quay lại '← Điểm chuẩn tuyển sinh' và nhắc 'chỉ mang tính tham khảo'", await ap.getByRole("link", { name: /Điểm chuẩn tuyển sinh/ }).isVisible() && /chỉ mang tính tham khảo/.test(await ap.locator("main, body").first().innerText()));
  await ap.locator("[data-add-formula]").click();
  const form = ap.locator("[data-formula-form]");
  await form.waitFor({ timeout: 30000 });
  await ap.fill("#ct-name", "Khối A00 — Toán nhân đôi");
  const subj = (i: number) => ap.locator("[data-subject-row]").nth(i);
  for (const [i, [label, max, w]] of ([["Toán", "10", "2"], ["Lý", "10", "1"], ["Hoá", "10", "1"]] as const).entries()) {
    await subj(i).locator("input").nth(0).fill(label); await subj(i).locator("input").nth(1).fill(max); await subj(i).locator("input").nth(2).fill(w);
  }
  const preview = ap.locator("[data-formula-preview]");
  check("khi chưa chỉnh hệ số nhân: xem trước báo ngay 'vượt thang 30' (Toán ×2 → tối đa 40)", /Chưa hợp lệ/.test(await preview.innerText()) && /vượt thang 30/.test(await preview.innerText()), await preview.innerText());
  await ap.fill("#ct-mul", "0,75");
  await form.getByRole("button", { name: "+ Thêm khoản cộng" }).click();
  await ap.locator("[data-bonus-row]").first().locator("input").nth(0).fill("Điểm ưu tiên");
  await ap.locator("[data-bonus-row]").first().locator("input").nth(1).fill("2,75");
  await eventually("xem trước hợp lệ: '(Toán × 2 + Lý + Hoá) × 0,75 + Điểm ưu tiên', tối đa 30 / thang 30", async () => /\(Toán × 2 \+ Lý \+ Hoá\) × 0,75 \+ Điểm ưu tiên/.test(await preview.innerText()) && /30 \/ thang 30/.test(await preview.innerText()), 8000);
  await ap.check("#ct-pub");
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("công khai mà chưa có nguồn → báo 'Cần đường dẫn nguồn…', form vẫn mở, chưa có bản ghi", async () => /Cần đường dẫn nguồn/.test(await form.getByRole("alert").innerText()) && (await prisma.admissionFormula.count()) === 0, 15000);
  await ap.fill("#ct-url", "https://example.edu.vn/thong-bao-tuyen-sinh");
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("có nguồn → lưu: form đóng, dòng mới hiện với cách tính + thang 30 + nguồn example.edu.vn", async () => (await form.count()) === 0 && (await ap.locator("[data-formula-row]").count()) === 1 && /\(Toán × 2 \+ Lý \+ Hoá\) × 0,75/.test(await ap.locator("[data-formula-row]").innerText()) && /example\.edu\.vn/.test(await ap.locator("[data-formula-row]").innerText()), 20000);
  const row1 = await prisma.admissionFormula.findFirstOrThrow();
  check("cơ sở dữ liệu: 1 công thức công khai, chưa đối chiếu, thang 30, hệ số nhân 0,75", row1.published && !row1.verified && row1.scale === 30 && row1.multiplier === 0.75, row1);
  check("nhật ký quản trị ghi 'admission_formula.create'", (await prisma.auditLog.count({ where: { action: "admission_formula.create" } })) === 1);
  await shot(ap, "tinh-diem-admin");

  // ───────────── Khách / học sinh
  section("Công cụ ở /diem-chuan: tính đúng, giải thích từng bước, lưu ý tham khảo luôn hiện");
  const cg = await ctxFor(null, { width: 1280, height: 900 });
  const gp = await cg.newPage(); watch(gp);
  const posts: string[] = [];
  gp.on("request", r => { if (r.method() !== "GET" && r.method() !== "HEAD") posts.push(`${r.method()} ${r.url()}`); });
  await gp.goto(`${BASE}/diem-chuan`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await gp.locator("[data-score-calc]").waitFor({ timeout: 120000 });
  const calc = gp.locator("[data-score-calc]");
  check("công cụ hiện, có lưu ý thường trực 'Chỉ mang tính tham khảo… KiN không lưu điểm bạn nhập' TRƯỚC khi tính", /Chỉ mang tính tham khảo/.test(await calc.locator("[data-calc-disclaimer]").innerText()) && /không lưu điểm bạn nhập/.test(await calc.locator("[data-calc-disclaimer]").innerText()));
  check("hiện cách tính bằng chữ, nguồn có link mở tab mới, và nhãn 'Chưa đối chiếu với thông báo của trường'", /Cách tính: \(Toán × 2 \+ Lý \+ Hoá\) × 0,75 \+ Điểm ưu tiên/.test(await calc.locator("[data-calc-how]").innerText()) && (await calc.getByRole("link", { name: /example\.edu\.vn/ }).getAttribute("target")) === "_blank" && await calc.locator("[data-calc-unverified]").isVisible());
  check("chỉ MỘT công thức → không có ô chọn công thức", (await calc.locator("#tc-sel").count()) === 0);
  await calc.getByRole("button", { name: "Tính điểm" }).click();
  check("bấm Tính khi chưa nhập gì → báo lỗi từng ô (aria-invalid) 'Chưa nhập điểm Toán / Lý / Hoá', KHÔNG có kết quả", (await calc.locator("[aria-invalid=true]").count()) === 3 && /Chưa nhập điểm Toán/.test(await calc.innerText()) && (await calc.locator("[data-calc-result]").count()) === 0);
  check("ô điểm cộng (không bắt buộc) không bị báo lỗi khi bỏ trống", (await calc.locator("#tc-b1").getAttribute("aria-invalid")) === null);
  await calc.locator("#tc-m1").fill("11"); await calc.locator("#tc-m2").fill("tám"); await calc.locator("#tc-m3").fill("-1");
  await calc.getByRole("button", { name: "Tính điểm" }).click();
  const t = await calc.innerText();
  check("11 (quá 10), chữ, số âm → ba lỗi riêng: 'phải từ 0 đến 10' / 'phải là số'", /Điểm Toán phải từ 0 đến 10/.test(t) && /Điểm Lý phải là số/.test(t) && /Điểm Hoá phải/.test(t) && (await calc.locator("[data-calc-result]").count()) === 0, t);
  await calc.locator("#tc-m1").fill("8,5"); await calc.locator("#tc-m2").fill("7.25"); await calc.locator("#tc-m3").fill("9");
  await calc.getByRole("button", { name: "Tính điểm" }).click();
  const res = calc.locator("[data-calc-result]");
  await res.waitFor({ timeout: 15000 });
  const rt = await res.innerText();
  check("Toán 8,5 + Lý 7,25 (dấu chấm cũng được) + Hoá 9 → 24,94 / 30", /24,94/.test(rt) && /\/ 30/.test(rt), rt);
  check("lời giải từng bước: 'Toán: 8,5 × 2 = 17', 'Tổng có hệ số: 33,25 × 0,75 = 24,94' (làm tròn 2 chữ số)", /Toán: 8,5 × 2 = 17/.test(rt) && /Tổng có hệ số: 33,25 × 0,75 = 24,94/.test(rt), rt);
  check("kết quả KÈM câu lưu ý đầy đủ: chỉ mang tính tham khảo, đối chiếu thông báo chính thức của trường", /chỉ mang tính tham khảo/.test(await res.locator("[data-calc-result-note]").innerText()) && /đối chiếu với thông báo chính thức của trường/.test(await res.locator("[data-calc-result-note]").innerText()));
  check("KHÔNG có yêu cầu ghi (POST/PUT/PATCH) nào gửi lên máy chủ khi tính — điểm chỉ tính ở trình duyệt", posts.length === 0, posts);
  await calc.locator("#tc-b1").fill("0,5");
  check("đổi một ô thì kết quả cũ biến mất (không để số cũ cạnh dữ liệu mới)", (await calc.locator("[data-calc-result]").count()) === 0);
  await calc.getByRole("button", { name: "Tính điểm" }).click();
  await res.waitFor({ timeout: 15000 });
  check("thêm điểm ưu tiên 0,5 → 25,44 và dòng 'Điểm ưu tiên: +0,5'", /25,44/.test(await res.innerText()) && /Điểm ưu tiên: \+0,5/.test(await res.innerText()));
  await calc.locator("#tc-m1").fill("10"); await calc.locator("#tc-m2").fill("10"); await calc.locator("#tc-m3").fill("10"); await calc.locator("#tc-b1").fill("2,75");
  await calc.getByRole("button", { name: "Tính điểm" }).click();
  await res.waitFor({ timeout: 15000 });
  check("vượt thang (32,75) → kẹp 30 và NÓI RÕ 'Theo công thức được 32,75, vượt thang nên hiện ở mức tối đa 30'", /30\s*\/ 30/.test(await res.innerText()) && /32,75/.test(await res.innerText()) && /vượt thang/.test(await res.innerText()), await res.innerText());
  await calc.getByRole("button", { name: "Xoá nhập" }).click();
  check("'Xoá nhập' xoá hết ô và kết quả", (await calc.locator("#tc-m1").inputValue()) === "" && (await calc.locator("[data-calc-result]").count()) === 0);
  await shot(gp, "tinh-diem-public");
  check("bảng điểm chuẩn bên dưới vẫn hiện như cũ (không bị công cụ làm hỏng)", await gp.getByRole("heading", { level: 1, name: /điểm chuẩn/i }).isVisible() && await gp.locator("#dc-q").isVisible());

  // ───────────── Nhiều công thức, bản nháp, đã đối chiếu
  section("Nhiều công thức: chọn được, bản nháp không lộ, công thức đã đối chiếu không còn nhãn 'chưa đối chiếu'");
  const mk = (name: string, o: Partial<{ published: boolean; verified: boolean; sourceUrl: string }> = {}) => prisma.admissionFormula.create({ data: {
    name, school: "Trường B", year: 2026, scale: 30, inputs: [{ key: "m1", label: "Toán", max: 10, weight: 1 }, { key: "m2", label: "Văn", max: 10, weight: 1 }, { key: "m3", label: "Anh", max: 10, weight: 1 }], multiplier: 1, bonuses: [],
    sourceUrl: o.sourceUrl ?? "https://truong-b.edu.vn/tb", sourceName: "truong-b.edu.vn", verified: o.verified ?? false, published: o.published ?? true } });
  await mk("Tổng 3 môn D01", { verified: true });
  await mk("Công thức nháp (chưa công khai)", { published: false });
  await mk("Công thức mất nguồn", { sourceUrl: "" });
  await gp.reload({ waitUntil: "domcontentloaded" });
  await gp.locator("[data-score-calc]").waitFor({ timeout: 120000 });
  const opts = await gp.locator("#tc-sel option").allInnerTexts();
  check("ô chọn công thức chỉ có 2 mục công khai có nguồn (không có bản nháp, không có công thức mất nguồn)", opts.length === 2 && opts.some(o => /Khối A00/.test(o)) && opts.some(o => /Tổng 3 môn D01/.test(o)) && !opts.some(o => /nháp|mất nguồn/.test(o)), opts);
  await gp.selectOption("#tc-sel", { label: opts.find(o => /D01/.test(o))! });
  await gp.locator("#tc-m1").waitFor({ timeout: 15000 });
  check("chọn D01: ô nhập đổi theo công thức (Toán, Văn, Anh), công thức đã đối chiếu KHÔNG còn nhãn 'Chưa đối chiếu', ô nhập cũ được xoá", (await gp.locator("[data-score-calc] label").allInnerTexts()).some(x => /Văn/.test(x)) && (await gp.locator("[data-calc-unverified]").count()) === 0 && (await gp.locator("#tc-m1").inputValue()) === "");
  await gp.fill("#tc-m1", "9"); await gp.fill("#tc-m2", "8"); await gp.fill("#tc-m3", "7,5");
  await gp.getByRole("button", { name: "Tính điểm" }).click();
  await gp.locator("[data-calc-result]").waitFor({ timeout: 15000 });
  check("D01: 9 + 8 + 7,5 = 24,5 / 30", /24,5/.test(await gp.locator("[data-calc-result]").innerText()));
  await cg.close();

  // ───────────── Quản trị: bật/tắt, sửa, xoá
  section("Quản trị: bật-tắt công khai & đối chiếu, sửa, xoá có hộp xác nhận");
  await ap.reload({ waitUntil: "domcontentloaded" });
  await ap.locator("[data-formula-row]").first().waitFor({ timeout: 120000 });
  const rowA = ap.locator("[data-formula-row]", { hasText: "Khối A00" });
  await rowA.getByRole("switch", { name: /Đã đối chiếu/ }).click();
  await eventually("bật 'Đã đối chiếu' → cơ sở dữ liệu verified = true", async () => (await prisma.admissionFormula.findFirstOrThrow({ where: { name: { contains: "A00" } } })).verified === true, 15000);
  await rowA.getByRole("switch", { name: /Công khai/ }).click();
  await eventually("tắt 'Công khai' → thành bản nháp trong cơ sở dữ liệu", async () => (await prisma.admissionFormula.findFirstOrThrow({ where: { name: { contains: "A00" } } })).published === false, 15000);
  const pubNow = await ctxFor(null, { width: 1280, height: 900 });
  const pp = await pubNow.newPage(); watch(pp);
  await pp.goto(`${BASE}/diem-chuan`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await pp.locator("[data-score-calc]").waitFor({ timeout: 120000 });
  check("khách mở lại: công thức vừa tắt biến mất khỏi ô chọn (chỉ còn D01, nên không còn ô chọn)", (await pp.locator("#tc-sel").count()) === 0 && !/Khối A00/.test(await pp.locator("[data-score-calc]").innerText()));
  await pubNow.close();
  await rowA.getByRole("switch", { name: /Công khai/ }).click();
  await eventually("bật lại 'Công khai' (đã có nguồn) → lại công khai", async () => (await prisma.admissionFormula.findFirstOrThrow({ where: { name: { contains: "A00" } } })).published === true, 15000);
  await rowA.getByRole("button", { name: /^Sửa/ }).click();
  await ap.locator("[data-formula-form]").waitFor({ timeout: 30000 });
  check("form sửa điền sẵn: tên, thang 30, hệ số nhân '0,75', 3 môn, 1 khoản cộng", (await ap.inputValue("#ct-name")).includes("A00") && (await ap.inputValue("#ct-scale")) === "30" && (await ap.inputValue("#ct-mul")) === "0,75" && (await ap.locator("[data-subject-row]").count()) === 3 && (await ap.locator("[data-bonus-row]").count()) === 1);
  await ap.fill("#ct-name", "Khối A00 (đổi tên)");
  await ap.locator("[data-formula-form]").getByRole("button", { name: "Lưu" }).click();
  await eventually("sửa xong: tên mới hiện trong danh sách, vẫn 1 bản ghi A00 (không nhân đôi)", async () => (await ap.locator("[data-formula-row]", { hasText: "Khối A00 (đổi tên)" }).count()) === 1 && (await prisma.admissionFormula.count({ where: { name: { contains: "A00" } } })) === 1, 20000);
  const before = await prisma.admissionFormula.count();
  await ap.locator("[data-formula-row]", { hasText: "Công thức nháp" }).getByRole("button", { name: /^Xoá/ }).click();
  await ap.getByRole("button", { name: "Giữ lại" }).click();
  check("hộp xác nhận: 'Giữ lại' thì không xoá", (await prisma.admissionFormula.count()) === before);
  await ap.locator("[data-formula-row]", { hasText: "Công thức nháp" }).getByRole("button", { name: /^Xoá/ }).click();
  await ap.getByRole("button", { name: "Xoá", exact: true }).last().click();
  await eventually("xác nhận Xoá → bản ghi mất, nhật ký ghi 'admission_formula.delete'", async () => (await prisma.admissionFormula.count()) === before - 1 && (await prisma.auditLog.count({ where: { action: "admission_formula.delete" } })) === 1, 20000);
  check("quyền: học sinh không đọc / ghi được API quản trị công thức", [401, 403].includes((await api("GET", "/api/admin/diem-chuan/cong-thuc", { as: S })).status) && [401, 403].includes((await api("POST", "/api/admin/diem-chuan/cong-thuc", { as: S, body: { name: "x" } })).status));
  await ca.close();

  // ───────────── 390px
  section("Điện thoại 390px");
  const cm = await ctxFor(null, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
  await pm.goto(`${BASE}/diem-chuan`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await pm.locator("[data-score-calc]").waitFor({ timeout: 120000 });
  await pm.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  check("công cụ ở 390px: không tràn ngang", (await overflow(pm)) <= 0, await overflow(pm));
  const small = await pm.evaluate(`[...document.querySelectorAll('[data-score-calc] a, [data-score-calc] button, [data-score-calc] input, [data-score-calc] select')].filter(e => e.offsetParent && e.getBoundingClientRect().width > 0).map(e => [Math.round(e.getBoundingClientRect().height), (e.textContent || e.id || '').trim().slice(0, 24)]).filter(([h]) => h < 44)`) as [number, string][];
  check("mọi ô nhập, nút, ô chọn trong công cụ cao ≥ 44px", small.length === 0, small.slice(0, 5));
  await shot(pm, "tinh-diem-390");
  await cm.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
