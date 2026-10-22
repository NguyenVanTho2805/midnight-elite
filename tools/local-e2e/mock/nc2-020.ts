// NC2-020 — dữ liệu GIẢ cho bảng "Số đo sản phẩm" (/admin/so-do), nhóm thẻ "Gia sư mới vào".
// 20 gia sư thử (thu01…thu20@kin.local, "Gia sư thử 01"…), đã duyệt, đăng ký ở nhiều thời điểm; một phần tạo lớp đầu trong 24 giờ,
// một phần tạo muộn, một phần chưa có lớp; một phần có buổi điểm danh đầu trong 7 ngày. Chạy lặp lại được (đã có thu01 thì bỏ qua).
import type { MockFn } from "../mock-seed";
import { mkCourse, mkTutor, mkUser } from "../h";

const HOUR = 3_600_000, DAY = 24 * HOUR;
const vnDay = (t: number) => new Date(`${new Date(t + 7 * HOUR).toISOString().slice(0, 10)}T00:00:00Z`);

// Mỗi dòng: tuổi đăng ký (giờ), giờ từ đăng ký đến lớp đầu (null = chưa có lớp), ngày từ đăng ký đến buổi đã dạy đầu (null = chưa có).
const PLAN: Array<[ageHours: number, classAfterH: number | null, taughtAfterDays: number | null]> = [
  // 12 gia sư đăng ký 9–28 ngày trước: đủ tuổi 24 giờ và 7 ngày → cột 30 ngày hiện phần trăm thật
  [28 * 24, 3, 2], [26 * 24, 5, 2], [25 * 24, 2, 2], [23 * 24, 20, 2], [21 * 24, 10, 2], [19 * 24, 1, 1],
  [17 * 24, 30, null], [15 * 24, 72, 9], [13 * 24, 48, 6], [12 * 24, null, null], [10 * 24, null, null], [9 * 24, 8, 3],
  // mới vào: 3 ngày (đủ 24 giờ, chưa đủ 7 ngày) và hôm nay (chưa đủ 24 giờ)
  [3 * 24, 4, 1], [3 * 24 + 2, null, null], [2, 1, null], [5, null, null],
  // 4 gia sư cũ hơn: chỉ cột 90 ngày thấy
  [40 * 24, 2, 1], [50 * 24, 100, null], [60 * 24, null, null], [75 * 24, 4, 2],
];

const mock: MockFn = async ({ prisma, student }) => {
  if (await prisma.user.findUnique({ where: { email: "thu01@kin.local" }, select: { id: true } })) return ["NC2-020: gia sư thử thu01…thu20 đã có sẵn, bỏ qua."];
  const now = Date.now();
  const filler = await mkUser({ name: "Học sinh thử điểm danh" }); // một em để gắn bản ghi "có mặt"; không dùng student chính cho khỏi lẫn
  void student;
  for (let i = 0; i < PLAN.length; i++) {
    const [ageH, classAfterH, taughtDays] = PLAN[i];
    const nn = String(i + 1).padStart(2, "0");
    const reg = new Date(now - ageH * HOUR);
    const t = await mkTutor(`Gia sư thử ${nn}`);
    await prisma.user.update({ where: { id: t.id }, data: { email: `thu${nn}@kin.local`, createdAt: reg, tutorVerified: true } });
    if (classAfterH === null) continue;
    const c = await mkCourse(t.id, { name: `Lớp thử ${nn}` });
    await prisma.course.update({ where: { id: c.id }, data: { createdAt: new Date(reg.getTime() + classAfterH * HOUR).toISOString() } });
    if (taughtDays === null) continue;
    const s = await prisma.attendanceSession.create({ data: { courseId: c.id, date: vnDay(reg.getTime() + taughtDays * DAY), createdBy: t.id } });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: filler.id, status: "present" } });
  }
  return [
    "NC2-020 · Đăng nhập admin@kin.local (tên miền admin) → /admin/so-do, kéo xuống nhóm “Gia sư mới vào”.",
    "NC2-020 · Chọn “30 ngày gần nhất”: 3 thẻ hiện PHẦN TRĂM thật (tạo lớp đầu trong 24 giờ ≈ 57%, buổi đã dạy trong 7 ngày ≈ 67%, trung vị giờ tới lớp đầu ≈ 3,5 giờ). Chọn “90 ngày”: số khác. Chọn “7 ngày”: cả ba thẻ ghi “Chưa đủ dữ liệu · N gia sư · cần từ 10”.",
    "NC2-020 · 20 gia sư thử thu01…thu20@kin.local (mật khẩu chung), tên “Gia sư thử NN”; trang số đo không hiện tên ai.",
  ];
};
export default mock;
