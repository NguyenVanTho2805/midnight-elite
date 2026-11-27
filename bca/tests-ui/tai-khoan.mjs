// Nhóm TÀI KHOẢN (T55): chủ thêm giáo viên, sửa môn, khoá/mở khoá; chủ duy nhất không khoá được; GV không vào được.
import { test, chay, ok, bang, W, moTrang, khongTranNgang } from "./lib.mjs";

const N = "Tài khoản";

for (const kich of [W.dt, W.mt]) {
  test(N, `Chủ thêm giáo viên (Gmail, tên, môn) → hiện trong danh sách; GV mới đăng nhập được với đúng môn (${kich.width})`, async (t) => {
    const { page } = await t.trang("chu", kich);
    await moTrang(page, "/quan-ly/tai-khoan");
    await page.getByRole("heading", { name: "Thêm giáo viên" }).waitFor();
    const gmail = `gv.moi.${kich.width}@bca.invalid`;
    await page.getByLabel("Gmail").fill(gmail);
    await page.getByLabel("Tên hiển thị").first().fill(`Cô Mới ${kich.width}`);
    await page.locator("form").filter({ hasText: "Thêm giáo viên" }).getByText("Sử", { exact: true }).click();
    await page.getByRole("button", { name: "Thêm giáo viên" }).click();
    await page.getByRole("status").filter({ hasText: `Đã thêm Cô Mới ${kich.width}` }).waitFor();
    const the = page.getByRole("listitem").filter({ hasText: gmail });
    await the.waitFor();
    ok((await the.textContent()).includes("Môn: Sử"), "Thẻ GV mới không ghi môn Sử");
    await khongTranNgang(page, "/quan-ly/tai-khoan");
    await t.chup(page, `tai-khoan-${kich.width}`);
  });
}

test(N, "Gmail gõ nhầm đuôi → báo gợi ý; Gmail đã có → báo trùng", async (t) => {
  const { page } = await t.trang("chu", W.dt);
  t.choPhepConsole(/status of 40[09]/);
  await moTrang(page, "/quan-ly/tai-khoan");
  await page.getByLabel("Gmail").fill("co.hoa@gamil.com");
  await page.getByLabel("Tên hiển thị").first().fill("Cô Hoa");
  await page.getByRole("button", { name: "Thêm giáo viên" }).click();
  await page.locator("main [role=alert]").filter({ hasText: "co.hoa@gmail.com" }).waitFor();
  await page.getByLabel("Gmail").fill("GV.Toan@bca.invalid");
  await page.getByRole("button", { name: "Thêm giáo viên" }).click();
  await page.locator("main [role=alert]").filter({ hasText: "đã có tài khoản" }).waitFor();
});

test(N, "Sửa môn GV Anh → Anh + Địa; khoá → 'Đã khoá' và GV bị đăng xuất; mở khoá", async (t) => {
  const gv = await t.api("gv_anh");
  bang((await gv.get("/api/toi")).status, 200, "GV Anh chưa vào được trước khi khoá");
  const { page } = await t.trang("chu", W.mt);
  await moTrang(page, "/quan-ly/tai-khoan");
  const the = page.getByRole("listitem").filter({ hasText: "gv.anh@bca.invalid" });
  await the.getByRole("button", { name: "Sửa tên / môn" }).click();
  await the.getByText("Địa", { exact: true }).click();
  await the.getByRole("button", { name: "Lưu" }).click();
  await the.getByText("Môn: Anh, Địa").waitFor();
  await the.getByRole("button", { name: "Khoá…" }).click();
  await the.getByRole("button", { name: "Khoá tài khoản" }).click();
  await the.getByText("Đã khoá", { exact: true }).waitFor();
  bang((await gv.get("/api/toi")).status, 401, "GV vẫn còn phiên sau khi bị khoá");
  await the.getByRole("button", { name: "Mở khoá" }).click();
  await the.getByRole("button", { name: "Khoá…" }).waitFor();
});

test(N, "Chủ duy nhất: thẻ của mình ghi 'không khoá được', không có nút Khoá", async (t) => {
  const { page } = await t.trang("chu", W.dt);
  await moTrang(page, "/quan-ly/tai-khoan");
  const the = page.getByRole("listitem").filter({ hasText: "(bạn)" });
  await the.getByText("Chủ lớp duy nhất — không khoá được").waitFor();
  bang(await the.getByRole("button", { name: "Khoá…" }).count(), 0, "Chủ duy nhất vẫn có nút Khoá");
});

test(N, "Điện thoại: mục Thêm có 'Tài khoản giáo viên'; GV mở /quan-ly/tai-khoan → Không có quyền, không lộ Gmail", async (t) => {
  const { page } = await t.trang("chu", W.dt);
  await moTrang(page, "/quan-ly");
  await page.getByRole("button", { name: /^Thêm/ }).click();
  await page.getByRole("link", { name: "Tài khoản giáo viên" }).click();
  await page.waitForURL(/\/quan-ly\/tai-khoan/);
  const g = await t.trang("gv_toan", W.dt);
  await moTrang(g.page, "/quan-ly/tai-khoan");
  await g.page.getByRole("heading", { name: "Không có quyền" }).waitFor();
  ok(!(await g.page.content()).includes("chu.thu@bca.invalid"), "Trang lộ Gmail chủ cho GV");
  bang(await g.page.getByRole("link", { name: "Tài khoản" }).count(), 0, "GV thấy mục Tài khoản ở thanh điều hướng");
});

await chay(N);
