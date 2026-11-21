// SCL-F2 — một cửa tạo lớp (API + cổng trang). Cần máy chủ thử (BASE). Bài gọi wipe(): chỉ dùng DB riêng của worktree.
//  • Chủ nhiệm (admin_super) mở được /lop-cua-toi/lop/tao (TaoLop) — trước đây bị đẩy đi; học sinh vẫn bị đẩy đi.
//  • POST /api/courses: mã trùng → tự thêm hậu tố cho CẢ quản trị (không còn ô slug để sửa); gia sư như cũ.
//  • P2-18: wizard gửi requireSchedule + 0 khung + noFixedSchedule → 201, 0 khung; thiếu noFixedSchedule vẫn 400 (luật máy chủ không nới).
// Ca phá cố ý đã thử: bỏ `allowAdmin` ở lop/tao/page.tsx → ca "Chủ nhiệm mở được" đỏ; trả điều kiện `&& auth.adminRole === "teacher"` ở route → ca hậu tố quản trị đỏ (409).
import { api, mkSuper, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const body = (name: string, extra: Record<string, unknown> = {}) => ({ id: "lop-trung-f2", name, adminName: name, shortTitle: name, category: "Toán · Lớp 9", openDate: "21/11/2026", types: ["Video"], bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", joinPolicy: "approve", price: 0, lessons: 0, hours: 0, status: false, ...extra });

(async () => {
  await wipe();
  const SA = await mkSuper("Chủ nhiệm F2"), T = await mkTutor("Cô F2"), S = await mkUser({ name: "Em F2" });

  section("Cổng trang tạo lớp");
  const pa = await api("GET", "/lop-cua-toi/lop/tao", { as: SA });
  check("Chủ nhiệm mở được /lop-cua-toi/lop/tao (200, có form 'Tạo lớp')", pa.status === 200 && pa.text.includes("Tạo lớp"), pa.status);
  const pt = await api("GET", "/lop-cua-toi/lop/tao", { as: T });
  check("gia sư mở được như cũ", pt.status === 200, pt.status);
  const ps = await api("GET", "/lop-cua-toi/lop/tao", { as: S });
  // Trang có loading.tsx ⇒ redirect() có thể tới sau khi đã gửi 200 (chuyển ở máy khách) — kiểm theo NỘI DUNG: học sinh không nhận form tạo lớp.
  check("học sinh vẫn bị chuyển đi (không có form tạo lớp)", ps.status === 307 || (!ps.text.includes('aria-label="Tạo lớp"') && ps.text.includes("NEXT_REDIRECT")), ps.status);

  section("POST /api/courses — mã trùng");
  const a1 = await api("POST", "/api/courses", { as: SA, body: body("Lớp trùng A") });
  const a2 = await api("POST", "/api/courses", { as: SA, body: body("Lớp trùng B") });
  check("quản trị tạo 2 lớp cùng mã → 201 cả hai, lần hai thành '-2'", a1.status === 201 && a2.status === 201 && a1.json?.id === "lop-trung-f2" && a2.json?.id === "lop-trung-f2-2", [a1.status, a2.status, a2.json?.id]);
  check("quản trị không gửi tên gia sư (TaoLop) → instructor 'KiN', không lỗi thiếu trường", a1.json?.instructor === "KiN", a1.json?.instructor);
  const t1 = await api("POST", "/api/courses", { as: T, body: body("Lớp trùng C") });
  check("gia sư trùng tiếp → '-3' (như cũ)", t1.status === 201 && t1.json?.id === "lop-trung-f2-3", [t1.status, t1.json?.id]);

  section("P2-18 — lịch tuỳ chọn");
  const n1 = await api("POST", "/api/courses", { as: T, body: body("Không lịch", { id: "khong-lich-f2", schedules: [], requireSchedule: true, noFixedSchedule: true }) });
  check("0 khung + noFixedSchedule → 201, 0 khung giờ", n1.status === 201 && (await prisma.classSchedule.count({ where: { courseId: "khong-lich-f2" } })) === 0, n1.status);
  const n2 = await api("POST", "/api/courses", { as: T, body: body("Thiếu cờ", { id: "thieu-co-f2", schedules: [], requireSchedule: true }) });
  check("0 khung, KHÔNG noFixedSchedule → 400 schedule_required (máy chủ không nới)", n2.status === 400 && n2.json?.code === "schedule_required", n2.status);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
