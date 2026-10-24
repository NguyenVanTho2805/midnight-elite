// HP-28 — giao diện tab Phiếu: dòng "Gợi ý: có thể thu thêm phí trễ hạn — KiN không tự cộng tiền" chỉ trên phiếu QUÁ HẠN còn nợ; tắt/bật;
// số tiền trên phiếu không đổi; 390px không tràn ngang.
import { mkUser, mkTutor, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S1 = await mkUser({ name: "Trần Gia Bảo" }), S2 = await mkUser({ name: "Lê Minh Khang" });
  const today = vnDateKeyOf(new Date()), ym = today.slice(0, 7);
  const mk = (studentId: string, dueDate: string | null) => prisma.tuitionInvoice.create({ data: { code: `KINH${Math.random().toString(36).slice(2, 6).toUpperCase()}`, tutorId: T.id, studentId, yearMonth: ym, amountDue: 560_000, status: "sent", dueDate } });
  await mk(S1.id, addDaysKey(today, -3));
  await mk(S2.id, addDaysKey(today, 6));

  await launch();
  const ctx = await ctxFor(T, { width: 390, height: 844 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|font|Failed to load resource|vietqr/i.test(m.text())) errors.push(m.text()); });

  section("Gợi ý trên phiếu quá hạn");
  await page.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("tab", { name: "Phiếu" }).click();
  await page.getByText("Trần Gia Bảo").waitFor({ timeout: 90000 });
  const hints = page.locator("[data-late-fee-hint]");
  check("đúng MỘT gợi ý (phiếu quá hạn); phiếu chưa tới hạn không có", (await hints.count()) === 1);
  check("chữ gợi ý đúng câu và nói KiN không tự cộng", (await hints.first().innerText()) === "Gợi ý: có thể thu thêm phí trễ hạn — KiN không tự cộng tiền.");
  check("gợi ý nằm trong đúng thẻ của Trần Gia Bảo", (await page.locator("li", { hasText: "Trần Gia Bảo" }).locator("[data-late-fee-hint]").count()) === 1 && (await page.locator("li", { hasText: "Lê Minh Khang" }).locator("[data-late-fee-hint]").count()) === 0);
  check("số còn lại vẫn 560.000đ, không bị cộng thêm", (await page.locator("li", { hasText: "Trần Gia Bảo" }).innerText()).includes("560.000"));

  section("Tắt / bật");
  const toggle = page.getByLabel(/Hiện gợi ý phí trễ hạn/);
  check("ô bật/tắt có chữ nói rõ chỉ là gợi ý", await toggle.isChecked());
  await toggle.uncheck();
  await page.waitForFunction(() => document.querySelectorAll("[data-late-fee-hint]").length === 0, null, { timeout: 30000 });
  check("tắt → gợi ý biến mất; DB lưu cờ '0'", (await prisma.settingKV.findFirst({ where: { key: { endsWith: T.id } } }))?.value === "0");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Phiếu" }).click();
  await page.getByText("Trần Gia Bảo").waitFor({ timeout: 60000 });
  check("tải lại trang vẫn tắt", (await hints.count()) === 0 && !(await page.getByLabel(/Hiện gợi ý phí trễ hạn/).isChecked()));
  await page.getByLabel(/Hiện gợi ý phí trễ hạn/).check();
  await page.waitForFunction(() => document.querySelectorAll("[data-late-fee-hint]").length === 1, null, { timeout: 30000 });
  check("bật lại → gợi ý trở lại", true);

  section("390px");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const box = await page.getByLabel(/Hiện gợi ý phí trễ hạn/).locator("xpath=ancestor::label").boundingBox();
  check("không tràn ngang; hàng bật/tắt cao ≥ 44px", overflow <= 0 && !!box && box.height >= 44, { overflow, h: box?.height });
  section("1440px");
  const wctx = await ctxFor(T, { width: 1440, height: 900 });
  const wp = await wctx.newPage();
  await wp.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await wp.getByRole("tab", { name: "Phiếu" }).click();
  await wp.getByText("Trần Gia Bảo").waitFor({ timeout: 90000 });
  check("1440px: gợi ý hiện đúng một dòng, không tràn ngang", (await wp.locator("[data-late-fee-hint]").count()) === 1 && (await wp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  check("không lỗi trình duyệt", errors.length === 0, errors);
  await closeAll();
  await done();
})();
