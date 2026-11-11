// LOI-03 — dữ liệu GIẢ cho "Lớp của tôi" kiểu thư viện, trang lớp (số chương, dòng phụ bài) và phiếu "Hôm nay có lớp".
// Học sinh chính (hocsinh@kin.local) học hai lớp của gia sư chính:
//   • "Toán 9 (LOI-03)": có ảnh bìa https, 2 chương × 3 bài Đã đăng + 1 bài NHÁP hẹn hôm nay (KHÔNG được hiện ở đâu cả).
//       Bài 1 hôm nay 19:30 VN (1 tài liệu + 1 link Azota + 1 bài tập nộp tệp) · Bài 2 hôm nay 23:30 VN (đang xem dở 120 giây) ·
//       Bài 4 ngày mai 00:30 VN · Bài 5 sau 3 ngày 19:30 VN · Bài 3, Bài 6 không gắn ngày.
//   • "Văn 9 (LOI-03)": không ảnh bìa, 2 bài, em đã hoàn thành đủ (để lọc "Hoàn thành").
// Chạy lặp lại được: upsert theo id cố định, `update: { scheduledAt }` dời các mốc giờ về NGÀY CHẠY (giờ VN).
import { addDaysKey, instantOf, vnDateKeyOf } from "@/lib/classSessions";
import { mkCourse } from "../h";
import type { MockFn } from "../mock-seed";

const TOAN = "Toán 9 (LOI-03)";
const VAN = "Văn 9 (LOI-03)";
const COVER = 'url("https://picsum.photos/seed/kin-loi03/640/360")';

const mock: MockFn = async ({ prisma, tutor, student }) => {
  const today = vnDateKeyOf(new Date());
  const at = (dayOffset: number, h: number, m: number) => instantOf(addDaysKey(today, dayOffset), h * 60 + m);

  const course = async (name: string, data: { bg?: string; category: string; instructor: string }) => {
    let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name } });
    if (!c) c = await mkCourse(tutor.id, { name });
    return prisma.course.update({ where: { id: c.id }, data });
  };
  const toan = await course(TOAN, { bg: COVER, category: "Toán", instructor: "Cô Lan (dữ liệu giả)" });
  const van = await course(VAN, { category: "Ngữ văn", instructor: "KiN" }); // "KiN" = tên giữ chỗ ⇒ thẻ không hiện dòng "Gia sư"

  const tree = async (courseId: string, tag: string, chapters: string[]) => {
    const sec = await prisma.section.upsert({ where: { id: `s-loi03-${tag}` }, update: {}, create: { id: `s-loi03-${tag}`, title: "Phần 1", courseId, order: 0 } });
    const ids: string[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const id = `ch-loi03-${tag}-${i + 1}`;
      await prisma.chapter.upsert({ where: { id }, update: {}, create: { id, title: chapters[i], sectionId: sec.id, order: i } });
      ids.push(id);
    }
    return ids;
  };
  type L = { id: string; title: string; chapterId: string; order: number; scheduledAt: Date | null; status?: string; documents?: string; azotaUrl?: string };
  const lesson = (l: L) => prisma.lesson.upsert({
    where: { id: l.id },
    update: { scheduledAt: l.scheduledAt },
    create: {
      id: l.id, code: l.id.slice(-10).toUpperCase(), title: l.title, type: "record", chapterId: l.chapterId, order: l.order, isLocked: true,
      status: l.status ?? "published", scheduledAt: l.scheduledAt, documents: l.documents ?? "[]", azotaUrl: l.azotaUrl ?? null,
    },
  });

  // Toán 9: 2 chương × 3 bài + 1 bài nháp hẹn hôm nay
  const [t1, t2] = await tree(toan.id, "toan", ["Căn bậc hai", "Hàm số bậc nhất"]);
  const T = (n: number) => `l-loi03-toan-${n}`;
  await lesson({ id: T(1), title: "Bài 1 · Căn bậc hai và hằng đẳng thức", chapterId: t1, order: 0, scheduledAt: at(0, 19, 30),
    documents: JSON.stringify([{ name: "Đề cương chương 1 (dữ liệu giả).pdf", url: "https://res.cloudinary.com/demo/image/upload/sample.pdf", type: "pdf" }]),
    azotaUrl: "https://azota.vn/de-thi/loi03-mock-1" });
  await lesson({ id: T(2), title: "Bài 2 · Liên hệ phép nhân và phép khai phương", chapterId: t1, order: 1, scheduledAt: at(0, 23, 30) });
  await lesson({ id: T(3), title: "Bài 3 · Biến đổi đơn giản biểu thức chứa căn", chapterId: t1, order: 2, scheduledAt: null });
  await lesson({ id: T(4), title: "Bài 4 · Nhắc lại khái niệm hàm số", chapterId: t2, order: 0, scheduledAt: at(1, 0, 30) });
  await lesson({ id: T(5), title: "Bài 5 · Hàm số bậc nhất", chapterId: t2, order: 1, scheduledAt: at(3, 19, 30) });
  await lesson({ id: T(6), title: "Bài 6 · Đồ thị hàm số y = ax + b", chapterId: t2, order: 2, scheduledAt: null });
  await lesson({ id: "l-loi03-toan-nhap", title: "Bài nháp chưa đăng (KHÔNG được hiện)", chapterId: t2, order: 3, scheduledAt: at(0, 20, 0), status: "draft" });

  const asgId = "asg-loi03-toan-1";
  await prisma.assignment.upsert({ where: { id: asgId }, update: {}, create: {
    id: asgId, lessonId: T(1), title: "Phiếu bài tập căn bậc hai (dữ liệu giả)", instructions: "Làm bài ra giấy, chụp hoặc xuất PDF rồi nộp.", maxPoints: 10,
    dueDate: at(2, 21, 0), ownerId: tutor.id, mode: "file",
  } });

  // Văn 9: 2 bài, em đã hoàn thành đủ
  const [v1] = await tree(van.id, "van", ["Truyện ngắn hiện đại"]);
  await lesson({ id: "l-loi03-van-1", title: "Bài 1 · Làng (Kim Lân)", chapterId: v1, order: 0, scheduledAt: null });
  await lesson({ id: "l-loi03-van-2", title: "Bài 2 · Chiếc lược ngà", chapterId: v1, order: 1, scheduledAt: null });

  for (const c of [toan, van]) {
    await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: c.id } }, update: { status: "active" }, create: { userId: student.id, courseId: c.id, status: "active" } });
  }
  const prog = (lessonId: string, completed: boolean, watchedSeconds: number) => prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: student.id, lessonId } },
    update: { completed, watchedSeconds },
    create: { userId: student.id, lessonId, completed, watchedSeconds },
  });
  await prog(T(1), true, 0);
  await prog(T(2), false, 120); // đang xem dở ⇒ "Học tiếp" của Toán 9 trỏ vào Bài 2
  await prog("l-loi03-van-1", true, 0);
  await prog("l-loi03-van-2", true, 0);

  return [
    `LOI-03 · hocsinh@kin.local → /student/viec-cua-toi : phiếu "Hôm nay có lớp" có Bài 1 lúc 19:30 (Mở tài liệu ↗, Bài Azota ↗, Làm bài tập) và Bài 2 lúc 23:30; "Sắp tới": Ngày mai · 00:30 · Bài 4, ${addDaysKey(today, 3).slice(8, 10)}/${addDaysKey(today, 3).slice(5, 7)} · 19:30 · Bài 5. Bài nháp KHÔNG hiện.`,
    `LOI-03 · hocsinh@kin.local → /student/hoc-tap : thư viện lớp — "${TOAN}" có ảnh bìa, 1/6 bài, "Học tiếp →" vào Bài 2 (đang xem dở); "${VAN}" không ảnh bìa, 2/2 · Hoàn thành (lọc "Hoàn thành").`,
    `LOI-03 · hocsinh@kin.local → /student/hoc-tap?course=${toan.id} : "Nội dung lớp: 2 chương · 6 bài", chương 01/02, dòng bài "1 tài liệu · Có bài tập · Học Hôm nay · 19:30".`,
  ];
};
export default mock;
