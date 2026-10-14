// /thu-vien (Thư viện công khai) chỉ được liệt kê tài liệu của bài MIỄN PHÍ. Cờ isLocked không được dùng để quyết định công khai:
// nó là giá trị tĩnh, gia sư hay quên khoá, và API bài giảng đã bỏ qua nó. Từng lộ: bài trả phí có isLocked=false hiện tài liệu cho mọi người.
import { BASE, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const C = await mkCourse(T.id, { name: "Toán 9 công khai" });
  await prisma.course.update({ where: { id: C.id }, data: { status: true } });
  const sec = await prisma.section.create({ data: { id: "s-tv", title: "P", courseId: C.id } });
  const ch = await prisma.chapter.create({ data: { id: "c-tv", title: "C", sectionId: sec.id } });
  const mk = (id: string, title: string, isFree: boolean, isLocked: boolean, doc: string) =>
    prisma.lesson.create({ data: { id, code: id, title, type: "record", chapterId: ch.id, isFree, isLocked, documents: `${doc}|https://files.example/${id}.pdf` } });
  await mk("l-free", "Bài miễn phí", true, false, "TAI-LIEU-MIEN-PHI");
  await mk("l-free-locked", "Bài miễn phí (cờ khoá còn bật)", true, true, "TAI-LIEU-MIEN-PHI-2");
  await mk("l-paid-locked", "Bài trả phí đang khoá", false, true, "TAI-LIEU-TRA-PHI-KHOA");
  await mk("l-paid-open", "Bài trả phí, gia sư quên bật khoá", false, false, "TAI-LIEU-TRA-PHI-MO");

  section("/thu-vien chỉ liệt kê tài liệu của bài miễn phí");
  const html = await (await fetch(`${BASE}/thu-vien`)).text();
  check("trang mở được và có tên khoá công khai", html.includes("Toán 9 công khai"));
  check("tài liệu của bài MIỄN PHÍ có mặt", html.includes("TAI-LIEU-MIEN-PHI"));
  check("bài miễn phí dù cờ khoá còn bật vẫn có mặt (miễn phí quyết định, không phải cờ khoá)", html.includes("TAI-LIEU-MIEN-PHI-2"));
  check("tài liệu bài TRẢ PHÍ đang khoá không lộ", !html.includes("TAI-LIEU-TRA-PHI-KHOA") && !html.includes("l-paid-locked.pdf"));
  check("tài liệu bài TRẢ PHÍ mà gia sư quên bật khoá (isLocked=false) KHÔNG lộ — đây là lỗi đã sửa", !html.includes("TAI-LIEU-TRA-PHI-MO") && !html.includes("l-paid-open.pdf"));

  section("Khoá đóng không hiện");
  await prisma.course.update({ where: { id: C.id }, data: { status: false } });
  const html2 = await (await fetch(`${BASE}/thu-vien`)).text();
  check("khoá đã đóng (status=false) → không liệt kê dù bài miễn phí", !html2.includes("TAI-LIEU-MIEN-PHI") && html2.includes("Chưa có tài liệu công khai"));

  await done();
})();
