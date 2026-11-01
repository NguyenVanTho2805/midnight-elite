// NC2-035 — toast "Đã tạo khoá học mới" (?moi=1) chỉ hiện MỘT lần: xong là xoá tham số, F5 không báo lại.
import { BASE, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const c = await mkCourse(T.id, { name: "Toán 9 thử" });
  await launch();
  const errors: string[] = [];
  const ctx = await ctxFor(T, { width: 1280, height: 800 });
  const pg = await ctx.newPage();
  pg.on("pageerror", e => errors.push(String(e)));
  const TOAST = "Đã tạo khoá học mới";
  const url = `${BASE}/lop-cua-toi/quan-lop/${c.id}?tab=lich-hoc&moi=1`; // BU-00 bước 3: gia sư ở bí danh của /admin/khoa-hoc/[id]
  // Toast chỉ sống 3 giây (useAdminToast) mà trang quản khoá còn gọi mạng lâu hơn thế: đừng chờ networkidle TRƯỚC khi tìm toast
  // (lần chạy 23/10: 7/7 rồi 6/7 trên cùng mã). Tìm toast ngay từ lúc DOM tải xong, chờ tối đa `ms`.
  const toastShown = (ms: number) => pg.getByText(TOAST).first().waitFor({ timeout: ms }).then(() => true, () => false);

  // Làm nóng trang (chưa có moi=1): lần mở đầu của `next dev` biên dịch rồi có thể tải lại trang đang mở, làm toast biến mất.
  await pg.goto(`${BASE}/lop-cua-toi/quan-lop/${c.id}?tab=lich-hoc`, { waitUntil: "networkidle", timeout: 150000 });

  section("Vừa tạo lớp: toast hiện một lần, tham số bị xoá khỏi URL");
  await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("toast hiện", await toastShown(30000));
  await pg.waitForFunction(() => !location.search.includes("moi="), null, { timeout: 15000 }).catch(() => {});
  const u1 = new URL(pg.url());
  check("URL không còn moi=1", !u1.searchParams.has("moi"), pg.url());
  check("vẫn giữ nguyên trang lớp và tab Lịch học", u1.pathname === `/lop-cua-toi/quan-lop/${c.id}` && u1.searchParams.get("tab") === "lich-hoc", pg.url());

  section("F5: không báo lại");
  await pg.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  // Bản lỗi (báo lại sau F5) sẽ hiện toast ngay sau khi trang gắn kết, trong vài giây: chờ 6 giây, không thấy mới tính là "không báo lại".
  check("sau F5: không toast (chờ 6 giây)", !(await toastShown(6000)));
  await pg.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  check("sau F5: URL vẫn sạch", !new URL(pg.url()).searchParams.has("moi"), pg.url());

  section("Đối chứng: mở lại ?moi=1 lần nữa (vừa tạo lớp khác) vẫn báo");
  await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("lần mở mới có moi=1 → toast hiện lại", await toastShown(30000));
  check("không lỗi script trang", errors.length === 0, errors);
  await closeAll();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
