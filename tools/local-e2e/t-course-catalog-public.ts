// CAT-01 — /khoa-hoc phía máy chủ (cần máy chủ test, COO chạy): HTML thô (không chạy JS) đã có khoá học đã lọc; khoá ẩn không lộ; không rò link nội bộ / sĩ số.
import { mkTutor, mkUser, mkCourse, wipe, check, section, done, BASE } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan Công Khai");
  const open = await mkCourse(T.id, { name: "Toán HSA mở", capacity: 4 });
  const full = await mkCourse(T.id, { name: "Lý HSA đầy", capacity: 1 });
  const closed = await mkCourse(T.id, { name: "Hoá HCM đóng", classStatus: "closed" });
  const hidden = await mkCourse(T.id, { name: "Khoá ẩn bí mật" });
  await prisma.course.update({ where: { id: open.id }, data: { category: "ĐGNL HSA", price: 900000, zaloGroupLink: "https://zalo.me/g/BI-MAT-ZALO" } });
  await prisma.course.update({ where: { id: full.id }, data: { category: "ĐGNL HSA", price: 0 } });
  await prisma.course.update({ where: { id: closed.id }, data: { category: "ĐGNL HCM" } });
  await prisma.course.update({ where: { id: hidden.id }, data: { category: "ĐGNL HSA", status: false } });
  const kid = await mkUser({ name: "Học sinh Không Lộ Tên" });
  await prisma.enrollment.create({ data: { userId: kid.id, courseId: full.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: (await mkUser({ name: "Chờ Phụ Huynh" })).id, courseId: open.id, status: "pending_consent" } });
  await prisma.courseCategory.upsert({ where: { name: "ĐGNL HCM" }, update: { sortOrder: 1 }, create: { name: "ĐGNL HCM", slug: "dgnl-hcm", sortOrder: 1 } });
  await prisma.courseCategory.upsert({ where: { name: "ĐGNL HSA" }, update: { sortOrder: 2 }, create: { name: "ĐGNL HSA", slug: "dgnl-hsa", sortOrder: 2 } });

  const html = async (qs = "") => (await (await fetch(`${BASE}/khoa-hoc${qs}`)).text()).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!-- -->/g, "");

  section("SEO: HTML thô đã có khoá");
  const all = await html();
  check("có tên 3 khoá công khai", ["Toán HSA mở", "Lý HSA đầy", "Hoá HCM đóng"].every(n => all.includes(n)));
  check("khoá ẩn KHÔNG xuất hiện", !all.includes("Khoá ẩn bí mật"));
  check("liên kết thật tới trang khoá", all.includes(`href="/khoa-hoc/${open.id}"`));
  check("chỗ: 'Chỉ còn 4 chỗ' (chờ phụ huynh không chiếm chỗ), 'Đã đầy', 'Đã đóng nhận học viên'", all.includes("Chỉ còn 4 chỗ") && all.includes("Đã đầy") && all.includes("Đã đóng nhận học viên"));
  check("giá 0 → 'Miễn phí'; có giá hiện 900.000", all.includes("Miễn phí") && /900\.000/.test(all));

  section("Lọc theo URL bằng TÊN danh mục");
  const hcm = await html(`?category=${encodeURIComponent("ĐGNL HCM")}`);
  check("?category=ĐGNL HCM chỉ còn khoá HCM trong lưới", hcm.includes("Hoá HCM đóng") && !hcm.includes("Toán HSA mở") && !hcm.includes("Lý HSA đầy"));
  const ky = await html(`?kythi=${encodeURIComponent("ĐGNL HSA")}`);
  check("?kythi= (bí danh) lọc như category", ky.includes("Toán HSA mở") && !ky.includes("Hoá HCM đóng"));
  const none = await html("?category=Khong%20co");
  check("danh mục lạ → trang vẫn 200 và báo không có khoá phù hợp", none.includes("Không có khoá học phù hợp"));
  const free = await html("?gia=free&concho=1");
  check("miễn phí + còn chỗ: lớp đầy bị loại", !free.includes("Lý HSA đầy") && !free.includes("Toán HSA mở"));

  section("Không rò dữ liệu");
  check("không lộ link Zalo nội bộ", !all.includes("BI-MAT-ZALO"));
  check("không lộ tên học sinh", !all.includes("Học sinh Không Lộ Tên") && !all.includes("Chờ Phụ Huynh"));
  check("không lộ sức chứa / số đang học trong HTML (capacity, enrolled)", !/"capacity"|"enrolled"/i.test(all));

  section("Thứ tự chip theo sortOrder (CAT-02)");
  const pos = (s: string) => all.indexOf(`data-chip="${s}"`);
  check("ĐGNL HCM (1) đứng trước ĐGNL HSA (2)", pos("ĐGNL HCM") > 0 && pos("ĐGNL HCM") < pos("ĐGNL HSA"), [pos("ĐGNL HCM"), pos("ĐGNL HSA")]);

  await done();
})();
