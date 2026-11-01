// BU-08 phần B — dải "N câu hỏi của khách chờ duyệt" + chip "Câu hỏi của khách". BỎ QUA có chữ khi BU-05 (#104) chưa gộp (không đếm xanh).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-community-guest.ts
import { mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll, ADMIN } from "./ui";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

(async () => {
  const threadFields = Object.keys((Prisma as any).ThreadScalarFieldEnum ?? {});
  const supported = threadFields.includes("status") && threadFields.includes("guestName");
  if (!supported) {
    console.log("BỎ QUA ui-admin-community-guest: chưa có Thread.status / Thread.guestName (BU-05 #104 chưa gộp). Không tính xanh.");
    process.exit(0);
  }
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const mk = (content: string) => (prisma.thread as any).create({ data: { content, category: "hoi-dap", status: "pending", guestName: "Khách thử" } });
  await mk("CAU_HOI_KHACH_1 làm sao giải phương trình?");
  await mk("CAU_HOI_KHACH_2 gọi tôi số 0912345678");

  await launch();
  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage();

  section("Dải ở /admin/cong-dong và chip ở hàng chờ");
  await pg.goto(`${ADMIN}/admin/cong-dong`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.getByText("2 câu hỏi của khách chờ duyệt").waitFor({ timeout: 120000 });
  check("dải '2 câu hỏi của khách chờ duyệt' + liên kết 'Mở hàng chờ' → ?loai=khach-hoi", await pg.getByRole("link", { name: "Mở hàng chờ" }).getAttribute("href") === "/admin/kiem-duyet?loai=khach-hoi");
  await pg.getByRole("link", { name: "Mở hàng chờ" }).click();
  await pg.waitForURL(/loai=khach-hoi/, { timeout: 60000 });
  await pg.locator("[data-queue-table]").waitFor({ timeout: 60000 });
  check("hàng chờ có chip 'Câu hỏi của khách 2' và 2 dòng", /Câu hỏi của khách 2/.test(await pg.locator('[data-chip="khach-hoi"]').innerText()) && await pg.locator("[data-queue-table] tbody tr").count() === 2);

  section("Câu hỏi có số điện thoại: bắt tick; không hàng loạt");
  await pg.locator("[data-queue-table] tbody tr").filter({ hasText: "CAU_HOI_KHACH_2" }).locator("[data-row-open]").click();
  const panel = pg.locator("aside[data-side-panel]");
  await panel.waitFor({ timeout: 30000 });
  await panel.getByRole("button", { name: "Duyệt" }).click();
  check("Duyệt khoá cho tới khi tick 'Đã xem, không lộ số điện thoại hoặc đường dẫn'", await panel.getByRole("button", { name: /^Xác nhận: Duyệt/ }).isDisabled());
  await panel.getByLabel(/không lộ số điện thoại/).check();
  await panel.getByRole("button", { name: /^Xác nhận: Duyệt/ }).click();
  await pg.waitForFunction(`document.querySelectorAll("[data-queue-table] tbody tr").length === 1`, null, { timeout: 60000 });
  check("duyệt xong: dòng biến mất; AuditLog community.guest_question.approve", await prisma.auditLog.count({ where: { action: "community.guest_question.approve" } }) === 1);
  await pg.getByLabel("Chọn tất cả các dòng đang hiện").check();
  check("câu hỏi của khách không bao giờ có lệnh hàng loạt", await pg.locator("[data-bulk-cmd]").count() === 0);
  await ctx.close();

  await closeAll();
  await done();
})();
